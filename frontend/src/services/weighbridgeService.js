import api from './api';

export const searchTransactions = async (params = {}) => {
  const query = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '' && params[key] !== 'ALL') {
      query.append(key, params[key]);
    }
  });
  const queryString = query.toString();
  const res = await api.get(`/weighbridge/transactions${queryString ? `?${queryString}` : ''}`);
  return res.data;
};

export const getWeighingRecords = async (params = {}) => {
  const query = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '' && params[key] !== 'ALL') {
      query.append(key, params[key]);
    }
  });
  const queryString = query.toString();
  const res = await api.get(`/weighbridge${queryString ? `?${queryString}` : ''}`);
  return res.data;
};

export const getWeighingRecordById = async (id) => {
  const res = await api.get(`/weighbridge/${id}`);
  return res.data;
};

export const createWeighingRecord = async (data) => {
  const res = await api.post('/weighbridge', data);
  return res.data;
};

export const reweighTransaction = async (id, data) => {
  const res = await api.post(`/weighbridge/${id}/reweigh`, data);
  return res.data;
};

export const approveDiscrepancy = async (id, data) => {
  const res = await api.post(`/weighbridge/${id}/approve-discrepancy`, data);
  return res.data;
};

export default {
  searchTransactions,
  getWeighingRecords,
  getWeighingRecordById,
  createWeighingRecord,
  reweighTransaction,
  approveDiscrepancy
};
