import api from './api';

export const getModules = async () => {
  const res = await api.get('/duty-assignments/modules');
  return res.data;
};

export const getOrganizations = async () => {
  const res = await api.get('/duty-assignments/organizations');
  return res.data;
};

export const getAdminsByOrganization = async (organizationId) => {
  const res = await api.get(`/duty-assignments/admins/${organizationId}`);
  return res.data;
};

export const getAdminPermissions = async (userId, organizationId) => {
  const query = organizationId ? `?organizationId=${organizationId}` : '';
  const res = await api.get(`/duty-assignments/permissions/${userId}${query}`);
  return res.data;
};

export const saveAdminPermissions = async (data) => {
  const res = await api.post('/duty-assignments/permissions', data);
  return res.data;
};

export const getMyPermissions = async () => {
  const res = await api.get('/duty-assignments/my-permissions');
  return res.data;
};

export default {
  getModules,
  getOrganizations,
  getAdminsByOrganization,
  getAdminPermissions,
  saveAdminPermissions,
  getMyPermissions
};
