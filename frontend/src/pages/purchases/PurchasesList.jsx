import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  ShoppingCart, 
  Eye, 
  Edit3, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Send, 
  ShieldAlert, 
  Building, 
  Calendar, 
  DollarSign, 
  AlertCircle,
  TrendingUp,
  Inbox,
  Package,
  Layers,
  ArrowRight
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { getPurchases } from '../../services/purchaseService';

const PurchasesList = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [purchases, setPurchases] = useState([]);
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

  // Fetch Purchases
  const fetchPurchasesData = useCallback(async () => {
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

      const data = await getPurchases(params);
      setPurchases(data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch purchase records.');
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, startDate, endDate, selectedOrgId, user]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPurchasesData();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [fetchPurchasesData]);

  // Status Badge Component
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Fully Received':
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Fully Received
          </span>
        );
      case 'Partially Received':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Clock className="w-3.5 h-3.5" />
            Partially Received
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
      case 'DRAFT':
      case 'PENDING_APPROVAL':
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
  const totalCount = purchases.length;
  const pendingCount = purchases.filter(p => p.status === 'Pending' || p.status === 'DRAFT' || p.status === 'PENDING_APPROVAL').length;
  const partialCount = purchases.filter(p => p.status === 'Partially Received').length;
  const fullyReceivedCount = purchases.filter(p => p.status === 'Fully Received' || p.status === 'APPROVED').length;
  const totalOrderedTons = purchases.reduce((acc, curr) => acc + (parseFloat(curr.totalOrderedQuantity) || parseFloat(curr.totalQuantity) || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Management</h1>
            <p className="text-sm text-gray-500">
              Place multi-product purchase orders and record incoming goods receipts into inventory.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Order Received Button */}
          <Link
            to="/purchases/receive"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            <Inbox className="w-4 h-4" />
            Order Received
          </Link>

          {/* Place Order Button */}
          <Link
            to="/purchases/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Place Order
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <ShoppingCart className="w-5 h-5" />
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
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Partially Received</p>
            <p className="text-xl font-bold text-indigo-700">{partialCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fully Received</p>
            <p className="text-xl font-bold text-emerald-700">{fullyReceivedCount}</p>
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
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Order ID, Party Name, Product..."
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
              <option value="Partially Received">Partially Received</option>
              <option value="Fully Received">Fully Received</option>
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

      {/* Purchases Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-gray-500">Loading purchase orders...</p>
          </div>
        ) : purchases.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No purchase orders found</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'ALL' || startDate || endDate
                ? 'No orders match your current filters. Try resetting search parameters.'
                : 'Place your first purchase order to track products, carbon types, and goods receipts.'}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link
                to="/purchases/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Place Order
              </Link>
              <Link
                to="/purchases/receive"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Inbox className="w-4 h-4" />
                Order Received
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Order ID & Date</th>
                  <th className="py-3.5 px-4">Party / Supplier</th>
                  <th className="py-3.5 px-4 min-w-[220px]">Products & Carbon Types</th>
                  <th className="py-3.5 px-4 text-right">Ordered</th>
                  <th className="py-3.5 px-4 text-right">Received</th>
                  <th className="py-3.5 px-4 text-right">Pending</th>
                  {user?.role === 'SUPER_ADMIN' && <th className="py-3.5 px-4">Office</th>}
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {purchases.map((purchase) => {
                  const totalOrd = parseFloat(purchase.totalOrderedQuantity) || parseFloat(purchase.totalQuantity) || 0;
                  const totalRec = parseFloat(purchase.totalReceivedQuantity) || 0;
                  const totalPen = Math.max(0, totalOrd - totalRec);
                  const itemsList = purchase.items || [];

                  return (
                    <tr key={purchase.id} className="hover:bg-gray-50/75 transition-colors">
                      {/* Order ID & Date */}
                      <td className="py-3 px-4">
                        <Link 
                          to={`/purchases/${purchase.id}`} 
                          className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {purchase.purchaseNumber}
                        </Link>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {purchase.purchaseDate}
                        </div>
                      </td>

                      {/* Party Name */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">
                          {purchase.vendorName || <span className="text-gray-400 italic">Unspecified</span>}
                        </div>
                        <div className="text-xs text-gray-500">
                          By: {purchase.creator?.username || 'User'}
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

                      {/* Received Qty */}
                      <td className="py-3 px-4 text-right font-medium text-emerald-700 text-sm">
                        {totalRec.toFixed(3)} <span className="text-xs font-normal text-gray-400">T</span>
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

                      {/* Office (Super Admin) */}
                      {user?.role === 'SUPER_ADMIN' && (
                        <td className="py-3 px-4 text-xs text-gray-600">
                          {purchase.Organization?.name || `Office #${purchase.organizationId}`}
                        </td>
                      )}

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {renderStatusBadge(purchase.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Receive Goods Button */}
                          {totalPen > 0 && purchase.status !== 'CANCELLED' && (
                            <Link
                              to={`/purchases/receive?orderId=${encodeURIComponent(purchase.purchaseNumber)}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-medium transition-colors"
                              title="Receive Goods against this Order"
                            >
                              <Inbox className="w-3.5 h-3.5" />
                              Receive
                            </Link>
                          )}

                          {/* View Detail */}
                          <Link
                            to={`/purchases/${purchase.id}`}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="View Order Details & Receipts"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {/* Edit (if no receipts yet) */}
                          {totalRec === 0 && purchase.status !== 'CANCELLED' && (
                            <Link
                              to={`/purchases/${purchase.id}/edit`}
                              className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                              title="Edit Purchase Order"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Link>
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

export default PurchasesList;
