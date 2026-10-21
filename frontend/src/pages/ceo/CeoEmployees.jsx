import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Edit2, 
  ShieldCheck, 
  Mail, 
  Phone, 
  Building2, 
  Filter 
} from 'lucide-react';
import ceoService from '../../services/ceoService';

const CeoEmployees = () => {
  const [searchParams] = useSearchParams();
  const initialOfficeFilter = searchParams.get('officeId') || 'ALL';

  const [employees, setEmployees] = useState([]);
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOffice, setSelectedOffice] = useState(initialOfficeFilter);
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEmployeeId, setCurrentEmployeeId] = useState(null);
  const [modalData, setModalData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    phone: '',
    organizationId: '',
    role: 'ADMIN',
    status: 'ACTIVE'
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [empData, officeData] = await Promise.all([
        ceoService.getEmployees(),
        ceoService.getOffices()
      ]);
      setEmployees(empData || []);
      setOffices(officeData || []);
    } catch (err) {
      console.error('Failed to load employee data:', err);
      setError(err.response?.data?.error || 'Failed to load employees.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setCurrentEmployeeId(null);
    setModalData({
      fullName: '',
      username: '',
      email: '',
      password: '',
      phone: '',
      organizationId: offices.length > 0 ? String(offices[0].id) : '',
      role: 'ADMIN',
      status: 'ACTIVE'
    });
    setModalError('');
    setShowModal(true);
  };

  const handleOpenEditModal = (emp) => {
    setIsEditing(true);
    setCurrentEmployeeId(emp.id);
    setModalData({
      fullName: emp.fullName || '',
      username: emp.username,
      email: emp.email,
      password: '', // optional on edit
      phone: emp.phone || '',
      organizationId: emp.organizationId ? String(emp.organizationId) : '',
      role: emp.role || 'ADMIN',
      status: emp.status || 'ACTIVE'
    });
    setModalError('');
    setShowModal(true);
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!modalData.organizationId) {
      setModalError('Please select an office for this employee.');
      return;
    }

    if (!isEditing && (!modalData.username || !modalData.email || !modalData.password)) {
      setModalError('Username, email, and password are required.');
      return;
    }

    const payload = {
      ...modalData,
      organizationId: modalData.organizationId,
      officeId: modalData.organizationId
    };

    try {
      setSubmitting(true);
      if (isEditing) {
        await ceoService.updateEmployee(currentEmployeeId, payload);
      } else {
        await ceoService.createEmployee(payload);
      }
      setShowModal(false);
      await loadData();
    } catch (err) {
      console.error(err);
      setModalError(err.response?.data?.error || 'Failed to save employee.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await ceoService.updateEmployeeStatus(id, newStatus);
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update employee status.');
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      (emp.fullName && emp.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.username && emp.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.email && emp.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesOffice = selectedOffice === 'ALL' || String(emp.organizationId) === String(selectedOffice);
    const matchesRole = selectedRole === 'ALL' || emp.role === selectedRole;
    const matchesStatus = selectedStatus === 'ALL' || (emp.status || 'ACTIVE') === selectedStatus;

    return matchesSearch && matchesOffice && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Branch Workforce & Employees</h2>
          <p className="text-sm text-gray-500 mt-1">
            Assign staff to your branch offices and manage roles and duty assignments.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/super-admin/duty-assignment"
            className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center shadow-sm transition-colors"
          >
            <ShieldCheck size={16} className="mr-1.5" />
            Duty Assignment
          </Link>
          <button
            onClick={handleOpenAddModal}
            disabled={offices.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center shadow-sm transition-colors disabled:opacity-50"
          >
            <Plus size={16} className="mr-1.5" />
            Add New Employee
          </button>
        </div>
      </div>

      {offices.length === 0 && !loading && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
          <strong>Notice:</strong> You currently have no branch offices. Please create a branch office first before adding employees.
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Employees Table Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/50">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <select
              value={selectedOffice}
              onChange={(e) => setSelectedOffice(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Branch Offices</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>

            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="OPERATIONS_BILLING">OPERATIONS_BILLING</option>
              <option value="WEIGHBRIDGE_CONTROLLER">WEIGHBRIDGE_CONTROLLER</option>
              <option value="PAYMENT_COLLECTOR">PAYMENT_COLLECTOR</option>
              <option value="USER">USER</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-3.5 font-medium">Employee Name</th>
                <th className="px-6 py-3.5 font-medium">Assigned Office</th>
                <th className="px-6 py-3.5 font-medium">Role</th>
                <th className="px-6 py-3.5 font-medium">Email / Contact</th>
                <th className="px-6 py-3.5 font-medium">Status</th>
                <th className="px-6 py-3.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                      Loading branch employees...
                    </div>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No employees found matching the filters. Click "Add New Employee" to register staff.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{emp.fullName || emp.username}</div>
                      <div className="text-xs text-gray-500 font-mono">@{emp.username}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-blue-700">
                      <span className="px-2 py-0.5 bg-blue-50 rounded">
                        {emp.officeName || emp.office?.name || offices.find(o => String(o.id) === String(emp.organizationId))?.name || 'Unassigned'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-mono">
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      <div className="flex items-center">
                        <Mail size={12} className="mr-1 text-gray-400" />
                        {emp.email}
                      </div>
                      {emp.phone && (
                        <div className="flex items-center text-gray-400 mt-0.5">
                          <Phone size={12} className="mr-1 text-gray-400" />
                          {emp.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(emp.id, emp.status || 'ACTIVE')}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                          (emp.status || 'ACTIVE') === 'ACTIVE'
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                        title="Click to toggle status"
                      >
                        {(emp.status || 'ACTIVE') === 'ACTIVE' ? (
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
                        onClick={() => handleOpenEditModal(emp)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors"
                        title="Edit Employee"
                      >
                        <Edit2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 text-sm">
                {isEditing ? 'Edit Employee Details' : 'Register New Employee'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Assigned Branch Office *
                </label>
                <select
                  required
                  value={modalData.organizationId}
                  onChange={(e) => setModalData({ ...modalData, organizationId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Office --</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={modalData.fullName}
                  onChange={(e) => setModalData({ ...modalData, fullName: e.target.value })}
                  placeholder="e.g. Alice Smith"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  disabled={isEditing}
                  value={modalData.username}
                  onChange={(e) => setModalData({ ...modalData, username: e.target.value })}
                  placeholder="e.g. alicesmith"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={modalData.email}
                  onChange={(e) => setModalData({ ...modalData, email: e.target.value })}
                  placeholder="e.g. alice@office.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {isEditing ? 'New Password (leave blank to keep current)' : 'Password *'}
                </label>
                <input
                  type="password"
                  required={!isEditing}
                  value={modalData.password}
                  onChange={(e) => setModalData({ ...modalData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Role Assignment *
                </label>
                <select
                  required
                  value={modalData.role}
                  onChange={(e) => setModalData({ ...modalData, role: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ADMIN">ADMIN (Office Manager)</option>
                  <option value="OPERATIONS_BILLING">OPERATIONS_BILLING (Billing & Dispatch)</option>
                  <option value="WEIGHBRIDGE_CONTROLLER">WEIGHBRIDGE_CONTROLLER (Weighbridge & Gate)</option>
                  <option value="PAYMENT_COLLECTOR">PAYMENT_COLLECTOR</option>
                  <option value="USER">USER</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={modalData.phone}
                  onChange={(e) => setModalData({ ...modalData, phone: e.target.value })}
                  placeholder="+91 98765 11111"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : isEditing ? 'Update Employee' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CeoEmployees;
