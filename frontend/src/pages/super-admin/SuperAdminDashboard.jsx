import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Users, 
  Building2, 
  ShieldCheck, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Search, 
  ExternalLink,
  Phone,
  Mail,
  UserCheck
} from 'lucide-react';
import superAdminService from '../../services/superAdminService';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [ceos, setCeos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Create CEO Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [newCeo, setNewCeo] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    phone: '',
    status: 'ACTIVE'
  });

  const fetchCeos = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await superAdminService.getCeos();
      setCeos(data || []);
    } catch (err) {
      console.error('Failed to fetch CEOs:', err);
      setError(err.response?.data?.error || 'Failed to load CEO accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCeos();
  }, []);

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await superAdminService.updateCeoStatus(id, newStatus);
      setCeos(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update CEO status.');
    }
  };

  const handleCreateCeo = async (e) => {
    e.preventDefault();
    setModalError('');
    if (!newCeo.username || !newCeo.email || !newCeo.password) {
      setModalError('Username, email, and password are required.');
      return;
    }

    try {
      setSubmitting(true);
      await superAdminService.createCeo(newCeo);
      setShowCreateModal(false);
      setNewCeo({
        username: '',
        email: '',
        password: '',
        fullName: '',
        phone: '',
        status: 'ACTIVE'
      });
      await fetchCeos();
    } catch (err) {
      console.error(err);
      setModalError(err.response?.data?.error || 'Failed to create CEO.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculations
  const totalCeos = ceos.length;
  const activeCeos = ceos.filter(c => c.status === 'ACTIVE').length;
  const totalOffices = ceos.reduce((acc, c) => acc + (c.officeCount || 0), 0);
  const totalEmployees = ceos.reduce((acc, c) => acc + (c.employeeCount || 0), 0);

  const filteredCeos = ceos.filter(c => {
    const matchesSearch = 
      (c.fullName && c.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.username && c.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Super Admin Executive Console</h2>
          <p className="text-sm text-gray-500 mt-1">
            Global hierarchy oversight: SUPER ADMIN &rarr; CEO &rarr; Office &rarr; Employees
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center shadow-sm transition-colors text-sm"
          >
            <Plus size={18} className="mr-1.5" />
            Add New CEO
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center">
          <div className="h-12 w-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mr-4">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total CEOs</p>
            <h3 className="text-2xl font-bold text-gray-800">{totalCeos}</h3>
            <span className="text-xs text-green-600 font-medium">{activeCeos} Active Accounts</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center">
          <div className="h-12 w-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mr-4">
            <Building2 size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Managed Offices</p>
            <h3 className="text-2xl font-bold text-gray-800">{totalOffices}</h3>
            <span className="text-xs text-gray-500">Across all CEOs</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center">
          <div className="h-12 w-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mr-4">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Staff</p>
            <h3 className="text-2xl font-bold text-gray-800">{totalEmployees}</h3>
            <span className="text-xs text-emerald-600 font-medium">Assigned to offices</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center">
          <div className="h-12 w-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mr-4">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Duty Controls</p>
            <h3 className="text-2xl font-bold text-gray-800">Active</h3>
            <Link to="/super-admin/duty-assignment" className="text-xs text-blue-600 hover:underline">
              Manage Permissions &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* CEO Accounts Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800">CEO Accounts</h3>
            <p className="text-xs text-gray-500">
              Each CEO has isolated ownership of their offices, employees, and operations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search CEOs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-60"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-3.5 font-medium">CEO Name / Username</th>
                <th className="px-6 py-3.5 font-medium">Contact</th>
                <th className="px-6 py-3.5 font-medium text-center">Offices</th>
                <th className="px-6 py-3.5 font-medium text-center">Employees</th>
                <th className="px-6 py-3.5 font-medium">Status</th>
                <th className="px-6 py-3.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                      Loading CEO accounts...
                    </div>
                  </td>
                </tr>
              ) : filteredCeos.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No CEO accounts found matching the criteria. Click "Add New CEO" to create one.
                  </td>
                </tr>
              ) : (
                filteredCeos.map((ceo) => (
                  <tr key={ceo.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{ceo.fullName || ceo.username}</div>
                      <div className="text-xs text-gray-500">@{ceo.username}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-xs text-gray-600 mb-1">
                        <Mail size={12} className="mr-1.5 text-gray-400" />
                        {ceo.email}
                      </div>
                      {ceo.phone && (
                        <div className="flex items-center text-xs text-gray-500">
                          <Phone size={12} className="mr-1.5 text-gray-400" />
                          {ceo.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-gray-700">
                      <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md font-mono text-xs">
                        {ceo.officeCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-gray-700">
                      <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md font-mono text-xs">
                        {ceo.employeeCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(ceo.id, ceo.status)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                          ceo.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                        title="Click to toggle status"
                      >
                        {ceo.status === 'ACTIVE' ? (
                          <>
                            <CheckCircle2 size={12} className="mr-1 text-green-600" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle size={12} className="mr-1 text-red-600" /> Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => navigate(`/super-admin/ceos/${ceo.id}`)}
                        className="inline-flex items-center px-3 py-1.5 bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-700 rounded-md text-xs font-medium transition-colors"
                      >
                        Inspect Details
                        <ArrowRight size={13} className="ml-1" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create CEO Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Add New CEO</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCeo} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newCeo.fullName}
                  onChange={(e) => setNewCeo({ ...newCeo, fullName: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={newCeo.username}
                  onChange={(e) => setNewCeo({ ...newCeo, username: e.target.value })}
                  placeholder="e.g. ceojohn"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={newCeo.email}
                  onChange={(e) => setNewCeo({ ...newCeo, email: e.target.value })}
                  placeholder="e.g. ceo@domain.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  value={newCeo.password}
                  onChange={(e) => setNewCeo({ ...newCeo, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={newCeo.phone}
                  onChange={(e) => setNewCeo({ ...newCeo, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create CEO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
