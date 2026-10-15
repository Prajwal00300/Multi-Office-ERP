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
  UserCheck
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { getPurchases, submitPurchase, approvePurchase } from '../../services/purchaseService';

const PurchasesList = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [purchases, setPurchases] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');

  // Fetch Organizations for Super Admin dropdown
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      const fetchOrgs = async () => {
        try {
          const res = await api.get('/organizations');
          setOrganizations(res.data || []);
        } catch (err) {
          console.error('Failed to load organizations:', err);
        }
      };
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

      if (user?.role === 'SUPER_ADMIN') {
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

  // Submit for approval handler
  const handleSubmitForApproval = async (purchaseId, purchaseNumber) => {
    if (!window.confirm(`Submit Purchase "${purchaseNumber}" for review and approval?`)) {
      return;
    }

    try {
      setActionLoading(purchaseId);
      setError('');
      await submitPurchase(purchaseId);
      setSuccessMsg(`Purchase ${purchaseNumber} submitted for approval successfully.`);
      fetchPurchasesData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit purchase.');
    } finally {
      setActionLoading(null);
    }
  };

  // Quick Approve handler (Admins only)
  const handleApprove = async (purchaseId, purchaseNumber) => {
    if (!window.confirm(`Approve Purchase "${purchaseNumber}" as authorized executive?`)) {
      return;
    }

    try {
      setActionLoading(purchaseId);
      setError('');
      await approvePurchase(purchaseId);
      setSuccessMsg(`Purchase ${purchaseNumber} approved successfully.`);
      fetchPurchasesData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve purchase.');
    } finally {
      setActionLoading(null);
    }
  };

  // Status Badge Component
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            APPROVED
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <UserCheck className="w-3.5 h-3.5" />
            PENDING APPROVAL
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            REJECTED
          </span>
        );
      case 'OVERRIDDEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <ShieldAlert className="w-3.5 h-3.5" />
            OVERRIDDEN
          </span>
        );
      case 'DRAFT':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            DRAFT
          </span>
        );
    }
  };

  // Quick Stats
  const totalCount = purchases.length;
  const draftCount = purchases.filter(p => p.status === 'DRAFT').length;
  const pendingCount = purchases.filter(p => p.status === 'PENDING_APPROVAL').length;
  const approvedCount = purchases.filter(p => p.status === 'APPROVED' || p.status === 'OVERRIDDEN').length;
  const totalSpend = purchases.reduce((acc, curr) => acc + (parseFloat(curr.totalAmount) || 0), 0);

  const canApprove = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Management</h1>
            <p className="text-sm text-gray-500">
              Record purchases, manage approvals, track line items, and audit transaction changes
            </p>
          </div>
        </div>

        <div>
          <Link
            to="/purchases/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Purchase
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
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total</p>
            <p className="text-xl font-bold text-gray-900">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Drafts</p>
            <p className="text-xl font-bold text-amber-700">{draftCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Pending</p>
            <p className="text-xl font-bold text-blue-700">{pendingCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Approved</p>
            <p className="text-xl font-bold text-emerald-700">{approvedCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Spend</p>
            <p className="text-lg font-bold text-indigo-900">
              ₹{totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              placeholder="Search by Purchase No., Vendor, Details..."
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
              <option value="DRAFT">Draft</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="OVERRIDDEN">Overridden</option>
            </select>
          </div>

          {/* Super Admin Org Filter */}
          {user?.role === 'SUPER_ADMIN' && (
            <div>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Organizations</option>
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
            <p className="mt-3 text-sm text-gray-500">Loading purchase records...</p>
          </div>
        ) : purchases.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No purchases found</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'ALL' || startDate || endDate
                ? 'No purchases match your current filters. Try resetting search parameters.'
                : 'Create your first purchase record to track acquisitions and approvals.'}
            </p>
            <Link
              to="/purchases/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Purchase
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Purchase No.</th>
                  <th className="py-3.5 px-4">Vendor / Party</th>
                  <th className="py-3.5 px-4">Description / Details</th>
                  <th className="py-3.5 px-4 text-right">Items / Qty</th>
                  <th className="py-3.5 px-4 text-right">Total Amount</th>
                  {user?.role === 'SUPER_ADMIN' && <th className="py-3.5 px-4">Organization</th>}
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {purchases.map((purchase) => {
                  const totalAmt = parseFloat(purchase.totalAmount) || 0;
                  const totalQty = parseFloat(purchase.totalQuantity) || 0;
                  const itemCount = purchase.items?.length || 0;

                  return (
                    <tr key={purchase.id} className="hover:bg-gray-50/75 transition-colors">
                      {/* Purchase No & Date */}
                      <td className="py-3 px-4">
                        <Link 
                          to={`/purchases/${purchase.id}`} 
                          className="font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5"
                        >
                          {purchase.purchaseNumber}
                        </Link>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Date: {purchase.purchaseDate}
                        </div>
                      </td>

                      {/* Vendor Name */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">
                          {purchase.vendorName || <span className="text-gray-400 italic">Unspecified</span>}
                        </div>
                        <div className="text-xs text-gray-500">
                          By: {purchase.creator?.username || 'User'}
                        </div>
                      </td>

                      {/* Details */}
                      <td className="py-3 px-4 text-gray-700 max-w-xs truncate">
                        {purchase.purchaseDetails || '—'}
                      </td>

                      {/* Items / Quantity */}
                      <td className="py-3 px-4 text-right font-mono text-xs">
                        <div className="font-medium text-gray-900">{totalQty.toFixed(3)}</div>
                        <div className="text-gray-400">{itemCount} row(s)</div>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-4 text-right font-bold text-gray-900 text-base">
                        ₹{totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Organization (Super Admin) */}
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
                          {/* View Detail */}
                          <Link
                            to={`/purchases/${purchase.id}`}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="View Details & Audit"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {/* Edit (Draft or Pending) */}
                          {['DRAFT', 'REJECTED', 'PENDING_APPROVAL'].includes(purchase.status) && (
                            <Link
                              to={`/purchases/${purchase.id}/edit`}
                              className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                              title="Edit Purchase"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Link>
                          )}

                          {/* Submit for Approval (Draft) */}
                          {['DRAFT', 'REJECTED'].includes(purchase.status) && (
                            <button
                              onClick={() => handleSubmitForApproval(purchase.id, purchase.purchaseNumber)}
                              disabled={actionLoading === purchase.id}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                              title="Submit for Approval"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}

                          {/* Quick Approve (Admin on Pending) */}
                          {purchase.status === 'PENDING_APPROVAL' && canApprove && (
                            <button
                              onClick={() => handleApprove(purchase.id, purchase.purchaseNumber)}
                              disabled={actionLoading === purchase.id}
                              className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors disabled:opacity-50"
                              title="Approve Purchase"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}

                          {/* Authorized Override (Approved & Admin) */}
                          {purchase.status === 'APPROVED' && canApprove && (
                            <Link
                              to={`/purchases/${purchase.id}/edit?mode=override`}
                              className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                              title="Authorized Override"
                            >
                              <ShieldAlert className="w-4 h-4" />
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
