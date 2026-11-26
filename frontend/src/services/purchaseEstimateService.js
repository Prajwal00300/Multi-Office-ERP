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
  try {
    const query = new URLSearchParams();
    if (currentId) query.append('currentId', currentId);
    if (organizationId) query.append('organizationId', organizationId);
    const queryString = query.toString();
    const res = await api.get(`/purchase-estimates/navigation/previous${queryString ? `?${queryString}` : ''}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

export const getNextPurchaseEstimate = async (currentId, organizationId) => {
  try {
    const query = new URLSearchParams();
    if (currentId) query.append('currentId', currentId);
    if (organizationId) query.append('organizationId', organizationId);
    const queryString = query.toString();
    const res = await api.get(`/purchase-estimates/navigation/next${queryString ? `?${queryString}` : ''}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

export const getNextPurchaseEstimateNumber = async (organizationId, date) => {
  const params = new URLSearchParams();
  if (organizationId) params.append('organizationId', organizationId);
  if (date) params.append('date', date);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await api.get(`/purchase-estimates/next-number${query}`);
  return res.data;
};

export const getFirstPurchaseEstimate = async (organizationId) => {
  try {
    const query = organizationId ? `?organizationId=${organizationId}` : '';
    const res = await api.get(`/purchase-estimates/navigation/first${query}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

export const getLastPurchaseEstimate = async (organizationId) => {
  try {
    const query = organizationId ? `?organizationId=${organizationId}` : '';
    const res = await api.get(`/purchase-estimates/navigation/last${query}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

export const createPurchaseEstimate = async (data) => {
  const res = await api.post('/purchase-estimates', data);
  return res.data.estimate || res.data;
};

export const updatePurchaseEstimate = async (id, data) => {
  const res = await api.put(`/purchase-estimates/${id}`, data);
  return res.data.estimate || res.data;
};

export const deletePurchaseEstimate = async (id) => {
  const res = await api.delete(`/purchase-estimates/${id}`);
  return res.data;
};

export const getPendingOrderSummary = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.organizationId) query.append('organizationId', params.organizationId);
  if (params.customerId) query.append('customerId', params.customerId);
  if (params.partyName) query.append('partyName', params.partyName);
  const queryString = query.toString();
  const res = await api.get(`/purchase-estimates/pending-order-summary${queryString ? `?${queryString}` : ''}`);
  return res.data;
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
  updatePurchaseEstimate,
  deletePurchaseEstimate,
  getPendingOrderSummary
};
