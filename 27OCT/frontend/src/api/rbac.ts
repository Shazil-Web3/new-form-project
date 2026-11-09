import apiClient from './apiClient';

export const getMyRbac = async () => {
  const response = await apiClient.get('/api/rbac/me');
  return response.data;
};

export const checkRbacPermission = async (resource, action) => {
  const response = await apiClient.get('/api/rbac/check', { params: { resource, action } });
  return response.data;
};

export const listRbacRoles = async () => {
  const response = await apiClient.get('/api/rbac/roles');
  return response.data;
};

export const listRbacPermissions = async () => {
  const response = await apiClient.get('/api/rbac/permissions');
  return response.data;
};

export const getRbacMatrix = async () => {
  const response = await apiClient.get('/api/rbac/matrix');
  return response.data;
};

export const getRbacDefault = async () => {
  const response = await apiClient.get('/api/rbac/default');
  return response.data;
};

export const getAssignableRbacRoles = async () => {
  const response = await apiClient.get('/api/rbac/assignable-roles');
  return response.data;
};

export const revertRbacToDefault = async () => {
  const response = await apiClient.post('/api/rbac/revert-default');
  return response.data;
};

export const saveRbacMatrix = async (permissionsByRole, mode = 'permanent', expiresAt = null) => {
  const response = await apiClient.post('/api/rbac/matrix/save', {
    permissionsByRole,
    mode,
    expiresAt
  });
  return response.data;
};

export const createRbacRole = async (data) => {
  const response = await apiClient.post('/api/rbac/roles', data);
  return response.data;
};

export const listRbacOrganizations = async () => {
  const response = await apiClient.get('/api/rbac/organizations');
  return response.data;
};

export const listRbacUsers = async (organizationId) => {
  const response = await apiClient.get(`/api/rbac/organizations/${organizationId}/users`);
  return response.data;
};

export const setRbacRolePermissions = async (roleId, permissions) => {
  const response = await apiClient.put(`/api/rbac/roles/${roleId}/permissions`, { permissions });
  return response.data;
};

export const getUserRbacRoles = async (userId) => {
  const response = await apiClient.get(`/api/rbac/users/${userId}/roles`);
  return response.data;
};

export const assignUserRbacRole = async (userId, data) => {
  const response = await apiClient.post(`/api/rbac/users/${userId}/roles`, data);
  return response.data;
};

export const removeUserRbacRole = async (userId, roleId) => {
  const response = await apiClient.delete(`/api/rbac/users/${userId}/roles/${roleId}`);
  return response.data;
};
