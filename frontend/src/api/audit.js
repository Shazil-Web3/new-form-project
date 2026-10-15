import apiClient from './apiClient';

export const getAuditLogs = async (filters) => {
  const response = await apiClient.get('/api/logs', { params: filters });
  return response.data;
};

export const exportAuditCsv = async (filters) => {
  const response = await apiClient.get('/api/export-csv', {
    params: filters,
    responseType: 'blob',
  });
  return response.data;
};

export const getAuditSummary = async (filters = {}) => {
  const response = await apiClient.get('/api/summary', { params: filters });
  return response.data;
};
