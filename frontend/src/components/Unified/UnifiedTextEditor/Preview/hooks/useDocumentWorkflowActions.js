import { useState } from 'react';
import apiClient from '../../../../../api/apiClient';
import { successAlert, errorAlert } from '../../../../../utils/alerts';

export const useDocumentWorkflowActions = (parsedTemplate, setParsedTemplate, currentUser) => {
  const [isReviewing, setIsReviewing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionComment, setRejectionComment] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);

  const documentId = parsedTemplate?.document_id || parsedTemplate?.id;

  const handleReview = async () => {
    if (!documentId) return false;
    setIsReviewing(true);
    try {
      const res = await apiClient.put(`/api/document_review/${documentId}`, {
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userName: `${currentUser?.first_name} ${currentUser?.last_name}`,
        action: 'review'
      });

      if (res.data?.success) {
        setParsedTemplate((prev) => ({
          ...prev,
          status: res.data.status,
          template_approvers: res.data.template_approvers
        }));
      }

      return true;
    } catch (error) {
      console.error('Error reviewing document:', error);
      errorAlert('Error', 'Failed to review document. Please try again.');
      return false;
    } finally {
      setIsReviewing(false);
    }
  };

  const handleApprove = async () => {
    if (!documentId) return false;
    setIsApproving(true);
    try {
      const res = await apiClient.put(`/api/document_approve/${documentId}`, {
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userName: `${currentUser?.first_name} ${currentUser?.last_name}`,
        action: 'approve'
      });

      if (res.data?.success) {
        setParsedTemplate((prev) => ({
          ...prev,
          status: res.data.status,
          template_approvers: res.data.template_approvers
        }));
      }

      return await successAlert('Document Approved', 'The document has been approved.');
    } catch (error) {
      console.error('Error approving document:', error);
      errorAlert('Error', 'Failed to approve document. Please try again.');
      return false;
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!documentId) return false;
    setIsRejecting(true);
    try {
      const res = await apiClient.put(`/api/document_reject/${documentId}`, {
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userName: `${currentUser?.first_name} ${currentUser?.last_name}`,
        action: 'reject',
        comment: rejectionComment
      });

      if (res.data?.success) {
        setParsedTemplate((prev) => ({
          ...prev,
          status: res.data.status,
          template_approvers: res.data.template_approvers
        }));
      }

      setShowRejectionModal(false);
      setRejectionComment('');
      const result = await successAlert('Document Rejected', 'The document has been rejected with your comments.');
      return result;
    } catch (error) {
      console.error('Error rejecting document:', error);
      errorAlert('Error', 'Failed to reject document. Please try again.');
      return false;
    } finally {
      setIsRejecting(false);
    }
  };

  const updateMetadata = async (metadata) => {
    if (!documentId) return false;
    try {
      const payload = {};
      if (metadata.name !== undefined) {
        payload.title = metadata.name;
      }
      if (metadata.description !== undefined) {
        payload.description = metadata.description;
      }

      if (Object.keys(payload).length === 0) {
        return false;
      }

      const response = await apiClient.put(`/api/update_document/${documentId}`, payload);
      if (response.data?.success) {
        setParsedTemplate((prev) => ({
          ...prev,
          ...metadata,
          title: metadata.name ?? prev?.title,
          name: metadata.name ?? prev?.name,
        }));
        successAlert('Success', 'Information updated successfully');
        return true;
      }
    } catch (error) {
      console.error('Error updating document metadata:', error);
      errorAlert('Update Failed', 'There was an error updating the document information.');
      return false;
    }
    return false;
  };

  const handleReassign = async (newUser) => {
    if (!documentId) return false;
    try {
      const res = await apiClient.put(`/api/documents/${documentId}/reassign`, {
        currentUserId: currentUser?.id,
        newUser: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          department: newUser.department
        }
      });

      if (res.data?.success) {
        setParsedTemplate((prev) => ({
          ...prev,
          template_approvers: res.data.template_approvers,
          required_approvers: res.data.required_approvers || prev.required_approvers
        }));
        successAlert('Success', 'Document authority reassigned successfully.');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error reassigning document:', error);
      errorAlert('Error', error.response?.data?.error || 'Failed to reassign document.');
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
    handleReassign
  };
};
