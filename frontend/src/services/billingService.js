import api from './api';

export const getBills = async (params = {}) => {
  const query = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '' && params[key] !== 'ALL') {
      query.append(key, params[key]);
    }
  });
  const queryString = query.toString();
  const res = await api.get(`/bills${queryString ? `?${queryString}` : ''}`);
  return res.data;
};

export const getBillById = async (id) => {
  const res = await api.get(`/bills/${id}`);
  return res.data;
};

export const getPreviousBill = async (currentId, organizationId) => {
  const query = new URLSearchParams();
  if (currentId) query.append('currentId', currentId);
  if (organizationId) query.append('organizationId', organizationId);
  const queryString = query.toString();
  const res = await api.get(`/bills/navigation/previous${queryString ? `?${queryString}` : ''}`);
  return res.data;
};

export const getNextBill = async (currentId, organizationId) => {
  const query = new URLSearchParams();
  if (currentId) query.append('currentId', currentId);
  if (organizationId) query.append('organizationId', organizationId);
  const queryString = query.toString();
  const res = await api.get(`/bills/navigation/next${queryString ? `?${queryString}` : ''}`);
  return res.data;
};

export const getNextBillNumber = async (organizationId) => {
  const query = organizationId ? `?organizationId=${organizationId}` : '';
  const res = await api.get(`/bills/next-number${query}`);
  return res.data;
};


export const createBill = async (data) => {
  const res = await api.post('/bills', data);
  return res.data;
};

export const updateBill = async (id, data) => {
  const res = await api.put(`/bills/${id}`, data);
  return res.data;
};

export const finalizeBill = async (id) => {
  const res = await api.post(`/bills/${id}/finalize`);
  return res.data;
};

export const overrideBill = async (id, data) => {
  const res = await api.post(`/bills/${id}/override`, data);
  return res.data;
};

export default {
  getBills,
  getBillById,
  getPreviousBill,
  getNextBill,
  getNextBillNumber,
  createBill,
  updateBill,
  finalizeBill,
  overrideBill
};
