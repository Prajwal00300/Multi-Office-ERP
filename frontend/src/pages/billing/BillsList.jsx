import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Receipt, 
  Printer, 
  Eye, 
  Edit3, 
  Lock, 
  Unlock, 
  ShieldAlert, 
  Calendar, 
  Building, 
  User, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  TrendingUp,
  FileText
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { getBills, finalizeBill } from '../../services/billingService';

const BillsList = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [bills, setBills] = useState([]);
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

  // Fetch Bills
  const fetchBillsData = useCallback(async () => {
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

      const data = await getBills(params);
      setBills(data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch bills.');
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, startDate, endDate, selectedOrgId, user]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchBillsData();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [fetchBillsData]);

  // Finalize Bill handler
  const handleFinalize = async (billId, billNumber) => {
    if (!window.confirm(`Are you sure you want to finalize and lock Bill "${billNumber}"? Once finalized, ordinary modifications will be restricted.`)) {
      return;
    }

    try {
      setActionLoading(billId);
      setError('');
      await finalizeBill(billId);
      setSuccessMsg(`Bill ${billNumber} finalized and locked successfully.`);
      fetchBillsData();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to finalize bill.');
    } finally {
      setActionLoading(null);
    }
  };

  // Status Badge Component
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'FINALIZED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Lock className="w-3.5 h-3.5" />
            FINALIZED
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
  const totalBillsCount = bills.length;
  const draftCount = bills.filter(b => b.status === 'DRAFT').length;
  const finalizedCount = bills.filter(b => b.status === 'FINALIZED' || b.status === 'OVERRIDDEN').length;
  const totalRevenue = bills.reduce((acc, curr) => acc + (parseFloat(curr.finalAmount) || 0), 0);

  const canOverride = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Billing / Sale Vouchers</h1>
              <p className="text-sm text-gray-500">
                Manage sales vouchers, tax invoices, GST calculations, and transport charges
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/bills/transaction"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            <Receipt className="w-4 h-4" />
            Sale Voucher (K) Workspace
          </Link>
          <Link
            to="/bills/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create New Bill
          </Link>
        </div>
      </div>

      {/* Success / Error Messages */}
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

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Bills</p>
            <p className="text-2xl font-bold text-gray-900">{totalBillsCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Draft Vouchers</p>
            <p className="text-2xl font-bold text-amber-700">{draftCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Finalized Bills</p>
            <p className="text-2xl font-bold text-emerald-700">{finalizedCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value (₹)</p>
            <p className="text-2xl font-bold text-indigo-900">
              ₹{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              placeholder="Search by Bill No., Customer, or Notes..."
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
              <option value="FINALIZED">Finalized</option>
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

      {/* Bills Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-gray-500">Loading bills...</p>
          </div>
        ) : bills.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No bills found</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'ALL' || startDate || endDate
                ? 'No bills match your current filters. Try resetting your search parameters.'
                : 'Get started by creating your first sales bill / voucher.'}
            </p>
            <Link
              to="/bills/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Bill
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Bill Details</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Est. Ref</th>
                  <th className="py-3.5 px-4 text-right">Subtotal</th>
                  <th className="py-3.5 px-4 text-right">GST</th>
                  <th className="py-3.5 px-4 text-right">Transport</th>
                  <th className="py-3.5 px-4 text-right">Final Amount</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {bills.map((bill) => {
                  const subtotal = parseFloat(bill.productSubtotal) || 0;
                  const gstPct = parseFloat(bill.gstPercentage) || 0;
                  const gstAmt = parseFloat(bill.gstAmount) || 0;
                  const transport = parseFloat(bill.transportCost) || 0;
                  const finalAmt = parseFloat(bill.finalAmount) || 0;

                  return (
                    <tr key={bill.id} className="hover:bg-gray-50/75 transition-colors">
                      {/* Bill Details */}
                      <td className="py-3 px-4">
                        <Link 
                          to={`/bills/${bill.id}`} 
                          className="font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5"
                        >
                          {bill.billNumber}
                        </Link>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Date: {bill.billDate}
                        </div>
                        {bill.Organization && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            Office: {bill.Organization.name}
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">
                          {bill.Customer?.name || 'N/A'}
                        </div>
                        {bill.Customer?.city && (
                          <div className="text-xs text-gray-500">
                            {bill.Customer.city}
                          </div>
                        )}
                      </td>

                      {/* Estimate Ref */}
                      <td className="py-3 px-4">
                        {bill.Estimate ? (
                          <Link
                            to={`/estimates/${bill.Estimate.id}`}
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline font-mono"
                            title="View linked estimate"
                          >
                            <FileText className="w-3 h-3" />
                            {bill.Estimate.estimateNumber}
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Subtotal */}
                      <td className="py-3 px-4 text-right font-medium text-gray-800">
                        ₹{subtotal.toFixed(2)}
                      </td>

                      {/* GST */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-medium text-gray-900">₹{gstAmt.toFixed(2)}</div>
                        <div className="text-xs text-gray-500 font-mono">({gstPct}%)</div>
                      </td>

                      {/* Transport */}
                      <td className="py-3 px-4 text-right text-gray-700">
                        ₹{transport.toFixed(2)}
                      </td>

                      {/* Final Amount */}
                      <td className="py-3 px-4 text-right font-bold text-gray-900 text-base">
                        ₹{finalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {renderStatusBadge(bill.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Detail */}
                          <Link
                            to={`/bills/${bill.id}`}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {/* Print Bill */}
                          <Link
                            to={`/bills/${bill.id}/print`}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Print / Save PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </Link>

                          {/* Edit Draft */}
                          {bill.status === 'DRAFT' && (
                            <>
                              <Link
                                to={`/bills/${bill.id}/edit`}
                                className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                                title="Edit Draft"
                              >
                                <Edit3 className="w-4 h-4" />
                              </Link>

                              <button
                                onClick={() => handleFinalize(bill.id, bill.billNumber)}
                                disabled={actionLoading === bill.id}
                                className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors disabled:opacity-50"
                                title="Finalize Bill"
                              >
                                <Lock className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {/* Authorized Override */}
                          {bill.status !== 'DRAFT' && canOverride && (
                            <Link
                              to={`/bills/${bill.id}/edit?mode=override`}
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

export default BillsList;
