import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  Mail, 
  Phone, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Layers, 
  FileText, 
  Receipt, 
  ShoppingCart, 
  Scale, 
  Ticket, 
  Package, 
  User, 
  Filter, 
  RefreshCw 
} from 'lucide-react';
import superAdminService from '../../services/superAdminService';
import api from '../../services/api';

const CeoDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ceoData, setCeoData] = useState(null);

  // Tabs: 'offices' | 'employees' | 'records'
  const [activeTab, setActiveTab] = useState('offices');

  // Business Module Inspection State
  const [selectedModule, setSelectedModule] = useState('bills');
  const [selectedOfficeFilter, setSelectedOfficeFilter] = useState('');
  const [moduleRecords, setModuleRecords] = useState([]);
  const [loadingModuleData, setLoadingModuleData] = useState(false);
  const [moduleError, setModuleError] = useState('');

  // Assign Office Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [allOrganizations, setAllOrganizations] = useState([]);
  const [selectedOfficeToAssign, setSelectedOfficeToAssign] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchCeo = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await superAdminService.getCeoDetails(id);
      setCeoData(data);
    } catch (err) {
      console.error('Failed to load CEO details:', err);
      setError(err.response?.data?.error || 'Failed to load CEO details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCeo();
  }, [id]);

  const fetchModuleData = async () => {
    if (!id || activeTab !== 'records') return;
    try {
      setLoadingModuleData(true);
      setModuleError('');
      const data = await superAdminService.getCeoModuleData(
        id, 
        selectedModule, 
        selectedOfficeFilter || null
      );
      setModuleRecords(data || []);
    } catch (err) {
      console.error('Failed to load module records:', err);
      setModuleError(err.response?.data?.error || 'Failed to load module records.');
    } finally {
      setLoadingModuleData(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'records') {
      fetchModuleData();
    }
  }, [activeTab, selectedModule, selectedOfficeFilter, id]);

  const handleToggleStatus = async () => {
    if (!ceoData?.ceo) return;
    const currentStatus = ceoData.ceo.status;
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await superAdminService.updateCeoStatus(id, newStatus);
      setCeoData(prev => ({
        ...prev,
        ceo: { ...prev.ceo, status: newStatus }
      }));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update CEO status.');
    }
  };

  const handleOpenAssignModal = async () => {
    try {
      const res = await api.get('/organizations');
      setAllOrganizations(res.data || []);
      setShowAssignModal(true);
    } catch (err) {
      alert('Failed to load offices list.');
    }
  };

  const handleAssignOffice = async (e) => {
    e.preventDefault();
    if (!selectedOfficeToAssign) return;
    try {
      setAssigning(true);
      await superAdminService.assignOfficeToCeo(id, selectedOfficeToAssign);
      setShowAssignModal(false);
      setSelectedOfficeToAssign('');
      await fetchCeo();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to assign office to CEO.');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
        <span className="text-gray-600 font-medium">Loading CEO executive profile...</span>
      </div>
    );
  }

  if (error || !ceoData) {
    return (
      <div className="space-y-4">
        <Link to="/super-admin/dashboard" className="inline-flex items-center text-sm text-blue-600 hover:underline">
          <ArrowLeft size={16} className="mr-1" /> Back to Dashboard
        </Link>
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          {error || 'CEO not found.'}
        </div>
      </div>
    );
  }

  const { ceo, offices, employees, counts } = ceoData;

  const modulesList = [
    { key: 'bills', label: 'Sale Bills', icon: Receipt },
    { key: 'estimates', label: 'Estimates', icon: FileText },
    { key: 'purchases', label: 'Purchases', icon: ShoppingCart },
    { key: 'customers', label: 'Customers', icon: User },
    { key: 'products', label: 'Products', icon: Package },
    { key: 'weighbridge', label: 'Weighbridge Records', icon: Scale },
    { key: 'gate-passes', label: 'Gate Passes', icon: Ticket },
  ];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/super-admin/dashboard"
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span>{ceo.fullName || ceo.username}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                ceo.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {ceo.status}
              </span>
            </h2>
            <p className="text-xs text-gray-500">
              CEO Account ID #{ceo.id} &bull; Created {new Date(ceo.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleToggleStatus}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition-colors ${
              ceo.status === 'ACTIVE'
                ? 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                : 'bg-green-100 hover:bg-green-200 text-green-800'
            }`}
          >
            {ceo.status === 'ACTIVE' ? 'Suspend / Deactivate' : 'Activate CEO'}
          </button>
          <button
            onClick={handleOpenAssignModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center shadow-sm"
          >
            <Plus size={14} className="mr-1" />
            Assign Office
          </button>
        </div>
      </div>

      {/* CEO Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-gray-500 font-medium">Username</span>
            <div className="text-sm font-semibold text-gray-800">@{ceo.username}</div>
          </div>
          <div>
            <span className="text-xs text-gray-500 font-medium">Email Address</span>
            <div className="text-sm font-semibold text-gray-800 flex items-center">
              <Mail size={13} className="mr-1 text-gray-400" />
              {ceo.email}
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-500 font-medium">Phone</span>
            <div className="text-sm font-semibold text-gray-800 flex items-center">
              <Phone size={13} className="mr-1 text-gray-400" />
              {ceo.phone || 'Not provided'}
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-500 font-medium">Hierarchy Reach</span>
            <div className="text-sm font-semibold text-blue-600">
              {counts.offices} Offices &bull; {counts.employees} Employees
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('offices')}
            className={`pb-3 px-1 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'offices'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Building2 size={16} />
            Managed Offices ({offices.length})
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            className={`pb-3 px-1 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'employees'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={16} />
            Assigned Employees ({employees.length})
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`pb-3 px-1 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'records'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers size={16} />
            Cross-Office Business Records
          </button>
        </nav>
      </div>

      {/* Tab 1: Offices */}
      {activeTab === 'offices' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Offices Managed by {ceo.fullName || ceo.username}</h3>
            <button
              onClick={handleOpenAssignModal}
              className="text-xs text-blue-600 hover:underline flex items-center font-medium"
            >
              <Plus size={14} className="mr-1" /> Assign another office
            </button>
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
                  <th className="px-6 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {offices.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      No offices currently assigned to this CEO. Click "Assign Office" to link an office.
                    </td>
                  </tr>
                ) : (
                  offices.map((office) => (
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
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {new Date(office.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Employees */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">
              Employees Working Under {ceo.fullName || ceo.username}'s Offices
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">Employee Name</th>
                  <th className="px-6 py-3 font-medium">Office</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Email / Contact</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      No employees currently assigned to this CEO's offices.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{emp.fullName || emp.username}</div>
                        <div className="text-xs text-gray-500">@{emp.username}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-medium">
                        {emp.officeName || emp.office?.name || offices.find(o => String(o.id) === String(emp.organizationId))?.name || 'Unassigned'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-mono">
                          {emp.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600">
                        <div>{emp.email}</div>
                        {emp.phone && <div className="text-gray-400">{emp.phone}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          emp.status === 'INACTIVE' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {emp.status || 'ACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Cross-Office Business Records */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap gap-2">
              {modulesList.map((m) => {
                const IconComponent = m.icon;
                const isSelected = selectedModule === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setSelectedModule(m.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <IconComponent size={14} />
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter size={16} className="text-gray-400" />
              <select
                value={selectedOfficeFilter}
                onChange={(e) => setSelectedOfficeFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All CEO Offices</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <button
                onClick={fetchModuleData}
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded"
                title="Refresh Records"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {moduleError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs">
              {moduleError}
            </div>
          )}

          {/* Module Records Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 text-sm">
                Real Records: {modulesList.find(m => m.key === selectedModule)?.label}
              </h3>
              <span className="text-xs text-gray-500">
                Showing {moduleRecords.length} records
              </span>
            </div>

            <div className="overflow-x-auto">
              {loadingModuleData ? (
                <div className="py-12 flex justify-center items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                  <span className="text-gray-500 text-xs">Loading live database records...</span>
                </div>
              ) : moduleRecords.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm">
                  No records found for this module in the selected office(s).
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                      <th className="px-6 py-3 font-medium">Record ID / Number</th>
                      <th className="px-6 py-3 font-medium">Office</th>
                      <th className="px-6 py-3 font-medium">Entity / Details</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Amount / Quantity</th>
                      <th className="px-6 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {moduleRecords.map((item) => {
                      const number = item.billNumber || item.estimateNumber || item.purchaseNumber || item.weighingNumber || item.gatePassNumber || item.name || `#${item.id}`;
                      const officeName = item.Organization?.name || 'Assigned Office';
                      const entityName = item.Customer?.name || item.supplierName || item.vehicleNumber || item.category || '—';
                      const status = item.status || 'RECORDED';
                      const amount = item.finalAmount || item.grandTotal || item.totalAmount || (item.netWeight ? `${item.netWeight} ${item.weightUnit || 'Kg'}` : item.price ? `₹${item.price}` : '—');
                      const date = item.billDate || item.estimateDate || item.purchaseDate || item.weighedAt || item.createdAt;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3.5 font-semibold text-gray-900 font-mono text-xs">
                            {number}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-700">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                              {officeName}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-gray-700 text-xs">
                            {entityName}
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-800">
                              {status}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 font-mono text-xs font-semibold text-gray-800">
                            {typeof amount === 'number' ? `₹${amount.toLocaleString()}` : amount}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-500">
                            {date ? new Date(date).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Office Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Assign Office to {ceo.fullName || ceo.username}</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAssignOffice} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Select Office (Organization)
                </label>
                <select
                  required
                  value={selectedOfficeToAssign}
                  onChange={(e) => setSelectedOfficeToAssign(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose an Office --</option>
                  {allOrganizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} (ID: #{org.id}) {org.ceoId === ceo.id ? '✓ Already Owned' : org.ceoId ? `[CEO #${org.ceoId}]` : '[Unassigned]'}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Assigning an office gives this CEO exclusive management over the office and all its employees.
                </p>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedOfficeToAssign}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {assigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CeoDetails;
