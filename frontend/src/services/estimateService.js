import api from './api';

export const getEstimates = async (params = {}) => {
  const query = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '' && params[key] !== 'ALL') {
      query.append(key, params[key]);
    }
  });
  const queryString = query.toString();
  const res = await api.get(`/estimates${queryString ? `?${queryString}` : ''}`);
  return res.data;
};

export const getEstimateById = async (id) => {
  const res = await api.get(`/estimates/${id}`);
  return res.data;
};

export const getPreviousEstimate = async (currentId, organizationId) => {
  try {
    const query = new URLSearchParams();
    if (currentId) query.append('currentId', currentId);
    if (organizationId) query.append('organizationId', organizationId);
    const queryString = query.toString();
    const res = await api.get(`/estimates/navigation/previous${queryString ? `?${queryString}` : ''}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

export const getNextEstimate = async (currentId, organizationId) => {
  try {
    const query = new URLSearchParams();
    if (currentId) query.append('currentId', currentId);
    if (organizationId) query.append('organizationId', organizationId);
    const queryString = query.toString();
    const res = await api.get(`/estimates/navigation/next${queryString ? `?${queryString}` : ''}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

export const getNextEstimateNumber = async (organizationId, date) => {
  const params = new URLSearchParams();
  if (organizationId) params.append('organizationId', organizationId);
  if (date) params.append('date', date);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await api.get(`/estimates/next-number${query}`);
  return res.data;
};

export const getFirstEstimate = async (organizationId) => {
  try {
    const query = organizationId ? `?organizationId=${organizationId}` : '';
    const res = await api.get(`/estimates/navigation/first${query}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

export const getLastEstimate = async (organizationId) => {
  try {
    const query = organizationId ? `?organizationId=${organizationId}` : '';
    const res = await api.get(`/estimates/navigation/last${query}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

export const createEstimate = async (data) => {
  const res = await api.post('/estimates', data);
  return res.data.estimate || res.data;
};

export const updateEstimate = async (id, data) => {
  const res = await api.put(`/estimates/${id}`, data);
  return res.data.estimate || res.data;
};

export const deleteEstimate = async (id) => {
  const res = await api.delete(`/estimates/${id}`);
  return res.data;
};

export default {
  getEstimates,
  getEstimateById,
  getPreviousEstimate,
  getNextEstimate,
  getNextEstimateNumber,
  getFirstEstimate,
  getLastEstimate,
  createEstimate,
  updateEstimate,
  deleteEstimate
};
