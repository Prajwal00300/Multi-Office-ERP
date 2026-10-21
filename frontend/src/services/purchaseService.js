import api from './api';

export const getPurchases = async (params = {}) => {
  const query = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '' && params[key] !== 'ALL') {
      query.append(key, params[key]);
    }
  });
  const queryString = query.toString();
  const res = await api.get(`/purchases${queryString ? `?${queryString}` : ''}`);
  return res.data;
};

export const getNextPurchaseNumber = async (params = {}) => {
  const res = await api.get('/purchases/next-number', { params });
  return res.data;
};

export const lookupPurchaseByNumber = async (orderId, params = {}) => {
  const res = await api.get(`/purchases/lookup/${encodeURIComponent(orderId)}`, { params });
  return res.data;
};

export const getPurchaseById = async (id) => {
  const res = await api.get(`/purchases/${id}`);
  return res.data;
};

export const getPurchaseAudits = async (id) => {
  const res = await api.get(`/purchases/${id}/audit`);
  return res.data;
};

export const createPurchase = async (data) => {
  const res = await api.post('/purchases', data);
  return res.data;
};

export const receiveGoods = async (data) => {
  const res = await api.post('/purchases/receive', data);
  return res.data;
};

export const updatePurchase = async (id, data) => {
  const res = await api.put(`/purchases/${id}`, data);
  return res.data;
};

export const cancelPurchase = async (id, reason) => {
  const res = await api.post(`/purchases/${id}/cancel`, { reason });
  return res.data;
};

export const submitPurchase = async (id) => {
  const res = await api.post(`/purchases/${id}/submit`);
  return res.data;
};

export const approvePurchase = async (id) => {
  const res = await api.post(`/purchases/${id}/approve`);
  return res.data;
};

export const rejectPurchase = async (id, reason) => {
  const res = await api.post(`/purchases/${id}/reject`, { reason });
  return res.data;
};

export const overridePurchase = async (id, data) => {
  const res = await api.post(`/purchases/${id}/override`, data);
  return res.data;
};

export default {
  getPurchases,
  getNextPurchaseNumber,
  lookupPurchaseByNumber,
  getPurchaseById,
  getPurchaseAudits,
  createPurchase,
  receiveGoods,
  updatePurchase,
  cancelPurchase,
  submitPurchase,
  approvePurchase,
  rejectPurchase,
  overridePurchase
};
