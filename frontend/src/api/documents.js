import apiClient from './apiClient';

export const getAllDocs = async () => {
  const response = await apiClient.get('/api/all-docs');
  return response.data;
};

export const getMyDocs = async (userId) => {
  const response = await apiClient.get(`/api/my-docs/${userId}`);
  return response.data;
};

export const getTemplateUpdateNotice = async (documentId) => {
  const response = await apiClient.get(`/api/template-update-notice/${documentId}`);
  return response.data;
};

export const getDocumentUpdateNotice = async (documentId) => {
  const response = await apiClient.get(`/api/document-update-notice/${documentId}`);
  return response.data;
};

export const createDocument = async (docData) => {
  const response = await apiClient.post('/api/create-document', docData);
  return response.data;
};

export const updateDocumentStatus = async (documentId, status) => {
  const response = await apiClient.put(`/api/update-document-status/${documentId}`, { status });
  return response.data;
};

export const getDocumentById = async (id) => {
  const response = await apiClient.get(`/api/documents/${id}`);
  return response.data;
};

export const updateStatusSimple = async (id, status, extraData = {}) => {
  const response = await apiClient.put(`/api/documents/${id}/status`, { status, ...extraData });
  return response.data;
};

export const getDocument = async (documentId) => {
  const response = await apiClient.get(`/api/get_document/${documentId}`);
  return response.data;
};

export const updateWorkflowStatus = async (documentId, statusData) => {
  const response = await apiClient.put(`/api/documents/${documentId}/workflow-status`, statusData);
  return response.data;
};

export const updateTemplateReference = async (documentId, templateId) => {
  const response = await apiClient.put(`/api/documents/${documentId}/update-template-reference`, { templateId });
  return response.data;
};

export const updateDocument = async (documentId, docData) => {
  const response = await apiClient.put(`/api/update_document/${documentId}`, docData);
  return response.data;
};

export const updateDocumentContent = async (documentId, contentData) => {
  const response = await apiClient.put(`/api/update_document_content/${documentId}`, contentData);
  return response.data;
};

export const reviewDocument = async (documentId, reviewData) => {
  const response = await apiClient.put(`/api/document_review/${documentId}`, reviewData);
  return response.data;
};

export const approveDocument = async (documentId, approveData) => {
  const response = await apiClient.put(`/api/document_approve/${documentId}`, approveData);
  return response.data;
};

export const rejectDocument = async (documentId, rejectData) => {
  const response = await apiClient.put(`/api/document_reject/${documentId}`, rejectData);
  return response.data;
};

export const togglePinDocument = async (id) => {
  const response = await apiClient.patch(`/api/documents/${id}/pin`);
  return response.data;
};

export const updateDocumentProgress = async (id, progress) => {
  const response = await apiClient.patch(`/api/documents/${id}/progress`, { progress });
  return response.data;
};

export const getDocumentNotes = async (documentId) => {
  const response = await apiClient.get(`/api/documents/${documentId}/notes`);
  return response.data;
};

export const createDocumentNote = async (documentId, content) => {
  const response = await apiClient.post(`/api/documents/${documentId}/notes`, { content });
  return response.data;
};

export const removeDocument = async (documentId) => {
  const response = await apiClient.delete(`/api/remove_document/${documentId}`);
  return response.data;
};

export const getDocumentImpactComments = async (documentId) => {
  const response = await apiClient.get(`/api/documents/${documentId}/impact-comments`);
  return response.data;
};

export const saveDocumentImpactComment = async (documentId, payload) => {
  const response = await apiClient.post(`/api/documents/${documentId}/impact-comments`, payload);
  return response.data;
};

export const deleteDocumentImpactComment = async (documentId, commentId) => {
  const response = await apiClient.delete(`/api/documents/${documentId}/impact-comments/${commentId}`);
  return response.data;
};


// ─── Related Documents API ────────────────────────────────────────────────────

/**
 * Fetch related documents for a document.
 * Returns { success, relatedDocuments: Array }
 */
export const getRelatedDocuments = async (documentId) => {
  const response = await apiClient.get(`/api/documents/${documentId}/related`);
  return response.data;
};

/**
 * Replace the full list of related documents for a document.
 * Published documents CANNOT be selected in related documents.
 * Only documents in review, approval, or draft can be selected.
 * @param {string} documentId
 * @param {string[]} relatedDocumentIds
 * @param {string} relationshipType
 */
export const setRelatedDocuments = async (documentId, relatedDocumentIds, relationshipType = 'pending_dependency') => {
  const response = await apiClient.put(`/api/documents/${documentId}/related`, {
    relatedDocumentIds,
    relationshipType,
  });
  return response.data;
};

/**
 * Get documents eligible for the Related Documents drop-down:
 * Published documents CANNOT be selected. Other than published documents,
 * documents in review, documents in approval, as well as in draft can be selected.
 */
export const getDocumentsForRelated = async (excludeId) => {
  try {
    const response = await apiClient.get('/api/documents-for-related', {
      params: { excludeId },
    });
    if (Array.isArray(response.data) && response.data.length > 0) {
      return response.data;
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
  } catch (err) {
    console.warn('[getDocumentsForRelated] Primary endpoint notice, using all-docs fallback:', err.message);
  }

  try {
    const res = await apiClient.get('/api/all-docs');
    const all = Array.isArray(res.data) ? res.data : [];
    const forbidden = ['published', 'revised', 'archived', 'disabled'];
    return all.filter(d =>
      !forbidden.includes(d.status) &&
      (!excludeId || String(d.document_id) !== String(excludeId))
    );
  } catch (fallbackErr) {
    console.error('[getDocumentsForRelated] Candidates fetch failed:', fallbackErr);
    return [];
  }
};

export const getUnpublishedDocumentsForRelated = getDocumentsForRelated;
export const getPublishedDocumentsForRelated = getDocumentsForRelated;

/**
 * Check whether a document and its full publishing group are ready to publish.
 * Returns { canPublish, groupSize, groupDetails, blockedBy, message }
 */
export const getPublishReadiness = async (documentId) => {
  const response = await apiClient.get(`/api/documents/${documentId}/publish-readiness`);
  return response.data;
};

/**
 * Admin-only: publish an entire group of related documents in one atomic operation.
 * @param {string[]} documentIds
 */
export const publishDocumentGroup = async (documentIds) => {
  const response = await apiClient.post('/api/documents/publish-group', { documentIds });
  return response.data;
};
