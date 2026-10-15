import apiClient from './apiClient';

export const listTemplates = async (userId) => {
  const response = await apiClient.get(`/api/templates/${userId}`);
  return response.data;
};

export const getTemplate = async (templateId) => {
  const response = await apiClient.get(`/api/get_template/${templateId}`);
  return response.data;
};

export const getTemplateContent = async (templateId) => {
  const response = await apiClient.get(`/api/get_template_content/${templateId}`);
  return response.data;
};

export const debugTemplateComments = async (templateId) => {
  const response = await apiClient.get(`/api/debug_template_comments/${templateId}`);
  return response.data;
};

export const getTemplateVersionNotice = async (templateId) => {
  const response = await apiClient.get(`/api/template-version-notice/${templateId}`);
  return response.data;
};

export const getTemplateHistory = async (id) => {
  const response = await apiClient.get(`/api/templates/${id}/history`);
  return response.data;
};

export const generateAiSummary = async (id) => {
  const response = await apiClient.post(`/api/templates/${id}/generate-ai-summary`);
  return response.data;
};

export const createTemplate = async (templateData) => {
  const response = await apiClient.post('/api/newtemplate', templateData);
  return response.data;
};

export const updateTemplate = async (templateId, templateData) => {
  const response = await apiClient.put(`/api/update_template/${templateId}`, templateData);
  return response.data;
};

export const updateTemplateMetadata = async (templateId, metadata) => {
  const response = await apiClient.put(`/api/update_template_metadata/${templateId}`, metadata);
  return response.data;
};

export const updateTemplateContent = async (templateId, contentData) => {
  const response = await apiClient.put(`/api/update_template_content/${templateId}`, contentData);
  return response.data;
};

export const updateContent = async (templateId, contentData) => {
  const response = await apiClient.put(`/api/update_content/${templateId}`, contentData);
  return response.data;
};

export const reviewTemplate = async (templateId, reviewData) => {
  const response = await apiClient.put(`/api/template_review/${templateId}`, reviewData);
  return response.data;
};

export const approveTemplate = async (templateId, approveData) => {
  const response = await apiClient.put(`/api/template_approve/${templateId}`, approveData);
  return response.data;
};

export const rejectTemplate = async (templateId, rejectData) => {
  const response = await apiClient.put(`/api/template_reject/${templateId}`, rejectData);
  return response.data;
};

export const updateTemplateStatus = async (id, status, extraData = {}) => {
  const response = await apiClient.put(`/api/templates/${id}/status`, { status, ...extraData });
  return response.data;
};

export const removeTemplate = async (templateId) => {
  const response = await apiClient.delete(`/api/remove_template/${templateId}`);
  return response.data;
};

// Categories
export const listCategories = async (orgId) => {
  const response = await apiClient.get(`/api/template_categories/${orgId}`);
  return response.data;
};

export const createCategory = async (orgId, categoryData) => {
  const response = await apiClient.post(`/api/add_category/${orgId}`, categoryData);
  return response.data;
};

export const updateCategory = async (orgId, categoryData) => {
  const response = await apiClient.put(`/api/update_category/${orgId}`, categoryData);
  return response.data;
};

export const deleteCategory = async (categoryData) => {
  const response = await apiClient.delete('/api/delete_category', { data: categoryData });
  return response.data;
};

export const togglePinTemplate = async (id) => {
  const response = await apiClient.patch(`/api/templates/${id}/pin`);
  return response.data;
};

export const updateTemplateProgress = async (id, progress) => {
  const response = await apiClient.patch(`/api/templates/${id}/progress`, { progress });
  return response.data;
};

export const getTemplateNotes = async (templateId) => {
  const response = await apiClient.get(`/api/templates/${templateId}/notes`);
  return response.data;
};

export const createTemplateNote = async (templateId, content) => {
  const response = await apiClient.post(`/api/templates/${templateId}/notes`, { content });
  return response.data;
};

export const getTemplateImpactComments = async (templateId) => {
  const response = await apiClient.get(`/api/templates/${templateId}/impact-comments`);
  return response.data;
};

export const saveTemplateImpactComment = async (templateId, payload) => {
  const response = await apiClient.post(`/api/templates/${templateId}/impact-comments`, payload);
  return response.data;
};

export const deleteTemplateImpactComment = async (templateId, commentId) => {
  const response = await apiClient.delete(`/api/templates/${templateId}/impact-comments/${commentId}`);
  return response.data;
};

