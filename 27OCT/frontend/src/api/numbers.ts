import apiClient from './apiClient';

/**
 * Number sequences and numbering management API
 */

// Fetch all rules
export const listNumberRules = async (orgId) => {
  const response = await apiClient.get(`/api/numbers/rules/${orgId}`);
  return response.data;
};

// Create or upsert a numbering rule
export const saveNumberRule = async (orgId, ruleData) => {
  const response = await apiClient.post(`/api/numbers/rules/${orgId}`, ruleData);
  return response.data;
};

// Update an existing rule
export const updateNumberRule = async (ruleId, ruleData) => {
  const response = await apiClient.put(`/api/numbers/rules/${ruleId}`, ruleData);
  return response.data;
};

// Preview next document number for a department
export const previewDocumentNumber = async (orgId, departmentName) => {
  const response = await apiClient.get(`/api/numbers/preview-document-number/${orgId}`, {
    params: { department: departmentName }
  });
  return response.data;
};

// List project numbers
export const listProjectNumbers = async (orgId) => {
  const response = await apiClient.get(`/api/numbers/projects/${orgId}`);
  return response.data;
};

// Create project number
export const createProjectNumber = async (orgId, data) => {
  const response = await apiClient.post(`/api/numbers/projects/${orgId}`, data);
  return response.data;
};

// Toggle project number status
export const toggleProjectNumberStatus = async (id, status) => {
  const response = await apiClient.put(`/api/numbers/projects/${id}/status`, { status });
  return response.data;
};

// List cost center numbers
export const listCostCenterNumbers = async (orgId) => {
  const response = await apiClient.get(`/api/numbers/cost-centers/${orgId}`);
  return response.data;
};

// Create cost center number
export const createCostCenterNumber = async (orgId, data) => {
  const response = await apiClient.post(`/api/numbers/cost-centers/${orgId}`, data);
  return response.data;
};

// Toggle cost center status
export const toggleCostCenterStatus = async (id, status) => {
  const response = await apiClient.put(`/api/numbers/cost-centers/${id}/status`, { status });
  return response.data;
};
