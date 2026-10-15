import { useState } from 'react';
import apiClient from '../../../../../api/apiClient';
import { Modal } from 'antd';
import { successAlert, errorAlert } from '../../../../../utils/alerts';

export const useTemplateActions = (parsedTemplate, setParsedTemplate, currentUser) => {
  const [isReviewing, setIsReviewing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionComment, setRejectionComment] = useState("");
  const [showRejectionModal, setShowRejectionModal] = useState(false);

  const templateId = parsedTemplate?.id || parsedTemplate?.template_id;

  const handleReview = async () => {
    if (!templateId) return;
    setIsReviewing(true);
    try {
      const res = await apiClient.put(`/api/template_review/${templateId}`, {
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userName: `${currentUser?.firstName} ${currentUser?.lastName}`,
        action: 'review'
      });
      
      const serverApprovers = res.data?.templateApprovers;
      const serverStatus = res.data?.status;

      setParsedTemplate(prev => {
        if (serverApprovers) {
          return {
            ...prev,
            status: serverStatus || prev.status,
            template_approvers: serverApprovers
          };
        }
        const nowIso = new Date().toISOString();
        const updatedReviewers = prev.template_approvers?.reviewers ? prev.template_approvers.reviewers.map(reviewer => {
          if (reviewer.email === currentUser?.email) {
            return { ...reviewer, status: 'Reviewed', reviewedAt: nowIso, actionDate: nowIso };
          }
          return reviewer;
        }) : [];
        const allReviewed = updatedReviewers.length > 0 && updatedReviewers.every(r => r.status === 'Reviewed');
        return {
          ...prev,
          status: allReviewed ? 'reviewed' : 'pending_review',
          template_approvers: { ...(prev.template_approvers || {}), reviewers: updatedReviewers }
        };
      });
      
      return true;
    } catch (error) {
      console.error('Error reviewing template:', error);
      errorAlert('Error', 'Failed to review template. Please try again.');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleApprove = async () => {
    if (!templateId) return;
    setIsApproving(true);
    try {
      const res = await apiClient.put(`/api/template_approve/${templateId}`, {
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userName: `${currentUser?.firstName} ${currentUser?.lastName}`,
        action: 'approve'
      });
      
      const serverApprovers = res.data?.templateApprovers;
      const serverStatus = res.data?.status;

      setParsedTemplate(prev => {
        if (serverApprovers) {
          return {
            ...prev,
            status: serverStatus || 'approved',
            template_approvers: serverApprovers
          };
        }
        const nowIso = new Date().toISOString();
        const updatedApprovers = prev.template_approvers?.approvers ? prev.template_approvers.approvers.map(approver => {
          if (approver.email === currentUser?.email) {
            return { ...approver, status: 'Approved', approvedAt: nowIso, actionDate: nowIso };
          }
          return approver;
        }) : [];
        const allApproved = updatedApprovers.length > 0 && updatedApprovers.every(a => a.status === 'Approved');
        return {
          ...prev,
          status: allApproved ? 'approved' : 'pending_approval',
          template_approvers: { ...(prev.template_approvers || {}), approvers: updatedApprovers }
        };
      });
      
      return successAlert('Template Approved', 'The template has been successfully approved.');
    } catch (error) {
      console.error('Error approving template:', error);
      errorAlert('Error', 'Failed to approve template. Please try again.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!templateId) return;
    setIsRejecting(true);
    try {
      const res = await apiClient.put(`/api/template_reject/${templateId}`, {
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userName: `${currentUser?.firstName} ${currentUser?.lastName}`,
        action: 'reject',
        comment: rejectionComment
      });
      
      const newStatus = res?.data?.status || 'pending_review';
      setParsedTemplate(prev => {
        const updatedApprovers = prev.template_approvers?.approvers ? prev.template_approvers.approvers.map(approver => {
          if (approver.email === currentUser?.email) {
            return { ...approver, status: 'Rejected', comment: rejectionComment };
          }
          return approver;
        }) : [];
        return {
          ...prev,
          status: newStatus,
          template_approvers: { ...(prev.template_approvers || {}), approvers: updatedApprovers }
        };
      });
      
      setShowRejectionModal(false);
      setRejectionComment("");
      return successAlert('Template Rejected', 'The template has been rejected with your comments.');
    } catch (error) {
      console.error('Error rejecting template:', error);
      errorAlert('Error', 'Failed to reject template. Please try again.');
    } finally {
      setIsRejecting(false);
    }
  };

  const updateMetadata = async (metadata) => {
    if (!templateId) return;
    try {
      const response = await apiClient.put(`/api/update_template_metadata/${templateId}`, metadata);
      if (response.data.success) {
        setParsedTemplate(prev => ({ ...prev, ...metadata }));
        successAlert('Success', 'Information updated successfully');
        return true;
      }
    } catch (error) {
      console.error('Error updating template metadata:', error);
      errorAlert('Update Failed', 'There was an error updating the template configuration.');
      return false;
    }
  };

const cleanApproverEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return entry;
  const { reviewedAt, approvedAt, rejectedAt, reviewedBy, approvedBy, rejectedBy, signature, comment, rejection_reason, ...rest } = entry;
  return { ...rest, status: 'pending' };
};

const sanitizeWorkflowApprovers = (approversData, targetStatus) => {
  if (!approversData || typeof approversData !== 'object') return approversData;
  const updated = { ...approversData };
  if (targetStatus === 'draft' || targetStatus === 'pending_revision' || targetStatus === 'pending_review') {
    if (Array.isArray(updated.reviewers)) {
      updated.reviewers = updated.reviewers.map(cleanApproverEntry);
    }
    if (Array.isArray(updated.approvers)) {
      updated.approvers = updated.approvers.map(cleanApproverEntry);
    }
  } else if (targetStatus === 'pending_approval') {
    if (Array.isArray(updated.approvers)) {
      updated.approvers = updated.approvers.map(cleanApproverEntry);
    }
  }
  return updated;
};

  const handleSubmit = async (status, templateApproversOverride = null) => {
    if (!templateId) return;
    
    try {
      // Exclude raw `comments` and `content` columns — those are managed by
      // manualSaveContent via /api/update_template_content and must not be
      // overwritten here with stale data from parsedTemplate.
      const { comments: _rawComments, content: _rawContent, ...templateBase } = parsedTemplate;
      let rawApprovers = templateApproversOverride || parsedTemplate.template_approvers;
      if (['draft', 'pending_revision', 'pending_review', 'pending_approval'].includes(status)) {
        rawApprovers = sanitizeWorkflowApprovers(rawApprovers, status);
      }
      const templateData = {
        ...templateBase,
        status: status,
        template_approvers: rawApprovers
      };

      const response = await apiClient.put(`/api/update_template/${templateId}`, templateData);
      
      if (response.data.success) {
        const savedApprovers = response.data?.template_approvers || rawApprovers;
        setParsedTemplate(prev => ({ 
          ...prev, 
          status: status,
          template_approvers: savedApprovers
        }));
        return successAlert(
          status === 'published' ? 'Template Published' : status === 'draft' ? 'Draft Saved' : 'Template Submitted', 
          `The template has been ${status === 'published' ? 'published' : status === 'draft' ? 'saved as a draft' : 'submitted for workflow'} successfully.`
        );
      }
    } catch (error) {
      console.error('Error submitting template:', error);
      errorAlert(
        'Submission Failed', 
        error.response?.data?.message || 'There was an error updating your template status.' 
      );
      return false;
    }
  };

  const handleRevertReviewersStatus = async (emails = null) => {
    if (!templateId) return;
    try {
      const response = await apiClient.put(`/api/template_revert_reviewers/${templateId}`, { emails });
      if (response.data.success) {
        setParsedTemplate(prev => {
          const shouldRevertAll = !emails || !Array.isArray(emails) || emails.length === 0;
          const updatedReviewers = (prev.template_approvers?.reviewers || []).map(reviewer => {
            const matchesTarget = shouldRevertAll || emails.includes(reviewer.email);
            if (matchesTarget && reviewer.status === 'Reviewed') {
              const { reviewedAt, ...rest } = reviewer;
              return { ...rest, status: 'pending' };
            }
            return reviewer;
          });

          let newStatus = prev.status;
          const hasAnyPendingReviewer = updatedReviewers.some(r => r.status === 'pending');
          if (hasAnyPendingReviewer && newStatus === 'reviewed') {
            newStatus = 'pending_review';
          }

          return {
            ...prev,
            status: newStatus,
            template_approvers: { ...prev.template_approvers, reviewers: updatedReviewers }
          };
        });
        successAlert('Success', "Reviewers' status reverted successfully.");
        return true;
      }
    } catch (error) {
      console.error('Error reverting reviewers status:', error);
      errorAlert('Error', 'Failed to revert reviewers status.');
      return false;
    }
  };

  return {
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
    handleSubmit,
    handleRevertReviewersStatus
  };
};
