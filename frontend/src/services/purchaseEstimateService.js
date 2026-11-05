import api from './api';

export const getPurchaseEstimates = async (params = {}) => {
  const query = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '' && params[key] !== 'ALL') {
      query.append(key, params[key]);
    }
  });
  const queryString = query.toString();
  const res = await api.get(`/purchase-estimates${queryString ? `?${queryString}` : ''}`);
  return res.data;
};

export const getPurchaseEstimateById = async (id) => {
  const res = await api.get(`/purchase-estimates/${id}`);
  return res.data;
};

export const getPreviousPurchaseEstimate = async (currentId, organizationId) => {
  const query = new URLSearchParams();
  if (currentId) query.append('currentId', currentId);
  if (organizationId) query.append('organizationId', organizationId);
  const queryString = query.toString();
  const res = await api.get(`/purchase-estimates/navigation/previous${queryString ? `?${queryString}` : ''}`);
  return res.data;
};

export const getNextPurchaseEstimate = async (currentId, organizationId) => {
  const query = new URLSearchParams();
  if (currentId) query.append('currentId', currentId);
  if (organizationId) query.append('organizationId', organizationId);
  const queryString = query.toString();
  const res = await api.get(`/purchase-estimates/navigation/next${queryString ? `?${queryString}` : ''}`);
  return res.data;
};

export const getNextPurchaseEstimateNumber = async (organizationId) => {
  const query = organizationId ? `?organizationId=${organizationId}` : '';
  const res = await api.get(`/purchase-estimates/next-number${query}`);
  return res.data;
};

export const getFirstPurchaseEstimate = async (organizationId) => {
  const query = organizationId ? `?organizationId=${organizationId}` : '';
  const res = await api.get(`/purchase-estimates/navigation/first${query}`);
  return res.data;
};

export const getLastPurchaseEstimate = async (organizationId) => {
  const query = organizationId ? `?organizationId=${organizationId}` : '';
  const res = await api.get(`/purchase-estimates/navigation/last${query}`);
  return res.data;
};

export const createPurchaseEstimate = async (data) => {
  const res = await api.post('/purchase-estimates', data);
  return res.data.estimate || res.data;
};

export const updatePurchaseEstimate = async (id, data) => {
  const res = await api.put(`/purchase-estimates/${id}`, data);
  return res.data.estimate || res.data;
};

export default {
  getPurchaseEstimates,
  getPurchaseEstimateById,
  getPreviousPurchaseEstimate,
  getNextPurchaseEstimate,
  getNextPurchaseEstimateNumber,
  getFirstPurchaseEstimate,
  getLastPurchaseEstimate,
  createPurchaseEstimate,
  updatePurchaseEstimate
};
