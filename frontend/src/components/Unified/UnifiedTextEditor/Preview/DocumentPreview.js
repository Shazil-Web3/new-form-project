import React, { useRef, useState, useEffect } from 'react';
import apiClient from '../../../../api/apiClient';
import { Tabs, Spin, Card, Row, Col, Button, Dropdown, Badge, Tooltip, Tag, message } from 'antd';
import moment from 'moment';
import PropTypes from 'prop-types';

import '../../../Home/components/Dashboard/Templates/CommentsSuggestionsFixes.css';
import './TemplatePreview.css';

import { useDocumentWorkflowPreviewState } from './hooks/useDocumentWorkflowPreviewState';
import { useDocumentWorkflowActions } from './hooks/useDocumentWorkflowActions';
import { useDocumentWorkflowContent } from './hooks/useDocumentWorkflowContent';

import TemplatePreviewHeader from './components/TemplatePreviewHeader';
import TemplateOverviewTab from './components/TemplateOverviewTab';
import OverviewProgressTab from './components/OverviewProgressTab';
import TemplateContentTab from './components/TemplateContentTab';
import TemplateStructureTab from './components/TemplateStructureTab';
import TemplateApproversTab from './components/TemplateApproversTab';
import TemplateActivityTab from './components/TemplateActivityTab';
import TemplateNotesTab from './components/TemplateNotesTab';
import RejectionModal from './components/RejectionModal';
import TemplateApproversModal from '../../../Home/components/Dashboard/Templates/CreateTemplate/components/TemplateApproversModal';
import UnaddressedCommentsWarningModal from '../../UnifiedCommentSystem/components/UnaddressedCommentsWarningModal';
import { hasUnaddressedItems } from '../../UnifiedCommentSystem/utils/unaddressedCommentsHelper';
import useWorkflowNavigationGuard from './hooks/useWorkflowNavigationGuard';
import ReviewPendingModal from './components/ReviewPendingModal';
import { 
  FileTextOutlined, FileSearchOutlined, SaveOutlined, 
  InfoCircleOutlined, DownOutlined,
  TeamOutlined, EditOutlined,
  MessageOutlined, HistoryOutlined, PaperClipOutlined,
  BookOutlined
} from '@ant-design/icons';
import { successAlert, errorAlert, warningAlert, confirmAlert, toastAlert } from '../../../../utils/alerts';
import { getPublishReadiness, publishDocumentGroup } from '../../../../api/documents';
import { getStageBadgeText } from './components/TemplateOverviewTab';
import AttachmentsTab from './components/AttachmentsTab';
import ReferencesTab from './components/ReferencesTab';
import TemplateImpactTab from './components/TemplateImpactTab';

const { TabPane } = Tabs;

// Document statuses that prevent editing. Note: 'reviewed' is NOT locked - reviewers can continue editing
// and will auto-revert to 'pending_review' on typing (same as templates)
const LOCKED_DOCUMENT_STATUSES = ['pending_approval', 'approved', 'published', 'active', 'revised'];

/**
 * Same UI as TemplatePreview; loads/saves document workflow via /api/get_document and /api/update_document_content.
 */
