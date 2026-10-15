import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { successAlert, errorAlert, toastAlert } from '../../../../../utils/alerts';
import {
  Card, Form, Input, Button, Select, Row, Col,
  Tag, Typography, Tabs, Tooltip, Dropdown, Alert
} from 'antd';
import {
  FileTextOutlined, SaveOutlined, FileSearchOutlined, LeftOutlined,
  RightOutlined, DownOutlined, ArrowLeftOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import UnifiedTextEditor from '../../../../Unified/UnifiedTextEditor';
import { stripCommentHighlights } from '../../../../../utils/templateUtils';
import AttachmentsTab from '../../../../Unified/UnifiedTextEditor/Preview/components/AttachmentsTab';
import ReferencesTab from '../../../../Unified/UnifiedTextEditor/Preview/components/ReferencesTab';
import TemplateNotesTab from '../../../../Unified/UnifiedTextEditor/Preview/components/TemplateNotesTab';
import ImpactAssessment from '../Templates/CreateTemplate/components/ImpactAssessment';
import UnifiedApproversModal from '../../../../new/tailwind/UnifiedApproversModal';
import { debounce } from 'lodash';

const { TextArea } = Input;
const { Option } = Select;

const extractDocumentContent = (doc) => {
  if (!doc) return { content: '', comments: [], suggestions: [], references: [], logo: null, logoText: '', logoTextRight: '', orientation: 'portrait', paperSize: 'A4', pagesState: null };

  let loadedData = {
    content: '',
    comments: [],
    suggestions: [],
    references: [],
    logo: null,
    logoText: '',
    logoTextRight: '',
    orientation: doc.orientation || 'portrait',
    paperSize: doc.paperSize || 'A4',
    pagesState: doc.pagesState || null
  };

  if (doc.content) {
    try {
      let parsed = doc.content;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (parsed && typeof parsed === 'object') {
        loadedData.content = parsed.content || '';
        loadedData.references = (parsed.references && Array.isArray(parsed.references))
          ? parsed.references.filter(r => !r.isManual && r.refAnchor)
          : [];
        loadedData.manualReferences = parsed.manualReferences || (parsed.references && Array.isArray(parsed.references)
          ? parsed.references.filter(r => r.isManual || !r.refAnchor)
          : []);
        loadedData.logo = parsed.logo || null;
        loadedData.logoText = parsed.logoText || '';
        loadedData.logoTextRight = parsed.logoTextRight || '';
        if (parsed.orientation) loadedData.orientation = parsed.orientation;
        if (parsed.paperSize) loadedData.paperSize = parsed.paperSize;
        if (parsed.pagesState) loadedData.pagesState = parsed.pagesState;
      } else {
        loadedData.content = String(doc.content);
      }
    } catch (e) {
      loadedData.content = String(doc.content);
    }
  }

  if (doc.elements) {
    try {
      let parsedElements = doc.elements;
      if (typeof parsedElements === 'string') {
        try { parsedElements = JSON.parse(parsedElements); } catch (_) {}
      }
      if (parsedElements && typeof parsedElements === 'object') {
        if (parsedElements.headerHTML) loadedData.headerHTML = parsedElements.headerHTML;
        if (parsedElements.footerHTML) loadedData.footerHTML = parsedElements.footerHTML;
        if (parsedElements.logo) loadedData.logo = parsedElements.logo;
        if (parsedElements.logoText) loadedData.logoText = parsedElements.logoText;
        if (parsedElements.logoTextRight) loadedData.logoTextRight = parsedElements.logoTextRight;
        if (parsedElements.orientation) loadedData.orientation = parsedElements.orientation;
        if (parsedElements.paperSize) loadedData.paperSize = parsedElements.paperSize;
        if (parsedElements.pagesState) loadedData.pagesState = parsedElements.pagesState;
        if (parsedElements.references) {
          loadedData.references = (parsedElements.references && Array.isArray(parsedElements.references))
            ? parsedElements.references.filter(r => !r.isManual && r.refAnchor)
            : [];
          loadedData.manualReferences = parsedElements.manualReferences || parsedElements.references.filter(r => r.isManual || !r.refAnchor);
        }
      }
    } catch (e) { }
  }

  loadedData.comments = [];
  loadedData.suggestions = [];
  loadedData.content = stripCommentHighlights(loadedData.content);

  return loadedData;
};

const ArchiveDocument = ({
  document,
  user,
  users = [],
  departments = [],
  templates = [],
  fetchUserData,
  onCancel,
  onSuccess,
  obsoleteDocIds = []
}) => {
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const handleCancelClick = (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    if (typeof onCancel === 'function') {
      try {
        onCancel();
        return;
      } catch (err) {
        console.error('Error invoking onCancel callback:', err);
      }
    }
    try {
      if (window.history && window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/dashboard');
      }
    } catch (_) {
      window.location.href = '/dashboard';
    }
  };

  const [activeTab, setActiveTab] = useState('basicInfo');
  const [contentData, setContentData] = useState(null);
  const [impactData, setImpactData] = useState(null);
  const [tempReferences, setTempReferences] = useState([]);
  const [tempManualReferences, setTempManualReferences] = useState([]);

  // Approvers Modal State
  const [approversModalVisible, setApproversModalVisible] = useState(false);
  const [approverType, setApproverType] = useState('approval');
  const [sharedDueDate, setSharedDueDate] = useState(null);
  const [documentApprovers, setDocumentApprovers] = useState({
    reviewers: [],
    approvers: []
  });

  useEffect(() => {
    if (!document) return;

    const initialContent = extractDocumentContent(document);
    setContentData(initialContent);

    // Parse impact
    if (document.impact) {
      try {
        const parsed = typeof document.impact === 'string' ? JSON.parse(document.impact) : document.impact;
        setImpactData(parsed);
      } catch (_) {}
    }

    // Parse approvers
    if (document.approvers) {
      try {
        const parsed = typeof document.approvers === 'string' ? JSON.parse(document.approvers) : document.approvers;
        if (parsed && typeof parsed === 'object') {
          const normalizeUser = (u) => {
            const uid = Number(u.userId || u.id);
            return {
              ...u,
              id: uid,
              userId: uid
            };
          };
          const rawReviewers = Array.isArray(parsed.reviewers) ? parsed.reviewers : [];
          const rawApprovers = Array.isArray(parsed.approvers)
            ? parsed.approvers
            : (Array.isArray(parsed) ? parsed : []);

          setDocumentApprovers({
            reviewers: rawReviewers.map(normalizeUser),
            approvers: rawApprovers.map(normalizeUser)
          });
        }
      } catch (_) {}
    }

    form.setFieldsValue({
      title: document.title,
      description: document.description,
      department: document.department,
      project_number: document.project_number,
      cost_center_number: document.cost_center_number,
      notes: document.notes
    });
  }, [document, form]);

  useEffect(() => {
    if (contentData?.references && Array.isArray(contentData.references)) {
      setTempReferences(contentData.references.filter(r => !r.isManual && r.refAnchor));
    }
    if (contentData?.manualReferences && Array.isArray(contentData.manualReferences)) {
      setTempManualReferences(contentData.manualReferences);
    } else if (contentData?.references && Array.isArray(contentData.references)) {
      setTempManualReferences(contentData.references.filter(r => r.isManual || !r.refAnchor));
    }
  }, [contentData?.references, contentData?.manualReferences]);

  const contentDataRef = useRef(contentData);
  useEffect(() => {
    contentDataRef.current = contentData;
  }, [contentData]);

  const debouncedSave = useRef(
    debounce(() => {
      handleSubmit('draft', true, contentDataRef.current);
    }, 2000)
  ).current;

  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  const handleAddDocumentApprover = (userId) => {
    const foundUser = users.find(u => String(u.id || u.userId) === String(userId));
    if (!foundUser) return;

    const uid = Number(foundUser.id || foundUser.userId);
    const newApprover = {
      id: uid,
      userId: uid,
      name: `${foundUser.first_name || ''} ${foundUser.last_name || ''}`.trim() || foundUser.username || foundUser.email,
      email: foundUser.email,
      department: foundUser.department || '',
      role: approverType === 'review' ? 'document_reviewer' : 'document_approver',
      status: 'pending',
      dueDate: sharedDueDate,
      ...(approverType === 'approval' && { comment: '' })
    };

    const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
    if (!(documentApprovers[targetArray] || []).some(a => String(a.userId || a.id) === String(userId))) {
      setDocumentApprovers(prev => ({
        ...prev,
        [targetArray]: [...(prev[targetArray] || []), newApprover]
      }));
    }
  };

  const handleRemoveDocumentApprover = (userId) => {
    const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
    setDocumentApprovers(prev => ({
      ...prev,
      [targetArray]: (prev[targetArray] || []).filter(a => String(a.userId || a.id) !== String(userId))
    }));
  };

  const handleSubmit = async (targetStatus = 'archive_draft', isAutoSave = false, overrideContentData = null) => {
    const formValues = form.getFieldsValue(true);
    const activeContent = overrideContentData || contentData;

    const updatedApprovers = { ...documentApprovers };
    if (targetStatus === 'pending_archive_review' || targetStatus === 'pending_archive_approval') {
      const targetArray = targetStatus === 'pending_archive_review' ? 'reviewers' : 'approvers';
      updatedApprovers[targetArray] = (updatedApprovers[targetArray] || []).map(a => ({
        ...a,
        status: 'pending',
        role: targetStatus === 'pending_archive_review' ? 'document_reviewer' : 'document_approver',
        dueDate: sharedDueDate || a.dueDate
      }));
    }

    const contentObj = {
      content: activeContent?.content ?? '',
      logo: activeContent?.logo ?? null,
      logoText: activeContent?.logoText ?? '',
      logoTextRight: activeContent?.logoTextRight ?? '',
      references: (activeContent?.references && Array.isArray(activeContent.references))
        ? activeContent.references.filter(r => !r.isManual && r.refAnchor)
        : [],
      manualReferences: tempManualReferences || []
    };

    const elementsObj = {
      comments: activeContent?.comments || [],
      suggestedEdits: activeContent?.suggestions || [],
      references: (activeContent?.references && Array.isArray(activeContent.references))
        ? activeContent.references.filter(r => !r.isManual && r.refAnchor)
        : [],
      manualReferences: tempManualReferences || [],
      headerHTML: formValues.title || '',
      footerHTML: activeContent?.footerHTML || '',
      logo: activeContent?.logo ?? null,
      logoText: activeContent?.logoText ?? '',
      logoTextRight: activeContent?.logoTextRight ?? '',
      hasUserCustomizedHeader: activeContent?.hasUserCustomizedHeader || false,
      orientation: activeContent?.orientation || 'portrait',
      paperSize: activeContent?.paperSize || 'A4',
      pagesState: activeContent?.pagesState || null
    };

    const payload = {
      title: formValues.title || document.title,
      description: formValues.description || '',
      content: JSON.stringify(contentObj),
      elements: JSON.stringify(elementsObj),
      version: document?.version || '1.0',
      current_revision: document?.current_revision || '1.0',
      impact: impactData || {},
      project_number: formValues.project_number || document?.project_number || null,
      cost_center_number: formValues.cost_center_number || document?.cost_center_number || null,
      department: formValues.department || document?.department || null,
      notes: formValues.notes || '',
      status: targetStatus,
      approvers: (targetStatus === 'pending_archive_review' || targetStatus === 'pending_archive_approval')
        ? updatedApprovers
        : documentApprovers
    };

    try {
      const docId = document.document_id || document.id;
      const res = await axios.put(`/api/update_document/${docId}`, payload);
      if (res.data.success) {
        if (!isAutoSave) {
          if (targetStatus === 'pending_archive_review') {
            successAlert('Submitted for Archive Review', 'Document submitted for archive review successfully.');
            if (onSuccess) onSuccess();
            else handleCancelClick();
          } else if (targetStatus === 'pending_archive_approval') {
            successAlert('Submitted for Archive Approval', 'Document submitted for archive approval successfully.');
            if (onSuccess) onSuccess();
            else handleCancelClick();
          } else if (targetStatus === 'archive_draft') {
            toastAlert('Document Saved as Archive Draft');
          } else {
            toastAlert('Document Saved as Draft');
          }
        }
      }
    } catch (err) {
      console.error('Error saving archive document:', err);
      if (!isAutoSave) {
        errorAlert('Save Failed', err.response?.data?.message || 'Could not save document changes.');
      }
    }
  };

  const handleModalSubmit = async () => {
    setApproversModalVisible(false);
    const targetStatus = approverType === 'review' ? 'pending_archive_review' : 'pending_archive_approval';
    await handleSubmit(targetStatus);
  };

  const navigateToTab = (direction) => {
    const tabs = ["basicInfo", "content", "notes", "attachments", "references", "impact"];
    const currentIndex = tabs.indexOf(activeTab);
    if (direction === 'next' && currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
    } else if (direction === 'prev' && currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    }
  };

  const dropdownItems = [
    {
      key: 'archive_draft',
      label: 'Save as Archive Draft',
      icon: <FileTextOutlined />,
      onClick: () => handleSubmit('archive_draft')
    },
    {
      key: 'archive_review',
      label: 'Submit for Archive Review',
      icon: <FileSearchOutlined />,
      onClick: () => {
        setApproverType('review');
        setApproversModalVisible(true);
      }
    },
    {
      key: 'archive_approval',
      label: 'Submit for Archive Approval',
      icon: <SaveOutlined />,
      onClick: () => {
        setApproverType('approval');
        setApproversModalVisible(true);
      }
    }
  ];

  const renderTabNavButtons = () => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', paddingRight: '12px', flexWrap: 'nowrap' }}>
      <Button 
        size="small"
        icon={<LeftOutlined />} 
        onClick={() => navigateToTab('prev')}
        disabled={activeTab === "basicInfo"}
      >
        Previous
      </Button>
      <Button 
        size="small"
        onClick={() => navigateToTab('next')}
        disabled={activeTab === "impact"}
      >
        Next <RightOutlined />
      </Button>
      <Dropdown menu={{ items: dropdownItems }} placement="bottomRight">
        <Button size="small" type="primary" className="bg-amber-600 hover:bg-amber-700 border-amber-600">
          Archive Options <DownOutlined />
        </Button>
      </Dropdown>
      <Tooltip title="Back" placement="left">
        <Button 
          type="default"
          htmlType="button"
          icon={<ArrowLeftOutlined />} 
          size="small"
          onClick={handleCancelClick}
          style={{ cursor: 'pointer', zIndex: 1 }}
        />
      </Tooltip>
    </div>
  );

  return (
    <div className="create-document-tabs p-4">
      {/* Archive Header Banner */}
      <Alert
        message={
          <div className="flex items-center justify-between">
            <span className="font-semibold text-amber-900">
              Archive Preparation Mode — Preparing &quot;{document?.title}&quot; (v{document?.version || '1.0'}) for Archive
            </span>
            <Tag color="orange">Archive Workflow</Tag>
          </div>
        }
        description="You can review or make final edits to the document content and metadata before archiving. When ready, save as draft or submit for Archive Review / Approval."
        type="warning"
        showIcon
        className="mb-4 border-amber-300 bg-amber-50"
      />

      <Row gutter={[16, 0]}>
        <Col span={24}>
          <Form form={form} layout="vertical">
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              type="card"
              destroyInactiveTabPane={false}
              tabBarExtraContent={renderTabNavButtons()}
              items={[
                {
                  key: "basicInfo",
                  label: (
                    <span>
                      <FileTextOutlined /> Basic Information
                    </span>
                  ),
                  children: (
                    <Card bordered={false} title="Basic Document Information">
                      <Form.Item
                        name="title"
                        label="Document Title"
                        rules={[{ required: true, message: 'Please enter a document title' }]}
                      >
                        <Input placeholder="Enter document title" size="large" />
                      </Form.Item>
                      <Form.Item name="department" label="Department">
                        <Select placeholder="Select department" allowClear>
                          {departments.map(d => (
                            <Option key={d.id || d.name} value={d.name}>
                              {d.name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="project_number" label="Project Number">
                            <Input placeholder="Project number" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="cost_center_number" label="Cost Center Number">
                            <Input placeholder="Cost center number" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  )
                },
                {
                  key: "content",
                  label: (
                    <span>
                      <FileTextOutlined /> Content
                    </span>
                  ),
                  children: (
                    <div style={{ minHeight: '600px', background: '#fff', borderRadius: '8px', border: '1px solid #d9d9d9', overflow: 'hidden' }}>
                      <UnifiedTextEditor
                        initialContent={contentData}
                        user={user}
                        documentId={document?.document_id || document?.id}
                        isLiveCollabActive={false}
                        readOnly={false}
                        hideTitleBar={false}
                        onContentChange={(data) => {
                          setContentData(data);
                          debouncedSave();
                        }}
                      />
                    </div>
                  )
                },
                {
                  key: "notes",
                  label: (
                    <span>
                      <InfoCircleOutlined /> Notes / Remarks
                    </span>
                  ),
                  children: (
                    <TemplateNotesTab 
                      parsedTemplate={{ id: document?.document_id || document?.id, notes: document?.notes }} 
                      associationType="document" 
                      currentUser={user} 
                      onNotesChange={(newNotes) => form.setFieldsValue({ notes: newNotes })}
                    />
                  )
                },
                {
                  key: "attachments",
                  label: (
                    <span>
                      Attachments
                    </span>
                  ),
                  children: (
                    <Card bordered={false} title="Document Attachments">
                      <AttachmentsTab
                        associationType="document"
                        associationId={document?.document_id || document?.id}
                        currentUser={user}
                        isAuthor={true}
                        canManage={true}
                      />
                    </Card>
                  )
                },
                {
                  key: "references",
                  label: (
                    <span>
                      References
                    </span>
                  ),
                  children: (
                    <Card bordered={false} title="Document References">
                      <ReferencesTab
                        references={tempReferences}
                        manualReferences={tempManualReferences}
                        obsoleteDocIds={obsoleteDocIds}
                      />
                    </Card>
                  )
                },
                {
                  key: "impact",
                  label: (
                    <span>
                      Impact Assessment
                    </span>
                  ),
                  children: (
                    <Card bordered={false} title="Impact Assessment">
                      <ImpactAssessment
                        documentData={{ impact: impactData }}
                        onDataChange={setImpactData}
                      />
                    </Card>
                  )
                }
              ]}
            />
          </Form>
        </Col>
      </Row>

      {/* UnifiedApproversModal for Archive Review / Approval */}
      <UnifiedApproversModal
        visible={approversModalVisible}
        onCancel={() => setApproversModalVisible(false)}
        approverType={approverType}
        setApproverType={setApproverType}
        sharedDueDate={sharedDueDate}
        setSharedDueDate={setSharedDueDate}
        templateApprovers={documentApprovers}
        users={users}
        handleAddTemplateApprover={handleAddDocumentApprover}
        handleRemoveTemplateApprover={handleRemoveDocumentApprover}
        onSubmit={handleModalSubmit}
        entityLabel="Document"
        mode="archive"
        title={`Submit Document for Archive ${approverType === 'review' ? 'Review' : 'Approval'}`}
        submitButtonLabel={`Submit for Archive ${approverType === 'review' ? 'Review' : 'Approval'}`}
      />
    </div>
  );
};

export default ArchiveDocument;
