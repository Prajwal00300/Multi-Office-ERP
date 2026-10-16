import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Ticket, 
  Plus, 
  Search, 
  Eye, 
  Printer, 
  Truck, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Building,
  Ban,
  Send
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { getGatePasses } from '../../services/gatePassService';

const GatePassesList = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [gatePasses, setGatePasses] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');

  // Update timer every second for active countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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

  // Fetch Gate Passes
  const fetchGatePassesData = useCallback(async () => {
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

      const data = await getGatePasses(params);
      setGatePasses(data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch gate passes.');
      setGatePasses([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, typeFilter, startDate, endDate, selectedOrgId, user]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchGatePassesData();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [fetchGatePassesData]);

  // Metrics
  const totalCount = gatePasses.length;
  const readyCount = gatePasses.filter(g => g.status === 'READY_FOR_DISPATCH').length;
  const issuedCount = gatePasses.filter(g => g.status === 'ISSUED').length;
  const dispatchedCount = gatePasses.filter(g => g.status === 'DISPATCHED').length;
  const reweighCount = gatePasses.filter(g => g.status === 'REWEIGHING_REQUIRED').length;

  const renderValidityStatus = (gp) => {
    if (gp.status === 'DISPATCHED') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          <CheckCircle2 size={12} /> Dispatched
        </span>
      );
    }

    if (gp.status === 'CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          <Ban size={12} /> Cancelled
        </span>
      );
    }

    const expiryTime = new Date(gp.validityExpiry).getTime();
    const remainingMs = expiryTime - now;

    if (remainingMs <= 0 || gp.status === 'REWEIGHING_REQUIRED') {
      return (
        <div className="text-left">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
            <AlertTriangle size={12} /> Time exceeded
          </span>
          <p className="text-[10px] text-rose-600 font-semibold mt-0.5">
            Re-weighing mandatory
          </p>
        </div>
      );
    }

    // Active countdown
    const totalSeconds = Math.floor(remainingMs / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    return (
      <div className="text-left">
        <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          <Clock size={12} className="animate-pulse" /> {formattedTime}
        </span>
        <p className="text-[10px] text-slate-500 mt-0.5">Validity timer</p>
      </div>
    );
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'READY_FOR_DISPATCH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            Ready
          </span>
        );
      case 'ISSUED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            Issued
          </span>
        );
      case 'DISPATCHED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Dispatched
          </span>
        );
      case 'REWEIGHING_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            Reweighing Required
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 line-through">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
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
            <Ticket className="text-blue-600" /> Gate Pass Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Dispatch authorization, 10-minute validity enforcement, vehicle exit verification, and A4 print layout.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/gate-passes/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
          >
            <Plus size={18} /> Create Gate Pass
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-medium text-slate-500 uppercase">Total Gate Passes</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-medium text-blue-600 uppercase">Ready / Issued</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{readyCount + issuedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-medium text-emerald-600 uppercase">Dispatched</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{dispatchedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-medium text-rose-600 uppercase">Reweighing Required</p>
          <p className="text-2xl font-bold text-rose-700 mt-1">{reweighCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 md:col-span-1">
          <p className="text-xs font-medium text-slate-500 uppercase">Validity Rule</p>
          <p className="text-base font-bold text-slate-700 mt-1">10 Minutes</p>
          <p className="text-[10px] text-slate-400">Strict backend lock</p>
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
              placeholder="Search by Gate Pass #, Vehicle #, Customer, Bill/Estimate #..."
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
              <option value="ALL">All Gate Pass Statuses</option>
              <option value="READY_FOR_DISPATCH">Ready For Dispatch</option>
              <option value="ISSUED">Issued</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="REWEIGHING_REQUIRED">Reweighing Required</option>
              <option value="CANCELLED">Cancelled</option>
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

      {/* Gate Passes Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Gate Pass #</th>
                <th className="px-4 py-3">Ref Document</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Vehicle Details</th>
                <th className="px-4 py-3">Weighing #</th>
                <th className="px-4 py-3 text-right">Net Weight</th>
                <th className="px-4 py-3">10-Min Validity</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center text-slate-400">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mb-2"></div>
                    <p>Loading gate passes...</p>
                  </td>
                </tr>
              ) : gatePasses.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center text-slate-400">
                    <Ticket className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">No gate passes found</p>
                    <p className="text-xs text-slate-400 mt-1">Generate a gate pass from verified weighbridge records.</p>
                  </td>
                </tr>
              ) : (
                gatePasses.map((gp) => {
                  const docNumber = gp.transactionType === 'BILL' 
                    ? (gp.bill?.billNumber || 'Bill') 
                    : (gp.estimate?.estimateNumber || 'Estimate');

                  return (
                    <tr key={gp.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Gate Pass Number */}
                      <td className="px-4 py-3.5 font-medium text-slate-900">
                        <Link 
                          to={`/gate-passes/${gp.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-bold font-mono"
                        >
                          {gp.gatePassNumber}
                        </Link>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(gp.createdAt).toLocaleDateString()} {new Date(gp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>

                      {/* Ref Document */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            gp.transactionType === 'BILL' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {gp.transactionType}
                          </span>
                          <span className="font-medium text-slate-800">{docNumber}</span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-800">{gp.customer?.name || 'Customer'}</p>
                        <p className="text-[11px] text-slate-400">{gp.customer?.city || ''}</p>
                      </td>

                      {/* Vehicle Details */}
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-900 font-mono tracking-wide">{gp.vehicleNumber}</p>
                        {gp.driverName && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Driver: {gp.driverName}
                          </p>
                        )}
                      </td>

                      {/* Weighing Record */}
                      <td className="px-4 py-3.5">
                        {gp.weighingRecord ? (
                          <Link 
                            to={`/weighbridge/${gp.weighingRecord.id}`}
                            className="text-xs text-blue-600 hover:underline font-mono font-medium"
                          >
                            {gp.weighingRecord.weighingNumber}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* Net Weight */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                        {gp.weighingRecord 
                          ? `${parseFloat(gp.weighingRecord.netWeight).toFixed(2)} ${gp.weighingRecord.unit}` 
                          : '—'}
                      </td>

                      {/* 10-Minute Validity */}
                      <td className="px-4 py-3.5">
                        {renderValidityStatus(gp)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        {getStatusBadge(gp.status)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            to={`/gate-passes/${gp.id}`}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="View Gate Pass Details"
                          >
                            <Eye size={16} />
                          </Link>

                          {['ISSUED', 'DISPATCHED'].includes(gp.status) && (
                            <Link
                              to={`/gate-passes/${gp.id}/print`}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                              title="Print A4 Gate Pass"
                            >
                              <Printer size={16} />
                            </Link>
                          )}

                          {gp.status === 'REWEIGHING_REQUIRED' && gp.weighingRecordId && (
                            <Link
                              to={`/weighbridge/new?reweighOf=${gp.weighingRecordId}`}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title="Proceed to Reweigh"
                            >
                              <RotateCcw size={16} />
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

export default GatePassesList;
