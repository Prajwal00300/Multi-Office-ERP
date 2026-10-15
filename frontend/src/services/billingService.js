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

export const getBillAudits = async (id) => {
  const res = await api.get(`/bills/${id}/audit`);
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
  getBillAudits,
  createBill,
  updateBill,
  finalizeBill,
  overrideBill
};
