import api from './api';

export const getGatePasses = async (params = {}) => {
  const query = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '' && params[key] !== 'ALL') {
      query.append(key, params[key]);
    }
  });
  const queryString = query.toString();
  const res = await api.get(`/gate-passes${queryString ? `?${queryString}` : ''}`);
  return res.data;
};

export const getGatePassById = async (id) => {
  const res = await api.get(`/gate-passes/${id}`);
  return res.data;
};

export const createGatePass = async (data) => {
  const res = await api.post('/gate-passes', data);
  return res.data;
};

export const issueGatePass = async (id) => {
  const res = await api.post(`/gate-passes/${id}/issue`);
  return res.data;
};

export const confirmDispatch = async (id) => {
  const res = await api.post(`/gate-passes/${id}/confirm-dispatch`);
  return res.data;
};

export const cancelGatePass = async (id, data) => {
  const res = await api.post(`/gate-passes/${id}/cancel`, data);
  return res.data;
};

export const requestReweigh = async (id, data) => {
  const res = await api.post(`/gate-passes/${id}/request-reweigh`, data);
  return res.data;
};

export default {
  getGatePasses,
  getGatePassById,
  createGatePass,
  issueGatePass,
  confirmDispatch,
  cancelGatePass,
  requestReweigh
};
