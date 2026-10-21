import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Search, 
  FileText, 
  Printer, 
  Eye, 
  Edit3, 
  Calendar, 
  Building, 
  User, 
  CheckCircle, 
  AlertCircle 
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';

const EstimatesList = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [estimates, setEstimates] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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

  // Fetch Estimates
  const fetchEstimates = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      if (user?.role === 'SUPER_ADMIN') {
        if (selectedOrgId) {
          params.append('organizationId', selectedOrgId);
        }
      } else if (user?.organizationId) {
        params.append('organizationId', user.organizationId);
      }

      const response = await api.get(`/estimates?${params.toString()}`);
      setEstimates(response.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch estimates.');
      setEstimates([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, startDate, endDate, selectedOrgId, user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEstimates();
    }, 400);

    return () => clearTimeout(timer);
  }, [fetchEstimates]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Estimate Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            View customer estimates, generate print-ready slips (Estimate K), and manage records.
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center">
          <AlertCircle size={18} className="mr-2 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Banner */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center">
          <CheckCircle size={18} className="mr-2 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Search */}
        <div className="relative md:col-span-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Search estimate number, customer, basic..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Start Date */}
        <div className="md:col-span-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
            title="Start Date"
          />
        </div>

        {/* End Date */}
        <div className="md:col-span-2">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
            title="End Date"
          />
        </div>

        {/* Super Admin Organization Filter */}
        {user?.role === 'SUPER_ADMIN' ? (
          <div className="md:col-span-4">
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Offices</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="md:col-span-4 flex justify-end items-center">
            <button
              onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Estimates Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100 font-semibold">
                <th className="px-6 py-4">Estimate No. (Inv No.)</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4">Basic</th>
                <th className="px-6 py-4">Total Qty</th>
                <th className="px-6 py-4">Grand Total</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="text-sm font-medium">Loading estimates...</span>
                    </div>
                  </td>
                </tr>
              ) : estimates.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="bg-blue-50 text-blue-600 p-3.5 rounded-full">
                        <FileText className="h-7 w-7" />
                      </div>
                      <p className="text-gray-700 font-medium text-base">No estimates found.</p>
                      <p className="text-gray-400 text-sm max-w-sm">
                        {searchTerm || statusFilter !== 'ALL' || startDate || endDate
                          ? 'Try adjusting your search criteria or date filter.'
                          : 'No estimates have been created for this office yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                estimates.map((est) => (
                  <tr key={est.id} className="hover:bg-gray-50/80 transition-colors">
                    {/* Estimate Number */}
                    <td className="px-6 py-4">
                      <Link
                        to={`/estimates/${est.id}`}
                        className="font-mono text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline block"
                      >
                        {est.estimateNumber}
                      </Link>
                      {est.Organization && user?.role === 'SUPER_ADMIN' && (
                        <span className="text-[11px] text-gray-400 flex items-center mt-0.5">
                          <Building size={11} className="mr-1" />
                          {est.Organization.name}
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {est.estimateDate}
                    </td>

                    {/* Customer */}
                    <td className="px-6 py-4 text-sm">
                      <span className="font-medium text-gray-900 block">
                        {est.Customer ? est.Customer.name : 'Unknown Customer'}
                      </span>
                      {est.Customer?.city && (
                        <span className="text-xs text-gray-400">
                          {est.Customer.city}
                        </span>
                      )}
                    </td>

                    {/* Basic */}
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {est.basic ? (
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono text-gray-700">
                          {est.basic}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* Total Quantity */}
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">
                      {est.totalQuantity}
                    </td>

                    {/* Grand Total */}
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">
                      {formatCurrency(est.grandTotal)}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-sm font-medium text-right space-x-2 whitespace-nowrap">
                      {/* View */}
                      <Link
                        to={`/estimates/${est.id}`}
                        className="text-gray-600 hover:text-blue-600 p-1.5 rounded hover:bg-gray-100 inline-block transition-colors"
                        title="View Estimate Details"
                      >
                        <Eye size={17} />
                      </Link>

                      {/* Print */}
                      <Link
                        to={`/estimates/${est.id}/print`}
                        className="text-gray-600 hover:text-emerald-600 p-1.5 rounded hover:bg-gray-100 inline-block transition-colors"
                        title="Print Estimate Slip (K)"
                      >
                        <Printer size={17} />
                      </Link>

                      {/* Edit */}
                      <Link
                        to={`/estimates/${est.id}/edit`}
                        className="text-amber-600 hover:text-amber-800 p-1.5 rounded hover:bg-amber-50 inline-block transition-colors"
                        title="Edit Estimate"
                      >
                        <Edit3 size={17} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EstimatesList;
