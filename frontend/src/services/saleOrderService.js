import api from './api';

export const getSaleOrders = async (params = {}) => {
  const query = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '' && params[key] !== 'ALL') {
      query.append(key, params[key]);
    }
  });
  const queryString = query.toString();
  const res = await api.get(`/sale-orders${queryString ? `?${queryString}` : ''}`);
  return res.data;
};

export const getNextSaleOrderNumber = async (params = {}) => {
  const res = await api.get('/sale-orders/next-number', { params });
  return res.data;
};

export const getPendingSaleOrderSummary = async (params = {}) => {
  const query = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      query.append(key, params[key]);
    }
  });
  const queryString = query.toString();
  const res = await api.get(`/sale-orders/pending-order-summary${queryString ? `?${queryString}` : ''}`);
  return res.data;
};

export const getSaleOrderById = async (id) => {
  const res = await api.get(`/sale-orders/${id}`);
  return res.data;
};

export const getPreviousSaleOrder = async (currentId = null, organizationId = null) => {
  const query = new URLSearchParams();
  if (currentId) query.append('currentId', currentId);
  if (organizationId) query.append('organizationId', organizationId);
  const queryString = query.toString();
  try {
    const res = await api.get(`/sale-orders/navigation/previous${queryString ? `?${queryString}` : ''}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

export const getNextSaleOrder = async (currentId = null, organizationId = null) => {
  const query = new URLSearchParams();
  if (currentId) query.append('currentId', currentId);
  if (organizationId) query.append('organizationId', organizationId);
  const queryString = query.toString();
  try {
    const res = await api.get(`/sale-orders/navigation/next${queryString ? `?${queryString}` : ''}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

export const getFirstSaleOrder = async (organizationId = null) => {
  const query = new URLSearchParams();
  if (organizationId) query.append('organizationId', organizationId);
  const queryString = query.toString();
  try {
    const res = await api.get(`/sale-orders/navigation/first${queryString ? `?${queryString}` : ''}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

export const getLastSaleOrder = async (organizationId = null) => {
  const query = new URLSearchParams();
  if (organizationId) query.append('organizationId', organizationId);
  const queryString = query.toString();
  try {
    const res = await api.get(`/sale-orders/navigation/last${queryString ? `?${queryString}` : ''}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

export const createSaleOrder = async (data) => {
  const res = await api.post('/sale-orders', data);
  return res.data;
};

export const updateSaleOrder = async (id, data) => {
  const res = await api.put(`/sale-orders/${id}`, data);
  return res.data;
};

export const deleteSaleOrder = async (id) => {
  const res = await api.delete(`/sale-orders/${id}`);
  return res.data;
};

export default {
  getSaleOrders,
  getNextSaleOrderNumber,
  getPendingSaleOrderSummary,
  getSaleOrderById,
  getPreviousSaleOrder,
  getNextSaleOrder,
  getFirstSaleOrder,
  getLastSaleOrder,
  createSaleOrder,
  updateSaleOrder,
  deleteSaleOrder
};
