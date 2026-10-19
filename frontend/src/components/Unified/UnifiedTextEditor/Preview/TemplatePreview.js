import React, { useRef } from 'react';
import { Tabs, Spin, message, Modal, Radio, Checkbox, Space, Tag } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import moment from 'moment';
import PropTypes from 'prop-types';

import '../../../Home/components/Dashboard/Templates/CommentsSuggestionsFixes.css';
import './TemplatePreview.css';

// Hooks
import { useTemplatePreviewState } from './hooks/useTemplatePreviewState';
import { useTemplateActions } from './hooks/useTemplateActions';
import { useTemplateContent } from './hooks/useTemplateContent';
import useWorkflowNavigationGuard from './hooks/useWorkflowNavigationGuard';

// Components
import TemplatePreviewHeader from './components/TemplatePreviewHeader';
import TemplateOverviewTab from './components/TemplateOverviewTab';
import OverviewProgressTab from './components/OverviewProgressTab';
import TemplateContentTab from './components/TemplateContentTab';
import TemplateStructureTab from './components/TemplateStructureTab';
import TemplateApproversTab from './components/TemplateApproversTab';
import TemplateActivityTab from './components/TemplateActivityTab';
import TemplateNotesTab from './components/TemplateNotesTab';
import TemplateReviewTab from './components/TemplateReviewTab';
import TemplateRevisionHistoryTab from './components/TemplateRevisionHistoryTab';
import AttachmentsTab from './components/AttachmentsTab';
import ReferencesTab from './components/ReferencesTab';
import RejectionModal from './components/RejectionModal';
import TemplateApproversModal from '../../../Home/components/Dashboard/Templates/CreateTemplate/components/TemplateApproversModal';
import UnaddressedCommentsWarningModal from '../../UnifiedCommentSystem/components/UnaddressedCommentsWarningModal';
import { hasUnaddressedItems } from '../../UnifiedCommentSystem/utils/unaddressedCommentsHelper';
import ReviewPendingModal from './components/ReviewPendingModal';

// Lock content once past the review phase (pending_approval and beyond).
// Documents in 'pending_review' remain editable so reviewers can add comments/suggestions.
// A rejected template goes back to 'pending_review' too, so an unresolved rejection on it keeps
// the content editable for the author to address it.
// NOTE: 'reviewed' is NOT locked - reviewers can continue editing and will auto-revert to 'pending_review' on typing
const LOCKED_TEMPLATE_STATUSES = ['pending_approval', 'approved', 'published', 'active', 'revised'];

const parseWorkflowParticipants = (raw) => {
  if (!raw) return { reviewers: [], approvers: [] };
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { reviewers: [], approvers: [] };
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { reviewers: [], approvers: [] };
  return {
    reviewers: Array.isArray(parsed.reviewers) ? parsed.reviewers : [],
    approvers: Array.isArray(parsed.approvers) ? parsed.approvers : [],
  };
};

const { TabPane } = Tabs;

