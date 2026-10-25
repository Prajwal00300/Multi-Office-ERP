import api from './api';

export const superAdminService = {
  // CEOs
  getCeos: async () => {
    const res = await api.get('/super-admin/ceos');
    return res.data;
  },

  getEligibleCeos: async (currentOfficeId = null) => {
    const params = currentOfficeId ? { currentOfficeId } : {};
    const res = await api.get('/super-admin/eligible-ceos', { params });
    return res.data;
  },

  createCeo: async (ceoData) => {
    const res = await api.post('/super-admin/ceos', ceoData);
    return res.data;
  },

  getCeoDetails: async (id) => {
    const res = await api.get(`/super-admin/ceos/${id}`);
    return res.data;
  },

  updateCeo: async (id, data) => {
    const res = await api.put(`/super-admin/ceos/${id}`, data);
    return res.data;
  },

  updateCeoStatus: async (id, status) => {
    const res = await api.patch(`/super-admin/ceos/${id}/status`, { status });
    return res.data;
  },

  assignOfficeToCeo: async (id, officeId) => {
    const res = await api.patch(`/super-admin/offices/${officeId}/assign-ceo`, { ceoId: id });
    return res.data;
  },

  getCeoModuleData: async (id, moduleName, officeId = null) => {
    const params = officeId ? { officeId } : {};
    const res = await api.get(`/super-admin/ceos/${id}/modules/${moduleName}`, { params });
    // Normalize to always return the records array
    return res.data?.records !== undefined ? res.data.records : res.data;
  },

  // Offices / Organizations
  getOrganizations: async () => {
    const res = await api.get('/organizations');
    return res.data;
  },

  getOrganizationById: async (id) => {
    const res = await api.get(`/organizations/${id}`);
    return res.data;
  },

  createOffice: async (officeData) => {
    const res = await api.post('/organizations', officeData);
    return res.data;
  },

  updateOffice: async (id, officeData) => {
    const res = await api.put(`/organizations/${id}`, officeData);
    return res.data;
  },

  deleteOrganization: async (id) => {
    const res = await api.delete(`/organizations/${id}`);
    return res.data;
  }
};

export default superAdminService;
