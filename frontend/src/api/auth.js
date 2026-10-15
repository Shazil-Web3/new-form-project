import apiClient from './apiClient';

export const login = async (email, password) => {
  const response = await apiClient.post('/api/users/login', { email, password });
  return response.data;
};

export const registerOrganization = async (name, settings) => {
  const response = await apiClient.post('/api/organization/register', { name, settings });
  return response.data;
};

export const registerUser = async (userData) => {
  const response = await apiClient.post('/api/users/register', userData);
  return response.data;
};

export const logout = async (refreshToken) => {
  const response = await apiClient.post('/api/auth/logout', { refreshToken });
  return response.data;
};

export const refresh = async (refreshToken) => {
  const response = await apiClient.post('/api/auth/refresh', { refreshToken });
  return response.data;
};

export const verifyPassword = async (password) => {
  const response = await apiClient.post('/api/verify-password', { password });
  return response.data;
};

export const verifyInvitation = async (token) => {
  const response = await apiClient.get(`/api/invitations/verify/${token}`);
  return response.data;
};

export const registerInvited = async (token, firstName, lastName, password) => {
  const response = await apiClient.post('/api/invitations/register', {
    token,
    firstName,
    lastName,
    password,
  });
  return response.data;
};
