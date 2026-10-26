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
  const query = new URLSearchParams();
  if (currentId) query.append('currentId', currentId);
  if (organizationId) query.append('organizationId', organizationId);
  const queryString = query.toString();
  const res = await api.get(`/estimates/navigation/previous${queryString ? `?${queryString}` : ''}`);
  return res.data;
};

export const getNextEstimate = async (currentId, organizationId) => {
  const query = new URLSearchParams();
  if (currentId) query.append('currentId', currentId);
  if (organizationId) query.append('organizationId', organizationId);
  const queryString = query.toString();
  const res = await api.get(`/estimates/navigation/next${queryString ? `?${queryString}` : ''}`);
  return res.data;
};

export const getNextEstimateNumber = async (organizationId) => {
  const query = organizationId ? `?organizationId=${organizationId}` : '';
  const res = await api.get(`/estimates/next-number${query}`);
  return res.data;
};

export const getFirstEstimate = async (organizationId) => {
  const query = organizationId ? `?organizationId=${organizationId}` : '';
  const res = await api.get(`/estimates${query}`);
  const list = res.data || [];
  if (list.length === 0) return null;
  const first = list[list.length - 1];
  return getEstimateById(first.id);
};

export const getLastEstimate = async (organizationId) => {
  const query = organizationId ? `?organizationId=${organizationId}` : '';
  const res = await api.get(`/estimates${query}`);
  const list = res.data || [];
  if (list.length === 0) return null;
  const last = list[0];
  return getEstimateById(last.id);
};

export const createEstimate = async (data) => {
  const res = await api.post('/estimates', data);
  return res.data.estimate || res.data;
};

export const updateEstimate = async (id, data) => {
  const res = await api.put(`/estimates/${id}`, data);
  return res.data.estimate || res.data;
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
  updateEstimate
};
