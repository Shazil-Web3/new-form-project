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