const TemplatePreview = ({ 
  template, 
  categories, 
  users,
  departments,
  currentUser,
  onCancel,
  onRevise,
  onArchive,
  readOnly = false
}) => {
  // State Hook
  const { 
    loading, 
    parsedTemplate, 
    setParsedTemplate, 
    initialData 
  } = useTemplatePreviewState(template, currentUser);

  const templateStatus = String(parsedTemplate?.status || '').toLowerCase();
  const { reviewers: tplReviewers, approvers: tplApprovers } = parseWorkflowParticipants(parsedTemplate?.template_approvers);
  const hasUnresolvedRejection = [...tplReviewers, ...tplApprovers].some(
    (participant) => String(participant?.status || '').toLowerCase() === 'rejected'
  );
  const isLockedWorkflowStatus = LOCKED_TEMPLATE_STATUSES.includes(templateStatus) && !hasUnresolvedRejection;
  const isReadOnly = readOnly || isLockedWorkflowStatus;

  // Actions Hook
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
    handleSubmit: apiSubmit,
    handleRevertReviewersStatus
  } = useTemplateActions(parsedTemplate, setParsedTemplate, currentUser);

  // Workflow State
  const [templateApproversModalVisible, setTemplateApproversModalVisible] = React.useState(false);
  const [templateApprovers, setTemplateApprovers] = React.useState({
    reviewers: [],
    approvers: []
  });
  const [approverType, setApproverType] = React.useState('review');
  const [sharedDueDate, setSharedDueDate] = React.useState(null);
  const isApprovalStage = ['pending_approval', 'approved'].includes(String(parsedTemplate?.status || '').toLowerCase());
  const [cleanView, setCleanView] = React.useState(() => isApprovalStage ? 'accepted' : false);
  const [revertModalVisible, setRevertModalVisible] = React.useState(false);
  const [revertOption, setRevertOption] = React.useState('all');
  const [selectedReviewers, setSelectedReviewers] = React.useState([]);

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

  // Warning modal — shown before approval modal when unaddressed items exist
  const [warningModalVisible, setWarningModalVisible] = React.useState(false);
  const [pendingApprovalFn, setPendingApprovalFn] = React.useState(null);

  // Refs — declared BEFORE useTemplateContent so the hook can read fresh DOM HTML
  const pagesContainerRef = useRef(null);

  // Content Hook
  const {
    contentHtml,
    setContentHtml,
    contentLoaded,
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
    // lastSavedContent,
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
  } = useTemplateContent(parsedTemplate, initialData, currentUser, pagesContainerRef, setParsedTemplate);



  // Sync templateApprovers from parsedTemplate on load
  React.useEffect(() => {
    if (parsedTemplate?.template_approvers) {
      setTemplateApprovers({
        reviewers: parsedTemplate.template_approvers.reviewers || [],
        approvers: parsedTemplate.template_approvers.approvers || []
      });
    }
  }, [parsedTemplate]);

  // Default clean view with accepted suggestions when in approval status
  React.useEffect(() => {
    const s = String(parsedTemplate?.status || '').toLowerCase();
    if (s === 'pending_approval' || s === 'approved') {
      setCleanView('accepted');
    }
  }, [parsedTemplate?.status]);

  const isAuthor = currentUser && parsedTemplate ? String(currentUser.id) === String(parsedTemplate.created_by) : false;
  const canEditAttachments = (isAuthor || (currentUser && currentUser.role === 'admin')) && ['draft', 'pending_revision'].includes(parsedTemplate?.status);
  const canEditReferences = canEditAttachments; // Same logic as attachments

  // Handlers for workflow
  const handleAddTemplateApprover = (userId) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
  
    const newApprover = {
      userId,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      department: user.department || '',
      role: approverType === 'review' ? 'template_reviewer' : 'template_approver',
      status: 'pending',
      dueDate: sharedDueDate,
      ...(approverType === 'approval' && { comment: '' })
    };
  
    const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
    
    if (!templateApprovers[targetArray].some(approver => approver.userId === userId)) {
      setTemplateApprovers(prev => ({
        ...prev,
        [targetArray]: [...prev[targetArray], newApprover]
      }));
    }
  };
  
  const handleRemoveTemplateApprover = (userId) => {
    const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
    setTemplateApprovers(prev => ({
      ...prev,
      [targetArray]: prev[targetArray].filter(approver => approver.userId !== userId)
    }));
  };

  const handleHeaderSubmit = async (status) => {
    if (status === 'draft') {
      await manualSaveContent();
      const result = await apiSubmit('draft');
      if (result && onCancel) onCancel();
      return;
    }

    if (status === 'published') {
      await manualSaveContent();
      const result = await apiSubmit('published');
      if (result && onCancel) onCancel();
      return;
    }

    const openApproversModal = async () => {
      // Save content right before opening the approvers modal
      await manualSaveContent();
      const targetType = status === 'pending_review' ? 'review' : 'approval';
      setApproverType(targetType);

      if (!sharedDueDate) {
        const list = targetType === 'review'
          ? (templateApprovers?.reviewers || parsedTemplate?.template_approvers?.reviewers || [])
          : (templateApprovers?.approvers || parsedTemplate?.template_approvers?.approvers || []);
        const existingDue = list.find(a => a.dueDate)?.dueDate || parsedTemplate?.due_date || parsedTemplate?.dueDate;
        if (existingDue && moment(existingDue).isValid() && moment(existingDue).isSameOrAfter(moment().startOf('day'))) {
          setSharedDueDate(moment(existingDue));
        }
      }

      setTemplateApproversModalVisible(true);
    };

    if (status === 'pending_approval' && hasUnaddressedItems({ comments, suggestions }, { template_approvers: parsedTemplate?.template_approvers || templateApprovers })) {
      setPendingApprovalFn(() => openApproversModal);
      setWarningModalVisible(true);
    } else {
      openApproversModal();
    }
  };

  // Helper
  const getCategoryDetails = (categoryId) => {
    return categories.find(c => c.category_id === categoryId) || {};
  };

  const getCurrentUsersToShow = () => {
    if (!parsedTemplate?.template_approvers) return [];
    
    const status = parsedTemplate.status;
    
    if (status === 'pending_review' || status === 'reviewed') {
      return parsedTemplate.template_approvers.reviewers || [];
    } else if (status === 'pending_approval' || status === 'approved' || status === 'rejected') {
      return parsedTemplate.template_approvers.approvers || [];
    }
    
    return [];
  };

  // Do not mount the editor until GET finished — see utils/editorContentGuards.js.
  const contentTabPanel = !contentLoaded ? (
    <div style={{ textAlign: 'center', padding: '100px 0' }}>
      <Spin size="large" />
      <div style={{ marginTop: 16 }}>Loading editor content...</div>
    </div>
  ) : (
    <TemplateContentTab
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
        if (!currentUser || !parsedTemplate) return 'viewer';
        if (String(currentUser.id) === String(parsedTemplate.created_by)) return 'admin';
        const isReviewer = parsedTemplate.template_approvers?.reviewers?.some(
          (r) => String(r.userId) === String(currentUser.id) || r.email === currentUser.email
        );
        return isReviewer ? 'reviewer' : 'viewer';
      })()}
      socketUpdateKey={socketUpdateKey}
      pagesContainerRef={pagesContainerRef}
      setContentHtml={setContentHtml}
      handleCommentsChange={handleCommentsChange}
      handleSuggestionsChange={handleSuggestionsChange}
      references={references}
      handleReferencesChange={handleReferencesChange}
      emitCommentAdd={emitCommentAdd}
      emitCommentUpdate={emitCommentUpdate}
      emitCommentDelete={emitCommentDelete}
      emitSuggestionAdd={emitSuggestionAdd}
      emitSuggestionUpdate={emitSuggestionUpdate}
      emitSuggestionDelete={emitSuggestionDelete}
      lastTypingTimeRef={lastTypingTimeRef}
      handleReview={async () => {
        await manualSaveContent();
        await handleReview();
      }}
      handleApprove={async () => {
        await manualSaveContent();
        const result = await handleApprove();
        if (result) onCancel();
      }}
      setShowRejectionModal={setShowRejectionModal}
      isReviewing={isReviewing}
      isApproving={isApproving}
      isRejecting={isRejecting}
      readOnly={isReadOnly}
    />
  );

  return (
    <div className="create-template-tabs">
      <div className={`template-page ${cleanView ? `clean-view clean-view-${cleanView === 'rejected' ? 'rejected' : 'accepted'}` : ''}`}>
        {/* Content */}
        <div className="template-page-content">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>Loading template...</div>
            </div>
          ) : (
            <div className="template-content">
              <Tabs 
                defaultActiveKey="content" 
                type="card"
                tabBarExtraContent={
                  <TemplatePreviewHeader 
                    parsedTemplate={parsedTemplate}
                    currentUser={currentUser}
                    onCancel={handleGuardedCancel}
                    onRevise={onRevise}
                    onArchive={onArchive}
                    readOnly={isReadOnly}
                    manualSaveContent={manualSaveContent}
                    isSaving={isSaving}
                    handleReview={async () => {
                      await manualSaveContent();
                      await handleReview();
                    }}
                    handleApprove={async () => {
                      await manualSaveContent();
                      const result = await handleApprove();
                      if (result) onCancel();
                    }}
                    handleReject={async () => {
                      await manualSaveContent();
                      const result = await handleReject();
                      if (result) onCancel();
                    }}
                    setShowRejectionModal={setShowRejectionModal}
                    isReviewing={isReviewing}
                    isApproving={isApproving}
                    isRejecting={isRejecting}
                    handleSubmit={handleHeaderSubmit}
                    handleRevertReviewersStatus={() => setRevertModalVisible(true)}
                    cleanView={cleanView}
                    setCleanView={setCleanView}
                    users={users}
                    departments={departments}
                  />
                }
              >
                <TabPane tab="Overview" key="overview">
                   <TemplateOverviewTab 
                     parsedTemplate={parsedTemplate} 
                     getCategoryDetails={getCategoryDetails} 
                     categories={categories}
                     updateMetadata={updateMetadata}
                     isAuthor={isAuthor}
                     currentUser={currentUser}
                     users={users}
                     entityLabel="Template"
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
                    entityLabel="Template"
                  />
                </TabPane>

                <TabPane tab="Content" key="content">
                  {contentTabPanel}
                </TabPane>

                {parsedTemplate?.status === 'published' && (
                  <TabPane tab="Revision History" key="revisionHistory">
                    <TemplateRevisionHistoryTab 
                      templateId={parsedTemplate?.id}
                      currentVersion={parsedTemplate?.version}
                    />
                  </TabPane>
                )}

                <TabPane tab="Structure" key="structure">
                  <TemplateStructureTab 
                    parsedTemplate={parsedTemplate} 
                    contentHtml={contentHtml}
                    comments={comments}
                    suggestions={suggestions}
                    references={references}
                  />
                </TabPane>

                <TabPane tab="Approvers" key="approvers">
                   <TemplateApproversTab 
                     parsedTemplate={parsedTemplate}
                     departments={departments}
                     users={users}
                     getCurrentUsersToShow={getCurrentUsersToShow}
                     isAuthor={isAuthor}
                     updateMetadata={updateMetadata}
                   />
                </TabPane>

                <TabPane tab="Activity" key="activity">
                  <TemplateActivityTab 
                    comments={comments}
                    suggestions={suggestions}
                    references={references}
                  />
                </TabPane>

                  <TabPane tab="Notes" key="notes">
                    <TemplateNotesTab 
                      parsedTemplate={parsedTemplate} 
                      associationType="template"
                      currentUser={currentUser}
                      onNotesChange={(newNotes) => setParsedTemplate(prev => ({ ...prev, notes: newNotes }))}
                    />
                  </TabPane>

                 <TabPane tab="Attachments" key="attachments">
                   <AttachmentsTab 
                     associationType="template" 
                     associationId={parsedTemplate?.id} 
                     canEdit={canEditAttachments} 
                   />
                 </TabPane>

                  <TabPane tab="References" key="references">
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

                  {(isAuthor || (currentUser && currentUser.role === 'admin')) && (
                    <TabPane tab="Review" key="review">
                      <TemplateReviewTab 
                        parsedTemplate={parsedTemplate}
                        approvers={[...templateApprovers.reviewers, ...templateApprovers.approvers]}
                        departments={departments}
                        categories={categories}
                        handleSubmit={async (status) => {
                          const result = await apiSubmit(status);
                          if (result) onCancel();
                        }}
                        canSubmit={true}
                        showTemplateApproversModal={(type) => {
                          const targetType = type || 'review';
                          const openModal = () => {
                            setApproverType(targetType);
                            if (!sharedDueDate) {
                              const list = targetType === 'review'
                                ? (templateApprovers?.reviewers || parsedTemplate?.template_approvers?.reviewers || [])
                                : (templateApprovers?.approvers || parsedTemplate?.template_approvers?.approvers || []);
                              const existingDue = list.find(a => a.dueDate)?.dueDate || parsedTemplate?.due_date || parsedTemplate?.dueDate;
                              if (existingDue && moment(existingDue).isValid() && moment(existingDue).isSameOrAfter(moment().startOf('day'))) {
                                setSharedDueDate(moment(existingDue));
                              }
                            }
                            setTemplateApproversModalVisible(true);
                          };
                          if (targetType === 'approval' && hasUnaddressedItems({ comments, suggestions }, { template_approvers: parsedTemplate?.template_approvers || templateApprovers })) {
                            setPendingApprovalFn(() => openModal);
                            setWarningModalVisible(true);
                          } else {
                            openModal();
                          }
                        }}
                        setApproverType={setApproverType}
                        handleRevertReviewersStatus={() => setRevertModalVisible(true)}
                        currentUser={currentUser}
                      />
                    </TabPane>
                  )}
              </Tabs>
            </div>
          )}
        </div>

          <TemplateApproversModal 
            visible={templateApproversModalVisible}
            onCancel={() => setTemplateApproversModalVisible(false)}
            approverType={approverType}
            setApproverType={setApproverType}
            sharedDueDate={sharedDueDate}
            setSharedDueDate={setSharedDueDate}
            templateApprovers={templateApprovers}
            users={users}
            handleAddTemplateApprover={handleAddTemplateApprover}
            handleRemoveTemplateApprover={handleRemoveTemplateApprover}
            onSubmit={async () => {
              if (!sharedDueDate) {
                message.error('Please select a due date');
                return;
              }
              const finalStatus = approverType === 'review' ? 'pending_review' : 'pending_approval';
              
              // Save editor content first
              await manualSaveContent();

              const updatedApprovers = { ...templateApprovers };
              // Reset ALL reviewers and approvers to 'pending' on resubmission
              // so previously rejected/approved users get a clean slate
              updatedApprovers.reviewers = (updatedApprovers.reviewers || []).map(a => {
                const { rejectedAt, reviewedAt, approvedAt, comment: _comment, ...rest } = a;
                return {
                  ...rest,
                  status: 'pending',
                  dueDate: sharedDueDate
                };
              });
              updatedApprovers.approvers = (updatedApprovers.approvers || []).map(a => {
                const { rejectedAt, reviewedAt, approvedAt, comment: _comment, ...rest } = a;
                return {
                  ...rest,
                  status: 'pending',
                  dueDate: sharedDueDate
                };
              });

              // Close the modal immediately before submitting so the success confirmation modal is cleanly in front
              setTemplateApproversModalVisible(false);

              const result = await apiSubmit(finalStatus, updatedApprovers);
              if (result) {
                onCancel();
              } else {
                setTemplateApproversModalVisible(true);
              }
            }}
          />

          <Modal
            title="Update Review Status"
            visible={revertModalVisible}
            onCancel={() => {
              setRevertModalVisible(false);
              setSelectedReviewers([]);
              setRevertOption('all');
            }}
            onOk={async () => {
              const targetEmails = revertOption === 'all' ? null : selectedReviewers;
              if (revertOption === 'selected' && (!targetEmails || targetEmails.length === 0)) {
                message.warning("Please select at least one reviewer.");
                return;
              }
              const success = await handleRevertReviewersStatus(targetEmails);
              if (success) {
                setRevertModalVisible(false);
                setSelectedReviewers([]);
                setRevertOption('all');
              }
            }}
            okText="Apply"
            destroyOnClose
          >
            <div style={{ marginBottom: 16 }}>
              Select how you want to update the reviewers' status back to reviewing state:
            </div>
            <Radio.Group 
              onChange={(e) => setRevertOption(e.target.value)} 
              value={revertOption}
              style={{ width: '100%', marginBottom: 16 }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Radio value="all">Update status for all reviewers</Radio>
                <Radio value="selected">Update status for selected reviewers</Radio>
              </Space>
            </Radio.Group>
            
            {revertOption === 'selected' && (
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 4, padding: 12, maxHeight: '250px', overflowY: 'auto' }}>
                <div style={{ fontWeight: 500, marginBottom: 12 }}>Assigned Reviewers:</div>
                <Checkbox.Group 
                  value={selectedReviewers}
                  onChange={(checkedValues) => setSelectedReviewers(checkedValues)}
                  style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  {(parsedTemplate?.template_approvers?.reviewers || []).map((reviewer) => (
                    <Checkbox 
                      key={reviewer.email} 
                      value={reviewer.email}
                    >
                      <span style={{ fontWeight: 500 }}>{reviewer.name}</span> ({reviewer.email}) - <Tag color={reviewer.status === 'Reviewed' ? 'success' : 'processing'}>{reviewer.status}</Tag>
                    </Checkbox>
                  ))}
                </Checkbox.Group>
              </div>
            )}
          </Modal>

          <UnaddressedCommentsWarningModal
            open={warningModalVisible}
            entityLabel="Template"
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
              const result = await handleReject();
              if (result && onCancel) onCancel();
            }}
            rejectionComment={rejectionComment}
            setRejectionComment={setRejectionComment}
            isRejecting={isRejecting}
            entityType="Template"
          />
      </div>
    </div>       
  );
};

TemplatePreview.propTypes = {
  template: PropTypes.object.isRequired,
  categories: PropTypes.array,
  users: PropTypes.array,
  departments: PropTypes.array,
  currentUser: PropTypes.object,
  onCancel: PropTypes.func.isRequired
};
TemplatePreview.defaultProps = {
  categories: [],
  users: [],
  departments: []
};

export default TemplatePreview;