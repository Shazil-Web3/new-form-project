import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { successAlert, errorAlert, toastAlert } from '../../../../../utils/alerts';
import { 
  Card, Form, Input, Button, Select, Row, Col, Tag, Typography, 
  Tabs, Tooltip, Dropdown, Space, Alert
} from 'antd';
import { 
  FileTextOutlined, SaveOutlined, FileSearchOutlined, LeftOutlined, 
  RightOutlined, DownOutlined, ArrowLeftOutlined, InfoCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import moment from 'moment';
import { debounce } from 'lodash';
import { stripCommentHighlights } from '../../../../../utils/templateUtils';
import AttachmentsTab from '../../../../Unified/UnifiedTextEditor/Preview/components/AttachmentsTab';
import ReferencesTab from '../../../../Unified/UnifiedTextEditor/Preview/components/ReferencesTab';
import TemplateNotesTab from '../../../../Unified/UnifiedTextEditor/Preview/components/TemplateNotesTab';
import EditorWrapper from './CreateTemplate/components/EditorWrapper';
import UnifiedApproversModal from '../../../../new/tailwind/UnifiedApproversModal';

const { TextArea } = Input;
const { Text } = Typography;
const { Option } = Select;

const ArchiveTemplate = ({ 
  fetchUserData, 
  template, 
  user, 
  users = [], 
  categories = [], 
  departments = [], 
  templates = [], 
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

  const [filterCategory, setCategory] = useState();
  const [contentData, setContentData] = useState(null);
  const [activeTab, setActiveTab] = useState("basicInfo");
  const [lockedElements, setLockedElements] = useState({
    content: false,
    toc: false,
    fontSize: false,
    fontStyle: false,
    headerFooter: false
  });
  const [approvers, setApprovers] = useState([]);
  const [tempReferences, setTempReferences] = useState([]);
  const [tempManualReferences, setTempManualReferences] = useState([]);

  // UnifiedApproversModal state for Archive Review/Approval
  const [approversModalVisible, setApproversModalVisible] = useState(false);
  const [approverType, setApproverType] = useState('approval'); // 'review' or 'approval'
  const [sharedDueDate, setSharedDueDate] = useState(null);
  const [templateApprovers, setTemplateApprovers] = useState({
    reviewers: [],
    approvers: []
  });

  // Track tab completion status
  const [tabStatus, setTabStatus] = useState({
    basicInfo: "complete",
    content: "complete",
    notes: "complete", 
    attachments: "complete",
    references: "complete"
  });

  // Sync references from contentData
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

  // Load template data on mount
  useEffect(() => {
    if (!template) return;

    let loadedContentData = { content: '', comments: [], suggestions: [], references: [], manualReferences: [] };
    try {
      if (template.comments) {
        try {
          const parsedComments = typeof template.comments === 'string' ? JSON.parse(template.comments) : template.comments;
          if (parsedComments && typeof parsedComments.content === 'string') {
            const cleanedContent = stripCommentHighlights(parsedComments.content);
            loadedContentData = { 
              content: cleanedContent,
              comments: parsedComments.comments || [],
              suggestions: parsedComments.suggestions || [],
              references: (parsedComments.references && Array.isArray(parsedComments.references))
                ? parsedComments.references.filter(r => !r.isManual && r.refAnchor)
                : [],
              manualReferences: parsedComments.manualReferences || (parsedComments.references && Array.isArray(parsedComments.references)
                ? parsedComments.references.filter(r => r.isManual || !r.refAnchor)
                : []),
              headerHTML: parsedComments.headerHTML || '',
              footerHTML: parsedComments.footerHTML || '',
              logo: parsedComments.logo || null,
              logoText: parsedComments.logoText || '',
              logoTextRight: parsedComments.logoTextRight || '',
              orientation: parsedComments.orientation || template.orientation || 'portrait',
              paperSize: parsedComments.paperSize || template.paperSize || 'A4',
              pagesState: parsedComments.pagesState || template.pagesState || null
            };
          } else {
            const cleanedContent = stripCommentHighlights(template.content || '');
            loadedContentData = { 
              content: cleanedContent,
              comments: [], 
              suggestions: [],
              references: [],
              manualReferences: [],
              orientation: template.orientation || 'portrait',
              paperSize: template.paperSize || 'A4',
              pagesState: template.pagesState || null
            };
          }
        } catch (_) {
          loadedContentData = {
            content: stripCommentHighlights(template.content || ''),
            comments: [],
            suggestions: [],
            references: [],
            manualReferences: [],
            orientation: template.orientation || 'portrait',
            paperSize: template.paperSize || 'A4',
            pagesState: template.pagesState || null
          };
        }
      } else if (template.content) {
        try {
          const parsedContent = typeof template.content === 'string' ? JSON.parse(template.content) : template.content;
          if (typeof parsedContent === 'object' && parsedContent !== null) {
            loadedContentData = {
              ...parsedContent,
              content: stripCommentHighlights(parsedContent.content || ''),
              comments: parsedContent.comments || [],
              suggestions: parsedContent.suggestions || [],
              references: parsedContent.references || [],
              manualReferences: parsedContent.manualReferences || []
            };
          } else {
            loadedContentData = { 
              content: stripCommentHighlights(String(template.content)),
              comments: [], 
              suggestions: [], 
              references: [], 
              manualReferences: [] 
            };
          }
        } catch (_) {
          loadedContentData = { 
            content: stripCommentHighlights(String(template.content)),
            comments: [], 
            suggestions: [], 
            references: [], 
            manualReferences: [] 
          };
        }
      }
    } catch (error) {
      console.error('Error parsing archive template content:', error);
      loadedContentData = { content: template.content || '', comments: [], suggestions: [], references: [], manualReferences: [] };
    }

    setContentData(loadedContentData);

    let templateStructure = {};
    try {
      templateStructure = typeof template.template_structure === 'string' 
        ? JSON.parse(template.template_structure) 
        : template.template_structure || {};
    } catch (_) {}

    if (templateStructure.locked_elements) {
      setLockedElements(templateStructure.locked_elements);
    }

    let requiredApprovers = [];
    try {
      requiredApprovers = typeof template.required_approvers === 'string'
        ? JSON.parse(template.required_approvers)
        : template.required_approvers || [];
    } catch (_) {}
    setApprovers(requiredApprovers);

    // Prefill existing template approvers if present
    if (template.template_approvers) {
      try {
        const parsedTplApprovers = typeof template.template_approvers === 'string'
          ? JSON.parse(template.template_approvers)
          : template.template_approvers;
        if (parsedTplApprovers && typeof parsedTplApprovers === 'object') {
          const normalizeUser = (u) => {
            const uid = Number(u.userId || u.id);
            return {
              ...u,
              id: uid,
              userId: uid
            };
          };
          const rawReviewers = Array.isArray(parsedTplApprovers.reviewers) ? parsedTplApprovers.reviewers : [];
          const rawApprovers = Array.isArray(parsedTplApprovers.approvers)
            ? parsedTplApprovers.approvers
            : (Array.isArray(parsedTplApprovers) ? parsedTplApprovers : []);

          setTemplateApprovers({
            reviewers: rawReviewers.map(normalizeUser),
            approvers: rawApprovers.map(normalizeUser)
          });
        }
      } catch (_) {}
    }

    form.setFieldsValue({
      name: template.name,
      description: template.description,
      category: template.category_id,
      notes: template.notes
    });

    if (template.category_id) {
      setCategory(template.category_id);
    }
  }, [template, form]);

  const contentDataRef = useRef(contentData);
  useEffect(() => {
    contentDataRef.current = contentData;
  }, [contentData]);

  // Debounced auto-save
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

  const handleAddTemplateApprover = (userId) => {
    const foundUser = users.find(u => String(u.id || u.userId) === String(userId));
    if (!foundUser) return;

    const uid = Number(foundUser.id || foundUser.userId);
    const newApprover = {
      id: uid,
      userId: uid,
      name: `${foundUser.first_name || ''} ${foundUser.last_name || ''}`.trim() || foundUser.username || foundUser.email,
      email: foundUser.email,
      department: foundUser.department || '',
      role: approverType === 'review' ? 'template_reviewer' : 'template_approver',
      status: 'pending',
      dueDate: sharedDueDate,
      ...(approverType === 'approval' && { comment: '' })
    };

    const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
    if (!(templateApprovers[targetArray] || []).some(a => String(a.userId || a.id) === String(userId))) {
      setTemplateApprovers(prev => ({
        ...prev,
        [targetArray]: [...(prev[targetArray] || []), newApprover]
      }));
    }
  };

  const handleRemoveTemplateApprover = (userId) => {
    const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
    setTemplateApprovers(prev => ({
      ...prev,
      [targetArray]: (prev[targetArray] || []).filter(a => String(a.userId || a.id) !== String(userId))
    }));
  };

  // Submit handler
  const handleSubmit = async (targetStatus = 'draft', isAutoSave = false, overrideContentData = null) => {
    const formValues = form.getFieldsValue(true);
    const activeContentData = overrideContentData || contentData;

    const updatedTemplateApprovers = { ...templateApprovers };
    if (targetStatus === 'pending_archive_review' || targetStatus === 'pending_archive_approval') {
      const targetArray = targetStatus === 'pending_archive_review' ? 'reviewers' : 'approvers';
      updatedTemplateApprovers[targetArray] = (updatedTemplateApprovers[targetArray] || []).map(approver => ({
        ...approver,
        status: 'pending',
        role: targetStatus === 'pending_archive_review' ? 'template_reviewer' : 'template_approver',
        dueDate: sharedDueDate || approver.dueDate
      }));
    }

    const payload = {
      name: formValues.name,
      description: formValues.description,
      category_id: formValues.category,
      created_by: user?.id,
      organization_id: user?.orgId || user?.organization_id,
      template_approvers: (targetStatus === 'pending_archive_review' || targetStatus === 'pending_archive_approval')
        ? updatedTemplateApprovers
        : templateApprovers,
      content: (activeContentData && activeContentData.content) || '',
      comments: (() => {
        const isCustomHeader = activeContentData?.hasUserCustomizedHeader === true;
        const canonicalTitle = (formValues.name || '').trim();
        const finalHeaderHTML = isCustomHeader
          ? (activeContentData?.headerHTML || '')
          : (canonicalTitle || activeContentData?.headerHTML || '');

        return {
          content: (activeContentData && activeContentData.content) || '',
          comments: (activeContentData && activeContentData.comments) || [],
          suggestions: (activeContentData && activeContentData.suggestions) || [],
          references: (activeContentData && activeContentData.references) || [],
          manualReferences: (activeContentData && activeContentData.manualReferences) || [],
          headerHTML: finalHeaderHTML,
          footerHTML: (activeContentData && activeContentData.footerHTML) || '',
          logo: (activeContentData && activeContentData.logo) || null,
          logoText: (activeContentData && activeContentData.logoText) || '',
          orientation: (activeContentData && activeContentData.orientation) || 'portrait',
          paperSize: (activeContentData && activeContentData.paperSize) || 'A4',
          pagesState: activeContentData?.pagesState || null,
          hasUserCustomizedHeader: isCustomHeader
        };
      })(),
      notes: formValues.notes || '',
      status: targetStatus,
      // In Archive workflow, version is preserved
      version: template?.version || 1
    };

    try {
      const response = await axios.put(`/api/update_template/${template.id}`, payload);
      if (response.data.success) {
        if (!isAutoSave) {
          if (targetStatus === 'pending_archive_review') {
            successAlert('Submitted for Archive Review', 'Template submitted for archive review successfully.');
            if (onSuccess) onSuccess();
            else handleCancelClick();
          } else if (targetStatus === 'pending_archive_approval') {
            successAlert('Submitted for Archive Approval', 'Template submitted for archive approval successfully.');
            if (onSuccess) onSuccess();
            else handleCancelClick();
          } else if (targetStatus === 'archive_draft') {
            toastAlert('Template Saved as Archive Draft');
          } else {
            toastAlert('Template Saved as Draft');
          }
        }
      }
    } catch (error) {
      console.error('Error saving archive template:', error);
      if (!isAutoSave) {
        errorAlert('Save Failed', error.response?.data?.message || 'Could not save template changes.');
      }
    }
  };

  const handleModalSubmit = async () => {
    setApproversModalVisible(false);
    const targetStatus = approverType === 'review' ? 'pending_archive_review' : 'pending_archive_approval';
    await handleSubmit(targetStatus);
  };

  const navigateToTab = (direction) => {
    const tabs = ["basicInfo", "content", "notes", "attachments", "references"];
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
      onClick: (info) => {
        // Ant Design v5 passes { item, key, keyPath } as first param, not event
        handleSubmit('archive_draft');
      }
    },
    {
      key: 'archive_review',
      label: 'Submit for Archive Review',
      icon: <FileSearchOutlined />,
      onClick: (info) => {
        // Ant Design v5 passes { item, key, keyPath } as first param, not event
        setApproverType('review');
        setApproversModalVisible(true);
      }
    },
    {
      key: 'archive_approval',
      label: 'Submit for Archive Approval',
      icon: <SaveOutlined />,
      onClick: (info) => {
        // Ant Design v5 passes { item, key, keyPath } as first param, not event
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
        disabled={activeTab === "references"}
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
    <div className="create-template-tabs p-4">
      {/* Archive Header Banner */}
      <Alert
        message={
          <div className="flex items-center justify-between">
            <span className="font-semibold text-amber-900">
              Archive Preparation Mode — Preparing &quot;{template?.name}&quot; (v{template?.version || '1.0'}) for Archive
            </span>
            <Tag color="orange">Archive Workflow</Tag>
          </div>
        }
        description="You can review or make final edits to the template content and metadata before archiving. When ready, save as draft or submit for Archive Review / Approval."
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
                    <Card bordered={false} title="Basic Template Information">
                      <Form.Item
                        name="name"
                        label="Template Name"
                        rules={[{ required: true, message: 'Please enter a template name' }]}
                      >
                        <Input placeholder="Enter template name" size="large" />
                      </Form.Item>
                      <Form.Item
                        name="description"
                        label="Description"
                        rules={[{ required: true, message: 'Please provide a description' }]}
                      >
                        <TextArea rows={4} placeholder="Describe what this template is used for" />
                      </Form.Item>
                      <Form.Item name="category" label="Template Category">
                        <Select 
                          placeholder="Select a category"                
                          value={filterCategory}
                          onChange={setCategory}
                          allowClear
                        >
                          {categories.map(c => (
                            <Option key={c.category_id} value={c.category_id}>
                              {c.category_name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
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
                    <Form.Item noStyle shouldUpdate>
                      {({ getFieldValue }) => (
                        <EditorWrapper
                          isActive={activeTab === "content"}
                          user={user}
                          currentTemplateId={template?.id}
                          contentData={contentData}
                          setContentData={setContentData}
                          documentTitle={getFieldValue('name')}
                          onAutoSaveRequested={(data, instant) => {
                            if (instant) {
                              handleSubmit('draft', true, data);
                            } else {
                              debouncedSave();
                            }
                          }}
                        />
                      )}
                    </Form.Item>
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
                      parsedTemplate={template} 
                      associationType="template" 
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
                    <Card bordered={false} title="Template Attachments">
                      <AttachmentsTab
                        associationType="template"
                        associationId={template?.id}
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
        templateApprovers={templateApprovers}
        users={users}
        handleAddTemplateApprover={handleAddTemplateApprover}
        handleRemoveTemplateApprover={handleRemoveTemplateApprover}
        onSubmit={handleModalSubmit}
        entityLabel="Template"
        mode="archive"
        title={`Submit Template for Archive ${approverType === 'review' ? 'Review' : 'Approval'}`}
        submitButtonLabel={`Submit for Archive ${approverType === 'review' ? 'Review' : 'Approval'}`}
      />
    </div>
  );
};

export default ArchiveTemplate;
