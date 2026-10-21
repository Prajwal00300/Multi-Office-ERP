import api from './api';

export const ceoService = {
  getDashboardSummary: async () => {
    const res = await api.get('/ceo/dashboard-summary');
    return res.data;
  },

  getOffices: async () => {
    const res = await api.get('/ceo/offices');
    return res.data;
  },

  createOffice: async (data) => {
    const res = await api.post('/ceo/offices', data);
    return res.data;
  },

  updateOffice: async (id, data) => {
    const res = await api.put(`/ceo/offices/${id}`, data);
    return res.data;
  },

  updateOfficeStatus: async (id, status) => {
    const res = await api.patch(`/ceo/offices/${id}/status`, { status });
    return res.data;
  },

  getEmployees: async () => {
    const res = await api.get('/ceo/employees');
    return res.data;
  },

  createEmployee: async (data) => {
    const res = await api.post('/ceo/employees', data);
    return res.data;
  },

  updateEmployee: async (id, data) => {
    const res = await api.put(`/ceo/employees/${id}`, data);
    return res.data;
  },

  updateEmployeeStatus: async (id, status) => {
    const res = await api.patch(`/ceo/employees/${id}/status`, { status });
    return res.data;
  },

  getEmployeePermissions: async (employeeId) => {
    const res = await api.get(`/ceo/employees/${employeeId}/permissions`);
    return res.data;
  },

  saveEmployeePermissions: async (employeeId, permissions) => {
    const res = await api.post(`/ceo/employees/${employeeId}/permissions`, { permissions });
    return res.data;
  }
};

export default ceoService;
