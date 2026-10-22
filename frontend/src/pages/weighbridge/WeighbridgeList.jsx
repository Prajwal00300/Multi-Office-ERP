import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Truck, 
  Scale, 
  Eye, 
  Calendar, 
  Building2, 
  User,
  Calculator,
  RefreshCw,
  Ticket
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
  }, [searchTerm, startDate, endDate, selectedOrgId, user]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchRecords();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [fetchRecords]);

  // Totals calculation
  const totalCount = records.length;
  const totalTaleWeight = records.reduce((sum, r) => sum + (parseFloat(r.taleWeight || r.netWeight) || 0), 0);
  const totalGrossWeight = records.reduce((sum, r) => sum + (parseFloat(r.grossWeight) || 0), 0);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Scale className="text-blue-600" /> Weighbridge Slips
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manual vehicle weight recordings: First Weight, Gross Weight, and Goods Tale Weight.
          </p>
        </div>
        <Link
          to="/weighbridge/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow transition-all"
        >
          <Plus size={18} />
          <span>New Weighing Entry</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Weighing Slips</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Scale size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Goods (Tale Weight)</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {totalTaleWeight.toFixed(3)} <span className="text-sm font-normal text-slate-500">Ton</span>
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Calculator size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Gross Weight</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {totalGrossWeight.toFixed(3)} <span className="text-sm font-normal text-slate-500">Ton</span>
            </p>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <Truck size={22} />
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Slip #, Customer Name, or Vehicle Details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        {/* Date Filter & Office Selection */}
        <div className="flex flex-wrap items-center gap-2">
          {user?.role === 'SUPER_ADMIN' && organizations.length > 0 && (
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Offices</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="From Date"
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="To Date"
            />
          </div>

          <button
            onClick={fetchRecords}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh List"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="px-5 py-3.5">Slip #</th>
                <th className="px-5 py-3.5">Date &amp; Time</th>
                <th className="px-5 py-3.5">Customer Name</th>
                <th className="px-5 py-3.5">Vehicle Details</th>
                <th className="px-5 py-3.5 text-right">First Weight (Empty)</th>
                <th className="px-5 py-3.5 text-right">Gross Weight</th>
                <th className="px-5 py-3.5 text-right text-emerald-700">Tale Weight (Goods)</th>
                <th className="px-5 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-5 py-12 text-center text-slate-400">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mb-2"></div>
                    <p className="text-xs">Loading weighing slips...</p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-5 py-12 text-center text-slate-400">
                    <Scale className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No weighbridge records found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Click "New Weighing Entry" to record vehicle and goods weights.
                    </p>
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const fWeight = parseFloat(r.firstWeight || r.tareWeight || 0).toFixed(3);
                  const gWeight = parseFloat(r.grossWeight || 0).toFixed(3);
                  const tWeight = parseFloat(r.taleWeight || r.netWeight || 0).toFixed(3);
                  const unit = r.weightUnit || 'Ton';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Slip # */}
                      <td className="px-5 py-3.5 font-mono text-xs font-bold text-blue-600">
                        <Link to={`/weighbridge/${r.id}`} className="hover:underline">
                          {r.weighingNumber}
                        </Link>
                      </td>

                      {/* Date & Time */}
                      <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        <div>{new Date(r.weighedAt || r.createdAt).toLocaleDateString()}</div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(r.weighedAt || r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Customer Name */}
                      <td className="px-5 py-3.5 text-xs text-slate-900 font-semibold">
                        {r.Customer?.name || r.customer?.name || 'Customer'}
                        {r.Customer?.phone && (
                          <span className="block text-[11px] text-slate-400 font-normal">
                            {r.Customer.phone}
                          </span>
                        )}
                      </td>

                      {/* Vehicle Details */}
                      <td className="px-5 py-3.5 text-xs font-semibold text-slate-800 tracking-wide uppercase">
                        {r.vehicleDetails || r.vehicleNumber || '—'}
                      </td>

                      {/* First Weight */}
                      <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-600 whitespace-nowrap">
                        {fWeight} {unit}
                      </td>

                      {/* Gross Weight */}
                      <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-800 font-medium whitespace-nowrap">
                        {gWeight} {unit}
                      </td>

                      {/* Tale Weight */}
                      <td className="px-5 py-3.5 text-right font-mono text-xs font-bold text-emerald-700 bg-emerald-50/40 whitespace-nowrap">
                        {tWeight} {unit}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            to={`/weighbridge/${r.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Weighing Slip"
                          >
                            <Eye size={14} />
                            <span>Slip</span>
                          </Link>
                          <Link
                            to={`/gate-passes/new?weighingRecordId=${r.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Generate Gate Pass"
                          >
                            <Ticket size={14} />
                            <span>Gate Pass</span>
                          </Link>
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
