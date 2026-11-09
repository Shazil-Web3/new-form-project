import apiClient from './apiClient';

export const getAttachments = async (associationType, associationId) => {
  const response = await apiClient.get(`/api/attachments/${associationType}/${associationId}`);
  return response.data;
};

export const getTemplateAttachments = async (templateId) => {
  const response = await apiClient.get(`/api/attachments/template/${templateId}`);
  return response.data;
};

export const uploadAttachment = async (formData, onProgress) => {
  const response = await apiClient.post('/api/attachments/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: onProgress,
  });
  return response.data;
};

export const deleteAttachment = async (attachmentId) => {
  const response = await apiClient.delete(`/api/attachments/${attachmentId}`);
  return response.data;
};

export const fetchAttachmentBlob = async (mode, attachmentId) => {
  const response = await apiClient.get(
    `/api/attachments/${mode === 'inline' ? 'view' : 'download'}/${attachmentId}`,
    { responseType: 'blob' }
  );
  return response.data;
};
