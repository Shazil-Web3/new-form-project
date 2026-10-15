import apiClient from './apiClient';

export const getMe = async () => {
  const response = await apiClient.get('/api/users/me');
  return response.data;
};

export const listOrgMembers = async (userId) => {
  const response = await apiClient.get(`/api/org_members/${userId}`);
  return response.data;
};

export const addOrgMember = async (orgId, memberData) => {
  const response = await apiClient.post(`/api/add_org_member/${orgId}`, memberData);
  return response.data;
};

export const editOrgMember = async (userId, memberData) => {
  const response = await apiClient.put(`/api/edit_org_member/${userId}`, memberData);
  return response.data;
};

export const removeOrgMember = async (userId) => {
  const response = await apiClient.delete(`/api/del_org_member/${userId}`);
  return response.data;
};

// Invited / Invitation endpoints
export const listInvited = async (userId) => {
  const response = await apiClient.get(`/api/invited_users/${userId}`);
  return response.data;
};

export const inviteSingle = async (orgId, invitationData) => {
  const response = await apiClient.post(`/api/invite_org_member/${orgId}`, invitationData);
  return response.data;
};

export const inviteMultiple = async (orgId, invitationsArray) => {
  const response = await apiClient.post(`/api/invite_multiple_org_members/${orgId}`, { invites: invitationsArray });
  return response.data;
};

export const cancelInvite = async (userId) => {
  const response = await apiClient.delete(`/api/cancel_invite/${userId}`);
  return response.data;
};

export const approveInvite = async (userId) => {
  const response = await apiClient.post(`/api/approve_invite/${userId}`);
  return response.data;
};

export const rejectInvite = async (userId) => {
  const response = await apiClient.delete(`/api/reject_invite/${userId}`);
  return response.data;
};

export const addDepartment = async (orgId, departmentData) => {
  const response = await apiClient.post(`/api/add_department/${orgId}`, departmentData);
  return response.data;
};

export const editDepartment = async (deptId, departmentData) => {
  const response = await apiClient.put(`/api/edit_department/${deptId}`, departmentData);
  return response.data;
};

export const listDepartments = async (orgId) => {
  const response = await apiClient.get(`/api/departments/${orgId}`);
  return response.data;
};

export const listSites = async (orgId) => {
  const response = await apiClient.get(`/api/sites/${orgId}`);
  return response.data;
};

export const addSite = async (orgId, siteData) => {
  const response = await apiClient.post(`/api/add_site/${orgId}`, siteData);
  return response.data;
};

export const editSite = async (siteId, siteData) => {
  const response = await apiClient.put(`/api/edit_site/${siteId}`, siteData);
  return response.data;
};

export const updateNotificationSettings = async (userId, settings) => {
  const response = await apiClient.post(`/api/update_notification_settings/${userId}`, settings);
  return response.data;
};

export const resendInvite = async (invitedUserId) => {
  const response = await apiClient.post(`/api/resend_invite/${invitedUserId}`);
  return response.data;
};
