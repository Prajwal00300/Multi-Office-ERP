import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Truck, 
  Scale, 
  Eye, 
  RotateCcw, 
  Ticket, 
  Calendar, 
  Building, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Filter,
  FileText,
  ShieldCheck,
  Ban
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { getWeighingRecords } from '../../services/weighbridgeService';

const WeighbridgeList = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [records, setRecords] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
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

  // Fetch Records
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (typeFilter !== 'ALL') params.transactionType = typeFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      if (user?.role === 'SUPER_ADMIN') {
        if (selectedOrgId) params.organizationId = selectedOrgId;
      } else if (user?.organizationId) {
        params.organizationId = user.organizationId;
      }

      const data = await getWeighingRecords(params);
      setRecords(data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch weighing records.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, typeFilter, startDate, endDate, selectedOrgId, user]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchRecords();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [fetchRecords]);

  // Statistics calculation
  const totalCount = records.length;
  const verifiedCount = records.filter(r => r.status === 'VERIFIED').length;
  const discrepancyCount = records.filter(r => r.status === 'DISCREPANCY_FLAGGED').length;
  const approvedCount = records.filter(r => r.status === 'APPROVED').length;
  const supersededCount = records.filter(r => r.status === 'SUPERSEDED').length;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 size={13} /> Verified
          </span>
        );
      case 'DISCREPANCY_FLAGGED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle size={13} /> Discrepancy
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <ShieldCheck size={13} /> Approved
          </span>
        );
      case 'REWEIGHED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <RotateCcw size={13} /> Reweighed
          </span>
        );
      case 'SUPERSEDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 line-through">
            Superseded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Scale className="text-blue-600" /> Weighbridge Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manual vehicle weight recording, expected discrepancy checks, and reweighing audit trail.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/weighbridge/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
          >
            <Plus size={18} /> New Weighing Entry
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-medium text-slate-500 uppercase">Total Records</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-medium text-emerald-600 uppercase">Verified</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{verifiedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-medium text-amber-600 uppercase">Discrepancy</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{discrepancyCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-medium text-blue-600 uppercase">Admin Approved</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{approvedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 md:col-span-1">
          <p className="text-xs font-medium text-slate-500 uppercase">Superseded / Reweighed</p>
          <p className="text-2xl font-bold text-slate-600 mt-1">{supersededCount}</p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold">×</button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by Weighing #, Bill #, Estimate #, Customer, Vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Weighing Statuses</option>
              <option value="VERIFIED">Verified</option>
              <option value="DISCREPANCY_FLAGGED">Discrepancy Flagged</option>
              <option value="APPROVED">Admin Approved</option>
              <option value="REWEIGHED">Reweighed</option>
              <option value="SUPERSEDED">Superseded</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Types (Bills & Estimates)</option>
              <option value="BILL">Bills Only</option>
              <option value="ESTIMATE">Estimates Only</option>
            </select>
          </div>
        </div>

        {/* Date and Org Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100 items-center">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-600">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-600">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {user?.role === 'SUPER_ADMIN' && (
            <div className="flex items-center gap-2 md:col-span-2">
              <Building size={16} className="text-slate-400 shrink-0" />
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Organizations</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Weighing Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Weighing #</th>
                <th className="px-4 py-3">Ref Document</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Vehicle Details</th>
                <th className="px-4 py-3 text-right">Tare</th>
                <th className="px-4 py-3 text-right">Gross</th>
                <th className="px-4 py-3 text-right">Net Weight</th>
                <th className="px-4 py-3 text-right">Expected</th>
                <th className="px-4 py-3 text-center">Source</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="11" className="px-4 py-12 text-center text-slate-400">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mb-2"></div>
                    <p>Loading weighing records...</p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-4 py-12 text-center text-slate-400">
                    <Scale className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">No weighing records found</p>
                    <p className="text-xs text-slate-400 mt-1">Try modifying your search or click "New Weighing Entry" to record weights.</p>
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const docNumber = r.transactionType === 'BILL' 
                    ? (r.bill?.billNumber || 'Bill') 
                    : (r.estimate?.estimateNumber || 'Estimate');
                  const docDate = r.transactionType === 'BILL' 
                    ? r.bill?.billDate 
                    : r.estimate?.estimateDate;

                  return (
                    <tr 
                      key={r.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${r.status === 'SUPERSEDED' ? 'opacity-60 bg-slate-50/40' : ''}`}
                    >
                      {/* Weighing Number */}
                      <td className="px-4 py-3.5 font-medium text-slate-900">
                        <Link 
                          to={`/weighbridge/${r.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5"
                        >
                          {r.weighingNumber}
                          {r.isReweigh && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-700 rounded font-semibold">
                              Reweigh
                            </span>
                          )}
                        </Link>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(r.weighedAt || r.createdAt).toLocaleDateString()} {new Date(r.weighedAt || r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>

                      {/* Ref Document */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            r.transactionType === 'BILL' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {r.transactionType}
                          </span>
                          <span className="font-medium text-slate-800">{docNumber}</span>
                        </div>
                        {docDate && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Doc Date: {docDate}
                          </p>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-800">{r.customer?.name || 'Customer'}</p>
                        <p className="text-[11px] text-slate-400">
                          {r.customer?.city ? `${r.customer.city} • ` : ''}{r.customer?.phone || ''}
                        </p>
                      </td>

                      {/* Vehicle Details */}
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-900 tracking-wide">{r.vehicleNumber}</p>
                        {r.driverName && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Driver: {r.driverName}
                          </p>
                        )}
                      </td>

                      {/* Tare */}
                      <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                        {parseFloat(r.tareWeight).toFixed(2)} {r.unit}
                      </td>

                      {/* Gross */}
                      <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                        {parseFloat(r.grossWeight).toFixed(2)} {r.unit}
                      </td>

                      {/* Net */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                        {parseFloat(r.netWeight).toFixed(2)} {r.unit}
                      </td>

                      {/* Expected */}
                      <td className="px-4 py-3.5 text-right font-mono">
                        {r.expectedWeight !== null && r.expectedWeight !== undefined ? (
                          <div>
                            <span className="text-slate-700">{parseFloat(r.expectedWeight).toFixed(2)} {r.unit}</span>
                            {parseFloat(r.weightDifference) !== 0 && (
                              <p className={`text-[11px] font-semibold ${
                                parseFloat(r.weightDifference) > 0 ? 'text-amber-600' : 'text-rose-600'
                              }`}>
                                {parseFloat(r.weightDifference) > 0 ? `+${parseFloat(r.weightDifference).toFixed(2)}` : parseFloat(r.weightDifference).toFixed(2)} {r.unit}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">N/A</span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Manual Entry
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        {getStatusBadge(r.status)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            to={`/weighbridge/${r.id}`}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="View Weighing Details"
                          >
                            <Eye size={16} />
                          </Link>

                          {r.status !== 'SUPERSEDED' && (
                            <Link
                              to={`/weighbridge/new?reweighOf=${r.id}`}
                              className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                              title="Reweigh Vehicle"
                            >
                              <RotateCcw size={16} />
                            </Link>
                          )}

                          {['VERIFIED', 'APPROVED'].includes(r.status) && (
                            <Link
                              to={`/gate-passes/new?weighingRecordId=${r.id}`}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                              title="Generate Gate Pass"
                            >
                              <Ticket size={16} />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WeighbridgeList;
