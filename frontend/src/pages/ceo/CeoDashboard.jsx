import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  Receipt, 
  Truck, 
  Plus, 
  ShieldCheck, 
  ArrowRight, 
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import ceoService from '../../services/ceoService';

const CeoDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({
    totalOffices: 0,
    totalEmployees: 0,
    totalDispatches: 0,
    totalRevenue: 0,
    activeOffices: 0,
    offices: []
  });

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await ceoService.getDashboardSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load CEO dashboard summary:', err);
      setError(err.response?.data?.error || 'Failed to load executive summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
        <span className="text-gray-600 font-medium">Loading executive dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">CEO Executive Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage your offices, employee workforce, and live branch operations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/ceo/offices"
            className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center shadow-sm transition-colors"
          >
            <Building2 size={15} className="mr-1.5" />
            Manage Offices
          </Link>
          <Link
            to="/ceo/employees"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center shadow-sm transition-colors"
          >
            <Users size={15} className="mr-1.5" />
            Manage Employees
          </Link>
          <Link
            to="/super-admin/duty-assignment"
            className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center shadow-sm transition-colors"
          >
            <ShieldCheck size={15} className="mr-1.5" />
            Duty Assignment
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center">
          <div className="h-12 w-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mr-4">
            <Building2 size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">My Offices</p>
            <h3 className="text-2xl font-bold text-gray-800">{summary.totalOffices}</h3>
            <span className="text-xs text-green-600 font-medium">
              {summary.activeOffices} Active Branches
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center">
          <div className="h-12 w-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mr-4">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Workforce</p>
            <h3 className="text-2xl font-bold text-gray-800">{summary.totalEmployees}</h3>
            <span className="text-xs text-gray-500">Across your offices</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center">
          <div className="h-12 w-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mr-4">
            <Receipt size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sales Invoiced</p>
            <h3 className="text-2xl font-bold text-gray-800">
              ₹{Number(summary.totalRevenue || 0).toLocaleString()}
            </h3>
            <span className="text-xs text-indigo-600 font-medium">Finalized bills</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center">
          <div className="h-12 w-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mr-4">
            <Truck size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Gate Dispatches</p>
            <h3 className="text-2xl font-bold text-gray-800">{summary.totalDispatches}</h3>
            <span className="text-xs text-amber-600 font-medium">Vehicles crossed gate</span>
          </div>
        </div>
      </div>

      {/* Offices Overview Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Your Branch Offices</h3>
            <p className="text-xs text-gray-500">
              Offices currently assigned to your CEO executive account.
            </p>
          </div>
          <Link
            to="/ceo/offices"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center"
          >
            Manage All Offices <ArrowRight size={14} className="ml-1" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-3 font-medium">Office Name</th>
                <th className="px-6 py-3 font-medium">Address</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium text-center">Employees</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.offices.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    You do not have any offices yet. Click "Manage Offices" to add your first branch.
                  </td>
                </tr>
              ) : (
                summary.offices.map((office) => (
                  <tr key={office.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold text-gray-900">{office.name}</td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{office.address || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{office.phone || '—'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono font-medium">
                        {office.employeeCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        office.status === 'INACTIVE' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {office.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link
                        to="/ceo/employees"
                        className="inline-flex items-center px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium"
                      >
                        View Staff
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Operational Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/bills"
          className="p-5 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-gray-800 group-hover:text-blue-600">Billing & Sales</h4>
            <Receipt className="text-gray-400 group-hover:text-blue-600" size={20} />
          </div>
          <p className="text-xs text-gray-500">
            Inspect, approve, and review sale vouchers and finalized billing across your offices.
          </p>
        </Link>

        <Link
          to="/purchases"
          className="p-5 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-emerald-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-gray-800 group-hover:text-emerald-600">Purchase Approvals</h4>
            <Activity className="text-gray-400 group-hover:text-emerald-600" size={20} />
          </div>
          <p className="text-xs text-gray-500">
            Review submitted purchase vouchers and grant executive CEO approvals.
          </p>
        </Link>

        <Link
          to="/weighbridge"
          className="p-5 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-amber-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-gray-800 group-hover:text-amber-600">Weighbridge & Gate</h4>
            <Truck className="text-gray-400 group-hover:text-amber-600" size={20} />
          </div>
          <p className="text-xs text-gray-500">
            Monitor weighbridge tare/gross readings and approve weight discrepancies.
          </p>
        </Link>
      </div>
    </div>
  );
};

export default CeoDashboard;