const DocumentPreview = ({
  document: documentRow,
  categories,
  users,
  departments,
  currentUser,
  onCancel,
  onRevise,
  onArchive,
  readOnly = false,
  isReferenceView = false
}) => {
  const pagesContainerRef = useRef(null);

  const {
    parsedTemplate,
    setParsedTemplate,
    initialData,
    loading
  } = useDocumentWorkflowPreviewState(documentRow, currentUser);

  const {
    isReviewing,
    isApproving,
    isRejecting,
    rejectionComment,
    setRejectionComment,
    showRejectionModal,
    setShowRejectionModal,
    handleReview,
    handleApprove,
    handleReject,
    updateMetadata,
    handleReassign,
    handleRevertReviewersStatus
  } = useDocumentWorkflowActions(parsedTemplate, setParsedTemplate, currentUser);

  const {
    contentLoaded,
    contentHtml,
    setContentHtml,
    comments,
    suggestions,
    logo,
    setLogo,
    headerHTML,
    footerHTML,
    setHeaderHTML,
    setFooterHTML,
    logoText,
    setLogoText,
    logoTextRight,
    setLogoTextRight,
    orientation,
    setOrientation,
    paperSize,
    setPaperSize,
    pagesState,
    setPagesState,
    isSaving,
    socketUpdateKey,
    manualSaveContent,
    handleCommentsChange,
    handleSuggestionsChange,
    references,
    handleReferencesChange,
    manualReferences,
    handleManualReferencesChange,
    lastTypingTimeRef,
    emitCommentAdd,
    emitCommentUpdate,
    emitCommentDelete,
    emitSuggestionAdd,
    emitSuggestionUpdate,
    emitSuggestionDelete
  } = useDocumentWorkflowContent(parsedTemplate, initialData, currentUser, pagesContainerRef, setParsedTemplate, readOnly);

  const isAuthor = currentUser && parsedTemplate ? String(currentUser.id) === String(parsedTemplate.created_by) : false;
  const canEditAttachments = !readOnly && (isAuthor || (currentUser && currentUser.role === 'admin')) && ['draft', 'pending_revision'].includes(parsedTemplate?.status);
  const canEditReferences = canEditAttachments; // Same logic as attachments

  const [documentApproversModalVisible, setDocumentApproversModalVisible] = useState(false);
  const [approverType, setApproverType] = useState('review');
  const [sharedDueDate, setSharedDueDate] = useState(null);
  const isApprovalStage = ['pending_approval', 'approved'].includes(String(parsedTemplate?.status || '').toLowerCase());
  const [cleanView, setCleanView] = useState(() => isApprovalStage ? 'accepted' : false);

  // Navigation Guard for Reviewers / Approvers
  const {
    modalVisible: reviewGuardModalVisible,
    pendingInfo: reviewGuardPendingInfo,
    guardNavigation,
    handleStay: handleReviewGuardStay,
    handleLeaveAnyway: handleReviewGuardLeave
  } = useWorkflowNavigationGuard(parsedTemplate, currentUser);

  const handleGuardedCancel = React.useCallback(() => {
    guardNavigation(onCancel);
  }, [guardNavigation, onCancel]);
  const [documentWorkflowApprovers, setDocumentWorkflowApprovers] = useState({
    reviewers: [],
    approvers: []
  });

  // Warning modal — shown before approval modal when unaddressed items exist
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [pendingApprovalFn, setPendingApprovalFn] = useState(null);




  // Sync workflow approvers from parsedTemplate if they exist
  useEffect(() => {
    if (parsedTemplate?.template_approvers) {
      setDocumentWorkflowApprovers(parsedTemplate.template_approvers);
    }
  }, [parsedTemplate]);

  // Default clean view with accepted suggestions when in approval status
  useEffect(() => {
    const s = String(parsedTemplate?.status || '').toLowerCase();
    if (s === 'pending_approval' || s === 'approved') {
      setCleanView('accepted');
    }
  }, [parsedTemplate?.status]);

  const handleAddDocumentApprover = (userId) => {
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    const newApprover = {
      userId,
      name: `${u.first_name} ${u.last_name}`,
      email: u.email,
      department: u.department || '',
      role: approverType === 'review' ? 'document_reviewer' : 'document_approver',
      status: 'pending',
      dueDate: sharedDueDate
    };
    const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
    if (!documentWorkflowApprovers[targetArray].some((a) => a.userId === userId)) {
      setDocumentWorkflowApprovers((prev) => ({
        ...prev,
        [targetArray]: [...prev[targetArray], newApprover]
      }));
    }
  };

  const handleRemoveDocumentApprover = (userId) => {
    const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
    setDocumentWorkflowApprovers((prev) => ({
      ...prev,
      [targetArray]: prev[targetArray].filter((a) => a.userId !== userId)
    }));
  };

  const handleWorkflowApproversChange = async (updater) => {
    let newWorkflow;
    setDocumentWorkflowApprovers((prev) => {
      newWorkflow = typeof updater === 'function' ? updater(prev) : updater;
      return newWorkflow;
    });

    const docId = parsedTemplate?.document_id || parsedTemplate?.id;
    if (docId && newWorkflow) {
      try {
        await apiClient.put(`/api/update_document/${docId}`, {
          approvers: newWorkflow
        });
        setParsedTemplate(prev => ({
          ...prev,
          template_approvers: newWorkflow
        }));
      } catch (e) {
        console.error("Failed to save updated workflow approvers", e);
      }
    }
  };

  const persistDocumentWorkflow = async (status) => {
    const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
    if (!documentId) return;

    let workflowForSubmit = { ...documentWorkflowApprovers };
    if (status !== 'published') {
      // Reset ALL reviewers and approvers to 'pending' on resubmission
      // so previously rejected/approved users get a clean slate
      workflowForSubmit.reviewers = (workflowForSubmit.reviewers || []).map((a) => {
        const { rejectedAt, reviewedAt, approvedAt, comment: _comment, ...rest } = a;
        return {
          ...rest,
          status: 'pending',
          dueDate: sharedDueDate || a.dueDate
        };
      });
      workflowForSubmit.approvers = (workflowForSubmit.approvers || []).map((a) => {
        const { rejectedAt, reviewedAt, approvedAt, comment: _comment, ...rest } = a;
        return {
          ...rest,
          status: 'pending',
          dueDate: sharedDueDate || a.dueDate
        };
      });
    }

    try {
      const body = {
        status: status,
        approvers: workflowForSubmit
      };
      
      const res = await apiClient.put(`/api/update_document/${documentId}`, body);
      if (res.data?.success || res.status === 200) {
        setParsedTemplate(prev => ({
          ...prev,
          status: status,
          template_approvers: workflowForSubmit
        }));
        return true;
      }
    } catch (error) {
      console.error('Error updating document workflow:', error);
      errorAlert('Update Failed', error.response?.data?.message || 'Failed to update document workflow status.');
    }
    return false;
  };

  const handleSubmitWorkflow = async (status) => {
    const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
    // Save current content first
    await manualSaveContent();

    if (status === 'draft') {
      const ok = await persistDocumentWorkflow('draft');
      if (ok) {
        await toastAlert('Document saved as draft');
        return true;
      }
      return false;
    }

    if (status === 'published') {
      try {
        const readiness = await getPublishReadiness(documentId);
        if (readiness && readiness.canPublish === false && Array.isArray(readiness.blockedBy) && readiness.blockedBy.length > 0) {
          const blockedItemsHtml = readiness.blockedBy
            .map(
              (b) =>
                `<li style="margin-bottom: 8px;"><strong>"${b.title || 'Untitled'}"</strong> is currently in <span style="font-weight: 600; color: #2563eb;">${getStageBadgeText(b.status)}</span></li>`
            )
            .join('');

          await warningAlert(
            'Cannot Publish Document',
            '',
            {
              html: `
                <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.6;">
                  <p style="margin-bottom: 12px;">This document cannot be published individually because it is linked to related document(s) that are still in progress:</p>
                  <ul style="margin: 0 0 14px 18px; padding: 0; list-style-type: disc;">
                    ${blockedItemsHtml}
                  </ul>
                  <p style="margin: 0; color: #64748b; font-size: 13px;">
                    All related documents must complete review and approval before they can be published together.
                  </p>
                </div>
              `,
              confirmButtonText: 'Understood',
              confirmButtonColor: '#2563eb',
            }
          );
          return false;
        }

        if (readiness && readiness.groupSize > 1 && Array.isArray(readiness.groupDetails)) {
          const groupListHtml = readiness.groupDetails
            .map(
              (d) =>
                `<li style="margin-bottom: 6px;"><strong>"${d.title || 'Untitled'}"</strong> (<span style="color: #16a34a; font-weight: 600;">Approved</span>)</li>`
            )
            .join('');

          const confirmResult = await confirmAlert(
            'Publish Related Documents',
            '',
            `Publish All (${readiness.groupSize})`,
            'Cancel',
            {
              html: `
                <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.6;">
                  <p style="margin-bottom: 10px;">All <strong>${readiness.groupSize}</strong> documents in this related group have completed approval:</p>
                  <ul style="margin: 0 0 14px 18px; padding: 0; list-style-type: disc;">
                    ${groupListHtml}
                  </ul>
                  <p style="margin: 0; font-size: 13px; color: #0284c7; font-weight: 500;">
                    Publishing will atomically publish all ${readiness.groupSize} documents together.
                  </p>
                </div>
              `,
              confirmButtonColor: '#2563eb',
            }
          );

          if (confirmResult.isConfirmed) {
            try {
              const docIds = readiness.groupDetails.map((d) => d.document_id);
              await publishDocumentGroup(docIds);
              setParsedTemplate((prev) => ({
                ...prev,
                status: 'published',
              }));
              await successAlert('Published', `Successfully published ${docIds.length} related document(s).`);
              return true;
            } catch (pubErr) {
              errorAlert('Publish Failed', pubErr?.response?.data?.message || 'Failed to publish document group.');
              return false;
            }
          }
          return false;
        }
      } catch (readinessErr) {
        console.warn('[DocumentPreview] Publish readiness notice:', readinessErr);
      }

      const ok = await persistDocumentWorkflow('published');
      if (ok) {
        await successAlert('Document Published', 'The document has been published successfully.');
        return true;
      }
      return false;
    }

    const ok = await persistDocumentWorkflow(status);
    if (ok) {
      const actionText = status === 'pending_review' ? 'Review' : 'Approval';
      await successAlert('Document Submitted', `Document submitted for ${actionText} successfully`);
      return true;
    }
    return false;
  };

  const generateWorkflowItems = () => {
    const items = [];

    items.push({
      key: 'draft',
      label: 'Save as Draft',
      icon: <FileTextOutlined />,
      onClick: (info) => {
        // Ant Design v5 passes { item, key, keyPath } as first param, not event
        handleSubmitWorkflow('draft');
      }
    });

    items.push({
      key: 'review',
      label: 'Submit for Review',
      icon: <FileSearchOutlined />,
      onClick: (info) => {
        // Ant Design v5 passes { item, key, keyPath } as first param, not event
        setApproverType('review');
        setDocumentApproversModalVisible(true);
      }
    });

    items.push({
      key: 'approval',
      label: 'Submit for Approval',
      icon: <SaveOutlined />,
      onClick: (info) => {
        // Ant Design v5 passes { item, key, keyPath } as first param, not event
        const openModal = () => {
          setApproverType('approval');
          if (!sharedDueDate) {
            const list = documentWorkflowApprovers?.approvers || parsedTemplate?.template_approvers?.approvers || [];
            const existingDue = list.find(a => a.dueDate)?.dueDate || parsedTemplate?.due_date || parsedTemplate?.dueDate;
            if (existingDue && moment(existingDue).isValid() && moment(existingDue).isSameOrAfter(moment().startOf('day'))) {
              setSharedDueDate(moment(existingDue));
            }
          }
          setDocumentApproversModalVisible(true);
        };
        if (hasUnaddressedItems({ comments, suggestions }, { template_approvers: parsedTemplate?.template_approvers || documentWorkflowApprovers, reviewers: documentWorkflowApprovers?.reviewers || parsedTemplate?.template_approvers?.reviewers })) {
          setPendingApprovalFn(() => openModal);
          setWarningModalVisible(true);
        } else {
          openModal();
        }
      }
    });

    return items;
  };

  const renderTabNavButtons = () => {
    if (readOnly) return null;

    const items = generateWorkflowItems();
    
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Dropdown menu={{ items }} placement="bottomRight">
          <Button size="small" type="primary">
            Circulate Document <DownOutlined />
          </Button>
        </Dropdown>
      </div>
    );
  };

  const getCategoryDetails = (categoryId) => {
    return categories.find((c) => c.category_id === categoryId) || {};
  };

  const getCurrentUsersToShow = () => {
    if (!parsedTemplate?.template_approvers) return [];

    const status = parsedTemplate.status;
    const { reviewers = [], approvers = [] } = parsedTemplate.template_approvers;

    if (status === 'pending_review' || status === 'reviewed') {
      return reviewers;
    } else if (status === 'pending_approval' || status === 'approved' || status === 'rejected') {
      return approvers;
    } else if (status === 'draft' || status === 'pending_revision') {
      // For drafts: show all configured users (from template) so author can see the workflow
      return [...reviewers, ...approvers];
    }

    return [];
  };


  if (!documentRow) {
    return null;
  }

  return (
    <div className="create-template-tabs">
      <div className={`template-page ${cleanView ? `clean-view clean-view-${cleanView === 'rejected' ? 'rejected' : 'accepted'}` : ''}`}>
        <div className="template-page-content">
          {loading || !parsedTemplate ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>Loading document...</div>
            </div>
          ) : (
            <div className="template-content">
              <Tabs 
                defaultActiveKey="content" 
                type="card"
                tabBarExtraContent={
                  <TemplatePreviewHeader
                    isDocument={true}
                    parsedTemplate={parsedTemplate}
                    currentUser={currentUser}
                    onCancel={handleGuardedCancel}
                    onRevise={onRevise}
                    onArchive={onArchive}
                    readOnly={readOnly}
                    isReferenceView={isReferenceView}
                    manualSaveContent={manualSaveContent}
                    isSaving={isSaving}
                    users={users}
                    handleReassign={handleReassign}
                    departments={departments}
                    handleReview={async () => {
                      await manualSaveContent();
                      await handleReview();
                    }}
                    handleApprove={async () => {
                      await manualSaveContent();
                      const ok = await handleApprove();
                      if (ok) onCancel();
                    }}
                    handleReject={async () => {
                      await manualSaveContent();
                      const ok = await handleReject();
                      if (ok) onCancel();
                    }}
                    setShowRejectionModal={setShowRejectionModal}
                    isReviewing={isReviewing}
                    isApproving={isApproving}
                    isRejecting={isRejecting}
                    handleSubmit={async (status) => {
                      if (status === 'draft') {
                        const ok = await handleSubmitWorkflow('draft');
                        if (ok && onCancel) onCancel();
                      } else if (status === 'published') {
                        const ok = await handleSubmitWorkflow('published');
                        if (ok && onCancel) onCancel();
                      } else if (status === 'pending_approval') {
                        const openModal = () => {
                          setApproverType('approval');
                          if (!sharedDueDate) {
                            const list = documentWorkflowApprovers?.approvers || parsedTemplate?.template_approvers?.approvers || [];
                            const existingDue = list.find(a => a.dueDate)?.dueDate || parsedTemplate?.due_date || parsedTemplate?.dueDate;
                            if (existingDue && moment(existingDue).isValid() && moment(existingDue).isSameOrAfter(moment().startOf('day'))) {
                              setSharedDueDate(moment(existingDue));
                            }
                          }
                          setDocumentApproversModalVisible(true);
                        };
                        if (hasUnaddressedItems({ comments, suggestions }, { template_approvers: parsedTemplate?.template_approvers || documentWorkflowApprovers, reviewers: documentWorkflowApprovers?.reviewers || parsedTemplate?.template_approvers?.reviewers })) {
                          setPendingApprovalFn(() => openModal);
                          setWarningModalVisible(true);
                        } else {
                          openModal();
                        }
                      } else {
                        const targetType = status === 'pending_review' ? 'review' : 'approval';
                        setApproverType(targetType);
                        if (!sharedDueDate) {
                          const list = targetType === 'review'
                            ? (documentWorkflowApprovers?.reviewers || parsedTemplate?.template_approvers?.reviewers || [])
                            : (documentWorkflowApprovers?.approvers || parsedTemplate?.template_approvers?.approvers || []);
                          const existingDue = list.find(a => a.dueDate)?.dueDate || parsedTemplate?.due_date || parsedTemplate?.dueDate;
                          if (existingDue && moment(existingDue).isValid() && moment(existingDue).isSameOrAfter(moment().startOf('day'))) {
                            setSharedDueDate(moment(existingDue));
                          }
                        }
                        setDocumentApproversModalVisible(true);
                      }
                    }}
                    handleRevertReviewersStatus={handleRevertReviewersStatus}
                    cleanView={cleanView}
                    setCleanView={setCleanView}
                  />
                }
              >
                <TabPane 
                  tab={<span><FileTextOutlined /> Overview</span>} 
                  key="overview"
                >
                  <TemplateOverviewTab
                    parsedTemplate={parsedTemplate}
                    getCategoryDetails={getCategoryDetails}
                    categories={categories}
                    updateMetadata={updateMetadata}
                    isAuthor={isAuthor}
                    currentUser={currentUser}
                    users={users}
                    entityLabel="Document"
                  />
                </TabPane>

                <TabPane 
                  tab={<span><HistoryOutlined /> Overview Progress</span>} 
                  key="overviewProgress"
                >
                  <OverviewProgressTab
                    parsedTemplate={parsedTemplate}
                    users={users}
                    departments={departments}
                    categories={categories}
                    entityLabel="Document"
                  />
                </TabPane>

                <TabPane 
                  tab={<span><EditOutlined /> Content</span>} 
                  key="content"
                >
                  {/* Do not mount the editor until GET finished — see utils/editorContentGuards.js. */}
                  {!contentLoaded ? (
                    <div style={{ textAlign: 'center', padding: '100px 0' }}>
                      <Spin size="large" />
                      <div style={{ marginTop: 16 }}>Loading editor content...</div>
                    </div>
                  ) : (
                    <TemplateContentTab
                      isDocument={true}
                      parsedTemplate={parsedTemplate}
                      contentHtml={contentHtml}
                      loading={loading}
                      contentLoaded={contentLoaded}
                      comments={comments}
                      suggestions={suggestions}
                      logo={logo}
                      headerHTML={headerHTML}
                      footerHTML={footerHTML}
                      logoText={logoText}
                      logoTextRight={logoTextRight}
                      orientation={orientation}
                      paperSize={paperSize}
                      pagesState={pagesState}
                      setHeaderHTML={setHeaderHTML}
                      setFooterHTML={setFooterHTML}
                      setLogoText={setLogoText}
                      setLogoTextRight={setLogoTextRight}
                      setLogo={setLogo}
                      setOrientation={setOrientation}
                      setPaperSize={setPaperSize}
                      setPagesState={setPagesState}
                      currentUser={currentUser}
                      userRole={(() => {
                        const role =
                          currentUser && parsedTemplate
                            ? String(currentUser.id) === String(parsedTemplate.created_by)
                              ? 'author'
                              : 'viewer'
                            : 'viewer';
                        return role;
                      })()}
                      setContentHtml={setContentHtml}
                      manualSaveContent={manualSaveContent}
                      isSaving={isSaving}
                      handleCommentsChange={handleCommentsChange}
                      handleSuggestionsChange={handleSuggestionsChange}
                      references={references}
                      handleReferencesChange={handleReferencesChange}
                      pagesContainerRef={pagesContainerRef}
                      socketUpdateKey={socketUpdateKey}
                      lastTypingTimeRef={lastTypingTimeRef}
                      emitCommentAdd={emitCommentAdd}
                      emitCommentUpdate={emitCommentUpdate}
                      emitCommentDelete={emitCommentDelete}
                      emitSuggestionAdd={emitSuggestionAdd}
                      emitSuggestionUpdate={emitSuggestionUpdate}
                      emitSuggestionDelete={emitSuggestionDelete}
                      handleReview={async () => {
                        await manualSaveContent();
                        await handleReview();
                      }}
                      handleApprove={async () => {
                        await manualSaveContent();
                        const ok = await handleApprove();
                        if (ok) onCancel();
                      }}
                      setShowRejectionModal={setShowRejectionModal}
                      isReviewing={isReviewing}
                      isApproving={isApproving}
                      isRejecting={isRejecting}
                      readOnly={readOnly || isReferenceView || LOCKED_DOCUMENT_STATUSES.includes(String(parsedTemplate?.status || document?.status || '').toLowerCase())}
                      isReferenceView={isReferenceView}
                    />
                  )}
                </TabPane>

                <TabPane 
                  tab={<span><FileTextOutlined /> Structure</span>} 
                  key="structure"
                >
                  <TemplateStructureTab parsedTemplate={parsedTemplate} references={references} />
                </TabPane>

                <TabPane 
                  tab={<span><TeamOutlined /> Approvers</span>} 
                  key="approvers"
                >
                  <TemplateApproversTab 
                    parsedTemplate={parsedTemplate}
                    departments={departments}
                    users={users}
                    getCurrentUsersToShow={getCurrentUsersToShow}
                    workflowApprovers={documentWorkflowApprovers}
                    setWorkflowApprovers={handleWorkflowApproversChange}
                    isAuthor={currentUser && parsedTemplate ? String(currentUser.id) === String(parsedTemplate.created_by) : false}
                    isAdmin={currentUser?.role === 'admin'}
                    reviewerRoleSlug="document_reviewer"
                    approverRoleSlug="document_approver"
                  />
                </TabPane>

                <TabPane 
                  tab={<span><HistoryOutlined /> Activity</span>} 
                  key="activity"
                >
                  <TemplateActivityTab 
                    comments={comments}
                    suggestions={suggestions}
                    references={references}
                  />
                </TabPane>

                <TabPane 
                  tab={<span><MessageOutlined /> Notes</span>} 
                  key="notes"
                >
                  <TemplateNotesTab 
                    parsedTemplate={parsedTemplate} 
                    associationType="document"
                    currentUser={currentUser}
                    onNotesChange={(newNotes) => setParsedTemplate(prev => ({ ...prev, notes: newNotes }))}
                  />
                </TabPane>

                <TabPane 
                  tab={<span><PaperClipOutlined /> Attachments</span>} 
                  key="attachments"
                >
                  <AttachmentsTab 
                    associationType="document" 
                    associationId={parsedTemplate?.document_id || parsedTemplate?.id} 
                    canEdit={canEditAttachments} 
                    status={parsedTemplate?.status}
                  />
                </TabPane>

                <TabPane 
                  tab={<span><BookOutlined /> References</span>} 
                  key="references"
                >
                  <ReferencesTab 
                    references={references} 
                    manualReferences={manualReferences}
                    onReferencesChange={handleReferencesChange}
                    onManualReferencesChange={handleManualReferencesChange}
                    canEdit={canEditReferences}
                    onReferenceClick={(refId) => {
                      // Scroll to reference in editor
                      const el = document.querySelector(`[data-reference-id="${refId}"]`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.classList.add('reference-highlight-glow');
                        setTimeout(() => el.classList.remove('reference-highlight-glow'), 2000);
                      }
                    }}
                  />
                </TabPane>

                <TabPane 
                  tab={<span><TeamOutlined /> Impact</span>} 
                  key="impact"
                >
                  <TemplateImpactTab parsedTemplate={parsedTemplate} currentUser={currentUser} />
                </TabPane>

                {isAuthor && (
                  <TabPane 
                    tab={
                      <Badge dot status={parsedTemplate.status === 'draft' ? 'error' : 'success'} offset={[5, 0]}>
                        <FileSearchOutlined /> Review
                      </Badge>
                    } 
                    key="review"
                  >
                  <Card 
                    bordered={false} 
                    title={
                      <span>
                        Review Document Configuration
                        <Tooltip title="Review document settings and submit for workflow transitions">
                          <InfoCircleOutlined style={{ marginLeft: 8 }} />
                        </Tooltip>
                      </span>
                    }
                  >
                    <Row gutter={[16, 16]}>
                      <Col span={24}>
                        <Card size="small" title="Basic Information">
                          <p><strong>Title:</strong> {parsedTemplate.title || parsedTemplate.name || 'Not specified'}</p>
                          <p><strong>Status:</strong> <Tag color="blue">{parsedTemplate.status?.replace('_', ' ').toUpperCase()}</Tag></p>
                          <div style={{ marginTop: 24 }}>
                            <Button 
                              type="primary" 
                              onClick={() => {
                                setApproverType('review');
                                setDocumentApproversModalVisible(true);
                              }}
                            >
                              Submit for Review
                            </Button>
                            <Button 
                              style={{ marginLeft: 12 }}
                              onClick={() => {
                                setApproverType('approval');
                                setDocumentApproversModalVisible(true);
                              }}
                            >
                              Submit for Approval
                            </Button>
                          </div>
                        </Card>
                      </Col>
                    </Row>
                  </Card>
                </TabPane>
                )}
              </Tabs>
            </div>
          )}
        </div>

        <TemplateApproversModal
          visible={documentApproversModalVisible}
          onCancel={() => setDocumentApproversModalVisible(false)}
          approverType={approverType}
          setApproverType={setApproverType}
          sharedDueDate={sharedDueDate}
          setSharedDueDate={setSharedDueDate}
          templateApprovers={documentWorkflowApprovers}
          users={users}
          handleAddTemplateApprover={handleAddDocumentApprover}
          handleRemoveTemplateApprover={handleRemoveDocumentApprover}
          entityLabel="Document"
          reviewerRoleSlug="document_reviewer"
          approverRoleSlug="document_approver"
          onSubmit={async () => {
            if (!sharedDueDate) {
              errorAlert('Submission Failed', 'Please select a due date');
              return;
            }
            const finalStatus = approverType === 'review' ? 'pending_review' : 'pending_approval';
            setDocumentApproversModalVisible(false);
            const ok = await handleSubmitWorkflow(finalStatus);
            if (ok) {
              onCancel();
            } else {
              setDocumentApproversModalVisible(true);
            }
          }}
        />

        <UnaddressedCommentsWarningModal
          open={warningModalVisible}
          entityLabel="Document"
          onGoBack={() => {
            setWarningModalVisible(false);
            setPendingApprovalFn(null);
          }}
          onProceed={() => {
            setWarningModalVisible(false);
            if (pendingApprovalFn) {
              pendingApprovalFn();
              setPendingApprovalFn(null);
            }
          }}
        />

        <ReviewPendingModal
          visible={reviewGuardModalVisible}
          pendingInfo={reviewGuardPendingInfo}
          onStay={handleReviewGuardStay}
          onLeaveAnyway={handleReviewGuardLeave}
        />

        <RejectionModal
          visible={showRejectionModal}
          onCancel={() => setShowRejectionModal(false)}
          onReject={async () => {
            const ok = await handleReject();
            if (ok && onCancel) onCancel();
          }}
          rejectionComment={rejectionComment}
          setRejectionComment={setRejectionComment}
          isRejecting={isRejecting}
          entityType="Document"
        />
      </div>
    </div>
  );
};

DocumentPreview.propTypes = {
  document: PropTypes.object.isRequired,
  categories: PropTypes.array,
  users: PropTypes.array,
  departments: PropTypes.array,
  currentUser: PropTypes.object,
  onCancel: PropTypes.func.isRequired,
  readOnly: PropTypes.bool
};

DocumentPreview.defaultProps = {
  categories: [],
  users: [],
  departments: []
};

export default DocumentPreview;
