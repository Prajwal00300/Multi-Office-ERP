import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  ShoppingBag, 
  Eye, 
  Edit3, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp, 
  Building, 
  Calendar, 
  AlertCircle,
  Package,
  Layers,
  Printer,
  FileText,
  Trash2
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { getSaleOrders, deleteSaleOrder } from '../../services/saleOrderService';

const cleanSerialNumber = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  if (/^[0-9]+$/.test(str)) {
    return String(parseInt(str, 10));
  }
  const match = str.match(/\d+$/);
  if (match) {
    return String(parseInt(match[0], 10));
  }
  return str;
};

const SalesList = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [sales, setSales] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');

  // Fetch Organizations for Super Admin / CEO
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        if (user?.role === 'SUPER_ADMIN') {
          const res = await api.get('/organizations');
          setOrganizations(res.data || []);
        } else if (user?.role === 'CEO') {
          const res = await api.get('/ceo/offices');
          setOrganizations(res.data || []);
        }
      } catch (err) {
        console.error('Failed to load organizations:', err);
      }
    };
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') {
      fetchOrgs();
    }
  }, [user]);

  // Fetch Sales
  const fetchSalesData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      if (user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') {
        if (selectedOrgId) params.organizationId = selectedOrgId;
      } else if (user?.organizationId) {
        params.organizationId = user.organizationId;
      }

      const data = await getSaleOrders(params);
      setSales(data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch sale orders.');
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, startDate, endDate, selectedOrgId, user]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchSalesData();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [fetchSalesData]);

  const handleDelete = async (orderId, orderNum) => {
    if (!window.confirm(`Are you sure you want to delete Sale Order #${cleanSerialNumber(orderNum)}?`)) {
      return;
    }
    try {
      await deleteSaleOrder(orderId);
      setSuccessMsg(`Sale Order #${cleanSerialNumber(orderNum)} deleted successfully.`);
      fetchSalesData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete sale order.');
      setTimeout(() => setError(''), 5000);
    }
  };

  // Status Badge Component
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Fully Processed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Fully Processed
          </span>
        );
      case 'Partially Processed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Clock className="w-3.5 h-3.5" />
            Partially Processed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            Cancelled
          </span>
        );
      case 'Pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
    }
  };

  // Quick Stats
  const totalCount = sales.length;
  const pendingCount = sales.filter(s => s.status === 'Pending').length;
  const partialCount = sales.filter(s => s.status === 'Partially Processed').length;
  const fullyProcessedCount = sales.filter(s => s.status === 'Fully Processed').length;
  const totalOrderedTons = sales.reduce((acc, curr) => acc + (parseFloat(curr.totalOrderedQuantity) || parseFloat(curr.totalQuantity) || 0), 0);
  const totalSaleValue = sales.reduce((acc, curr) => {
    const amt = parseFloat(curr.totalAmount);
    if (!isNaN(amt) && amt > 0) return acc + amt;
    const itemsSum = (curr.items || []).reduce((s, it) => s + (parseFloat(it.quantity || 0) * parseFloat(it.rate || 0)), 0);
    return acc + itemsSum;
  }, 0);
  const overallAveragePrice = totalOrderedTons > 0 ? (totalSaleValue / totalOrderedTons) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Management</h1>
            <p className="text-sm text-gray-500">
              Track customer sale orders, quantities, fulfillments, and generate rough estimate slips.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sale Estimate Voucher Button */}
          <Link
            to="/rough-estimate"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            <FileText className="w-4 h-4" />
            Sale Estimate Voucher
          </Link>

          {/* Sale Order Button */}
          <Link
            to="/sale-order"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Sale Order
          </Link>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-3 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Orders</p>
            <p className="text-xl font-bold text-gray-900">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Pending</p>
            <p className="text-xl font-bold text-amber-700">{pendingCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Partially Processed</p>
            <p className="text-xl font-bold text-indigo-700">{partialCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fully Processed</p>
            <p className="text-xl font-bold text-emerald-700">{fullyProcessedCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-slate-50 text-slate-700 rounded-lg">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Ordered</p>
            <p className="text-lg font-bold text-slate-800">
              {totalOrderedTons.toFixed(2)} Tons
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Average Price</p>
            <p className="text-lg font-bold text-emerald-700">
              ₹{overallAveragePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Order ID, Customer Name, Product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Partially Processed">Partially Processed</option>
              <option value="Fully Processed">Fully Processed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Org Filter (Super Admin or CEO) */}
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') && (
            <div>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Offices</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range Start */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Start Date"
            />
          </div>

          {/* Date Range End */}
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="End Date"
            />
          </div>
        </div>

        {(searchTerm || statusFilter !== 'ALL' || startDate || endDate || selectedOrgId) && (
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setStartDate('');
                setEndDate('');
                setSelectedOrgId('');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-gray-500">Loading sale orders...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No sale orders found</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'ALL' || startDate || endDate
                ? 'No orders match your current filters. Try resetting search parameters.'
                : 'Note your first sale order to track buyer products, quantities, and rough estimate slip generation.'}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link
                to="/sale-order"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Sale Order
              </Link>
              <Link
                to="/rough-estimate"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Sale Estimate Voucher
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Serial No. & Date</th>
                  <th className="py-3.5 px-4">Customer / Buyer</th>
                  <th className="py-3.5 px-4 min-w-[220px]">Products & Carbon Types</th>
                  <th className="py-3.5 px-4 text-right">Ordered</th>
                  <th className="py-3.5 px-4 text-right">Delivered</th>
                  <th className="py-3.5 px-4 text-right">Pending</th>
                  <th className="py-3.5 px-4 text-right">Avg. Price</th>
                  {user?.role === 'SUPER_ADMIN' && <th className="py-3.5 px-4">Office</th>}
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {sales.map((order) => {
                  const totalOrd = parseFloat(order.totalOrderedQuantity) || parseFloat(order.totalQuantity) || 0;
                  const totalProc = parseFloat(order.totalProcessedQuantity) || 0;
                  const totalPen = Math.max(0, totalOrd - totalProc);
                  const itemsList = order.items || [];
                  const orderAmt = parseFloat(order.totalAmount) || (order.items || []).reduce((s, it) => s + (parseFloat(it.quantity || 0) * parseFloat(it.rate || 0)), 0);
                  const orderAvgPrice = totalOrd > 0 ? (orderAmt / totalOrd) : (parseFloat(order.averagePrice) || 0);

                  return (
                    <tr key={order.id} className="hover:bg-gray-50/75 transition-colors">
                      {/* Order ID & Date */}
                      <td className="py-3 px-4">
                        <Link 
                          to={`/sales/${order.id}`} 
                          className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {cleanSerialNumber(order.orderNumber)}
                        </Link>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {order.orderDate}
                        </div>
                      </td>

                      {/* Customer Name */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">
                          {order.customerName || <span className="text-gray-400 italic">Unspecified</span>}
                        </div>
                        <div className="text-xs text-gray-500">
                          By: {order.creator?.username || 'User'}
                        </div>
                      </td>

                      {/* Products Summary */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-sm">
                          {itemsList.slice(0, 3).map((it, idx) => (
                            <span 
                              key={idx} 
                              className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200"
                            >
                              <span className="font-medium">{it.productNameSnapshot || 'Product'}:</span>
                              <span>{parseFloat(it.quantity).toFixed(1)}T</span>
                              <span className={`text-[10px] px-1 rounded ${
                                it.carbonType === 'High Carbon' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'
                              }`}>
                                {it.carbonType === 'High Carbon' ? 'HC' : 'LC'}
                              </span>
                            </span>
                          ))}
                          {itemsList.length > 3 && (
                            <span className="text-[11px] text-gray-500 self-center">
                              +{itemsList.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Ordered Qty */}
                      <td className="py-3 px-4 text-right font-semibold text-gray-900 text-sm">
                        {totalOrd.toFixed(3)} <span className="text-xs font-normal text-gray-500">T</span>
                      </td>

                      {/* Delivered Qty */}
                      <td className="py-3 px-4 text-right font-medium text-emerald-700 text-sm">
                        {totalProc.toFixed(3)} <span className="text-xs font-normal text-gray-400">T</span>
                      </td>

                      {/* Pending Qty */}
                      <td className="py-3 px-4 text-right text-sm">
                        {totalPen <= 0 ? (
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            0.000 T
                          </span>
                        ) : (
                          <span className="font-bold text-amber-600">
                            {totalPen.toFixed(3)} <span className="text-xs font-normal text-gray-400">T</span>
                          </span>
                        )}
                      </td>

                      {/* Avg. Price */}
                      <td className="py-3 px-4 text-right font-medium text-slate-800 text-sm">
                        {orderAvgPrice > 0 ? (
                          <>₹{orderAvgPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Office (Super Admin) */}
                      {user?.role === 'SUPER_ADMIN' && (
                        <td className="py-3 px-4 text-xs text-gray-600">
                          {order.Organization?.name || `Office #${order.organizationId}`}
                        </td>
                      )}

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {renderStatusBadge(order.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Make Slip via Sale Estimate Voucher */}
                          {totalPen > 0 && order.status !== 'CANCELLED' && (
                            <Link
                              to={`/rough-estimate?saleId=${order.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-medium transition-colors"
                              title="Make Slip via Sale Estimate Voucher"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Make Slip
                            </Link>
                          )}

                          {/* View Detail */}
                          <Link
                            to={`/sales/${order.id}`}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="View Order Details & Allocations"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {/* Print Sale Order Slip */}
                          <Link
                            to={`/sales/${order.id}/print`}
                            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                            title="Print Sale Order Slip"
                          >
                            <Printer className="w-4 h-4" />
                          </Link>

                          {/* Edit (if no fulfillments yet) */}
                          {totalProc === 0 && order.status !== 'CANCELLED' && (
                            <Link
                              to={`/sale-order?saleId=${order.id}&mode=edit`}
                              className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                              title="Edit Sale Order in Workspace"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Link>
                          )}

                          {/* Delete (if no fulfillments yet) */}
                          {totalProc === 0 && (
                            <button
                              onClick={() => handleDelete(order.id, order.orderNumber)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title="Delete Sale Order"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesList;