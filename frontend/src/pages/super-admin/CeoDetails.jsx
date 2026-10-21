import React, { useState, useEffect, useMemo } from 'react';
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
  RefreshCw,
  Search,
  Eye,
  DollarSign,
  TrendingUp,
  X,
  ExternalLink,
  ChevronRight
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
  const [recordSearchQuery, setRecordSearchQuery] = useState('');

  // Employee tab filters
  const [employeeOfficeFilter, setEmployeeOfficeFilter] = useState('');
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');

  // Inspect Record Modal State (for Bills, Estimates, Purchases)
  const [inspectModalRecord, setInspectModalRecord] = useState(null);
  const [inspectModalType, setInspectModalType] = useState(''); // 'bill' | 'estimate' | 'purchase'

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
      setModuleRecords(Array.isArray(data) ? data : data?.records || []);
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

  // Safe destructuring with defensive fallbacks
  const ceo = ceoData?.ceo || {};
  const offices = ceoData?.offices || [];
  const employees = ceoData?.employees || [];
  const stats = ceoData?.stats || {};
  const counts = ceoData?.counts || {
    offices: offices.length,
    employees: employees.length
  };

  const modulesList = [
    { key: 'bills', label: 'Sale Bills', icon: Receipt },
    { key: 'estimates', label: 'Estimates', icon: FileText },
    { key: 'purchases', label: 'Purchases', icon: ShoppingCart },
    { key: 'products', label: 'Products & Stock', icon: Package },
    { key: 'customers', label: 'Customers', icon: User },
    { key: 'weighbridge', label: 'Weighbridge Records', icon: Scale },
    { key: 'gate-passes', label: 'Gate Passes', icon: Ticket },
  ];

  // Quick navigation to inspect a specific office
  const handleInspectOffice = (officeId) => {
    setSelectedOfficeFilter(String(officeId));
    setActiveTab('records');
  };

  // Quick navigation to view employees of an office
  const handleViewOfficeEmployees = (officeId) => {
    setEmployeeOfficeFilter(String(officeId));
    setActiveTab('employees');
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesOffice = !employeeOfficeFilter || String(emp.organizationId) === String(employeeOfficeFilter);
      const q = employeeSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        (emp.fullName && emp.fullName.toLowerCase().includes(q)) ||
        (emp.username && emp.username.toLowerCase().includes(q)) ||
        (emp.email && emp.email.toLowerCase().includes(q)) ||
        (emp.role && emp.role.toLowerCase().includes(q)) ||
        (emp.officeName && emp.officeName.toLowerCase().includes(q));
      return matchesOffice && matchesSearch;
    });
  }, [employees, employeeOfficeFilter, employeeSearchQuery]);

  // Filtered records
  const filteredModuleRecords = useMemo(() => {
    if (!recordSearchQuery.trim()) return moduleRecords;
    const q = recordSearchQuery.toLowerCase().trim();
    return moduleRecords.filter(item => {
      const number = (item.billNumber || item.estimateNumber || item.purchaseNumber || item.weighingNumber || item.gatePassNumber || item.name || '').toLowerCase();
      const office = (item.Organization?.name || '').toLowerCase();
      const customer = (item.Customer?.name || item.supplierName || item.vendorName || item.vehicleNumber || item.category || '').toLowerCase();
      const status = (item.status || '').toLowerCase();
      return number.includes(q) || office.includes(q) || customer.includes(q) || status.includes(q);
    });
  }, [moduleRecords, recordSearchQuery]);

  if (loading) {
    return (
      <div className="min-h-96 flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
        <span className="text-gray-600 font-medium">Loading CEO executive profile and office data...</span>
      </div>
    );
  }

  if (error || !ceoData) {
    return (
      <div className="space-y-4 p-6">
        <Link to="/super-admin/dashboard" className="inline-flex items-center text-sm text-blue-600 hover:underline">
          <ArrowLeft size={16} className="mr-1" /> Back to Super Admin Dashboard
        </Link>
        <div className="p-5 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          {error || 'CEO account could not be found or has been removed.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Executive Actions */}
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
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900">
                {ceo.fullName || ceo.username}
              </h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                ceo.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {ceo.status === 'ACTIVE' ? (
                  <><CheckCircle2 size={12} className="mr-1 text-green-600" /> Active CEO</>
                ) : (
                  <><XCircle size={12} className="mr-1 text-red-600" /> Suspended</>
                )}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Assigned CEO ID #{ceo.id} &bull; Member since {new Date(ceo.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleStatus}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition-colors ${
              ceo.status === 'ACTIVE'
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-green-50 hover:bg-green-100 text-green-800 border border-green-200'
            }`}
          >
            {ceo.status === 'ACTIVE' ? 'Suspend Account' : 'Activate CEO'}
          </button>
          <button
            onClick={handleOpenAssignModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center shadow-sm transition-colors"
          >
            <Plus size={14} className="mr-1" />
            Assign Office
          </button>
        </div>
      </div>

      {/* CEO Executive Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-gray-500 font-medium">Username</span>
            <div className="text-sm font-semibold text-gray-800">@{ceo.username}</div>
          </div>
          <div>
            <span className="text-xs text-gray-500 font-medium">Email Address</span>
            <div className="text-sm font-semibold text-gray-800 flex items-center truncate">
              <Mail size={13} className="mr-1.5 text-gray-400 flex-shrink-0" />
              <span className="truncate">{ceo.email || '—'}</span>
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-500 font-medium">Phone Number</span>
            <div className="text-sm font-semibold text-gray-800 flex items-center">
              <Phone size={13} className="mr-1.5 text-gray-400 flex-shrink-0" />
              {ceo.phone || 'Not provided'}
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-500 font-medium">Managed Hierarchy</span>
            <div className="text-sm font-semibold text-blue-600">
              {counts.offices} Offices &bull; {counts.employees} Employees
            </div>
          </div>
        </div>
      </div>

      {/* Cross-Office Aggregate Performance Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
            <span>Offices</span>
            <Building2 size={16} className="text-blue-500" />
          </div>
          <div className="text-xl font-bold text-gray-800">{counts.offices}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Assigned Branches</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
            <span>Employees</span>
            <Users size={16} className="text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-gray-800">{counts.employees}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Under this CEO</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
            <span>Sales Revenue</span>
            <DollarSign size={16} className="text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600 truncate">
            ₹{stats.billsTotalAmount ? Math.round(stats.billsTotalAmount).toLocaleString() : 0}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">{stats.billsCount || 0} Total Bills</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
            <span>Purchases</span>
            <ShoppingCart size={16} className="text-amber-500" />
          </div>
          <div className="text-xl font-bold text-gray-800">{stats.purchasesCount || 0}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Orders Placed</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
            <span>Estimates</span>
            <FileText size={16} className="text-purple-500" />
          </div>
          <div className="text-xl font-bold text-gray-800">{stats.estimatesCount || 0}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Issued Quotes</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
            <span>Products</span>
            <Package size={16} className="text-teal-500" />
          </div>
          <div className="text-xl font-bold text-gray-800">{stats.productsCount || 0}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Catalog Items</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 bg-white px-4 rounded-t-xl border">
        <nav className="flex space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('offices')}
            className={`py-3.5 px-1 border-b-2 flex items-center gap-2 transition-colors ${
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
            className={`py-3.5 px-1 border-b-2 flex items-center gap-2 transition-colors ${
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
            className={`py-3.5 px-1 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'records'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers size={16} />
            Cross-Office Operations &amp; Records
          </button>
        </nav>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MANAGED OFFICES WITH PER-OFFICE DRILL-DOWN                         */}
      {/* ========================================================================= */}
      {activeTab === 'offices' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-800 text-base">Offices Owned &amp; Managed by {ceo.fullName || ceo.username}</h3>
              <p className="text-xs text-gray-500">
                Super Admin can inspect individual branch operations, financial volume, and staff allocations.
              </p>
            </div>
            <button
              onClick={handleOpenAssignModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center shadow-sm transition-colors"
            >
              <Plus size={14} className="mr-1" /> Assign Another Office
            </button>
          </div>

          {offices.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
              <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
              <h4 className="font-semibold text-gray-700">No Offices Assigned</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                This CEO has not been assigned any office branches yet. Click "Assign Another Office" above to link an office to this CEO.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offices.map((office) => (
                <div key={office.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 transition-all p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                          <Building2 size={18} className="text-blue-600" />
                          {office.name}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {office.address ? office.address : 'No address specified'}
                          {office.phone ? ` • Ph: ${office.phone}` : ''}
                        </p>
                      </div>
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        office.status === 'INACTIVE' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {office.status || 'ACTIVE'}
                      </span>
                    </div>

                    {/* Operational Statistics for this office */}
                    <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4 text-center">
                      <div>
                        <span className="text-[11px] text-gray-500 block">Revenue</span>
                        <span className="text-xs font-bold text-emerald-600">
                          ₹{office.billsTotalAmount ? Math.round(office.billsTotalAmount).toLocaleString() : 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-gray-500 block">Bills Issued</span>
                        <span className="text-xs font-bold text-gray-800">{office.billsCount || 0}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-gray-500 block">Purchases</span>
                        <span className="text-xs font-bold text-gray-800">{office.purchasesCount || 0}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-200">
                        <span className="text-[11px] text-gray-500 block">Estimates</span>
                        <span className="text-xs font-bold text-gray-800">{office.estimatesCount || 0}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-200">
                        <span className="text-[11px] text-gray-500 block">Products</span>
                        <span className="text-xs font-bold text-gray-800">{office.productsCount || 0}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-200">
                        <span className="text-[11px] text-gray-500 block">Staff</span>
                        <span className="text-xs font-bold text-blue-600">{office.employeeCount || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleInspectOffice(office.id)}
                      className="flex-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center transition-colors"
                    >
                      <Layers size={13} className="mr-1.5" />
                      Inspect Records
                    </button>
                    <button
                      onClick={() => handleViewOfficeEmployees(office.id)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center transition-colors"
                      title="View employees assigned to this office"
                    >
                      <Users size={13} className="mr-1.5" />
                      Staff ({office.employeeCount || 0})
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ASSIGNED EMPLOYEES                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-gray-800">
                Staff Members Working in {ceo.fullName || ceo.username}'s Offices
              </h3>
              <p className="text-xs text-gray-500">
                All personnel deployed across managed office branches.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={employeeSearchQuery}
                  onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={employeeOfficeFilter}
                onChange={(e) => setEmployeeOfficeFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Offices</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">Employee</th>
                  <th className="px-6 py-3 font-medium">Branch Office</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Contact</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500 text-xs">
                      No employees match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-gray-900">{emp.fullName || emp.username}</div>
                        <div className="text-xs text-gray-500">@{emp.username}</div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                          {emp.officeName || emp.office?.name || offices.find(o => String(o.id) === String(emp.organizationId))?.name || 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-mono">
                          {emp.role}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-gray-600">
                        <div>{emp.email || '—'}</div>
                        {emp.phone && <div className="text-gray-400">{emp.phone}</div>}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          emp.status === 'INACTIVE' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {emp.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-gray-500">
                        {emp.createdAt ? new Date(emp.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CROSS-OFFICE BUSINESS RECORDS                                      */}
      {/* ========================================================================= */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {modulesList.map((m) => {
                const IconComponent = m.icon;
                const isSelected = selectedModule === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => {
                      setSelectedModule(m.key);
                      setRecordSearchQuery('');
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm font-semibold'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <IconComponent size={14} />
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter size={15} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-600">Branch Office:</span>
                <select
                  value={selectedOfficeFilter}
                  onChange={(e) => setSelectedOfficeFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">All CEO Offices</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <button
                  onClick={fetchModuleData}
                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors"
                  title="Reload records from database"
                >
                  <RefreshCw size={14} className={loadingModuleData ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter records..."
                  value={recordSearchQuery}
                  onChange={(e) => setRecordSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {moduleError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
              {moduleError}
            </div>
          )}

          {/* Module Records Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <span>Database Records: {modulesList.find(m => m.key === selectedModule)?.label}</span>
                {selectedOfficeFilter && (
                  <span className="text-xs font-normal text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    Filtered by: {offices.find(o => String(o.id) === String(selectedOfficeFilter))?.name}
                  </span>
                )}
              </h3>
              <span className="text-xs text-gray-500 font-mono">
                Showing {filteredModuleRecords.length} records
              </span>
            </div>

            <div className="overflow-x-auto">
              {loadingModuleData ? (
                <div className="py-16 flex flex-col justify-center items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                  <span className="text-gray-500 text-xs">Querying database records for {ceo.fullName || ceo.username}'s offices...</span>
                </div>
              ) : filteredModuleRecords.length === 0 ? (
                <div className="py-16 text-center text-gray-500 text-sm">
                  <p className="font-medium text-gray-600">No records found</p>
                  <p className="text-xs text-gray-400 mt-1">
                    No matching {selectedModule} records in the selected office(s).
                  </p>
                </div>
              ) : (
                /* Dynamic Table based on selected module */
                selectedModule === 'bills' ? (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                        <th className="px-6 py-3 font-medium">Bill Number</th>
                        <th className="px-6 py-3 font-medium">Office</th>
                        <th className="px-6 py-3 font-medium">Customer</th>
                        <th className="px-6 py-3 font-medium">Products / Items</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium text-right">Amount</th>
                        <th className="px-6 py-3 font-medium">Date</th>
                        <th className="px-6 py-3 font-medium text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredModuleRecords.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3.5 font-mono text-xs font-bold text-gray-900">
                            {item.billNumber}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-700">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                              {item.Organization?.name || 'Assigned Office'}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-900 font-medium">
                            {item.Customer?.name || '—'}
                            {item.Customer?.phone && <span className="text-gray-400 block text-[11px]">{item.Customer.phone}</span>}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-600 max-w-xs truncate">
                            {item.items && item.items.length > 0 ? (
                              item.items.map(it => `${it.productNameSnapshot} (${it.quantity} ${it.unit || 'Ton'})`).join(', ')
                            ) : (
                              'No items'
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              item.status === 'FINALIZED' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {item.status || 'RECORDED'}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 font-mono text-xs font-bold text-gray-900 text-right">
                            ₹{parseFloat(item.finalAmount || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-500">
                            {item.billDate ? new Date(item.billDate).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-6 py-3.5 text-center">
                            <button
                              onClick={() => {
                                setInspectModalRecord(item);
                                setInspectModalType('bill');
                              }}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium p-1 hover:bg-blue-50 rounded"
                              title="Inspect full transaction details"
                            >
                              <Eye size={14} /> View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : selectedModule === 'estimates' ? (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                        <th className="px-6 py-3 font-medium">Estimate Number</th>
                        <th className="px-6 py-3 font-medium">Office</th>
                        <th className="px-6 py-3 font-medium">Customer</th>
                        <th className="px-6 py-3 font-medium">Products / Items</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium text-right">Amount</th>
                        <th className="px-6 py-3 font-medium">Date</th>
                        <th className="px-6 py-3 font-medium text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredModuleRecords.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3.5 font-mono text-xs font-bold text-gray-900">
                            {item.estimateNumber}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-700">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                              {item.Organization?.name || 'Assigned Office'}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-900 font-medium">
                            {item.Customer?.name || '—'}
                            {item.Customer?.phone && <span className="text-gray-400 block text-[11px]">{item.Customer.phone}</span>}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-600 max-w-xs truncate">
                            {item.items && item.items.length > 0 ? (
                              item.items.map(it => `${it.productNameSnapshot} (${it.quantity} ${it.unit || 'Ton'})`).join(', ')
                            ) : (
                              'No items'
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-800">
                              {item.status || 'RECORDED'}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 font-mono text-xs font-bold text-gray-900 text-right">
                            ₹{parseFloat(item.finalAmount || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-500">
                            {item.estimateDate ? new Date(item.estimateDate).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-6 py-3.5 text-center">
                            <button
                              onClick={() => {
                                setInspectModalRecord(item);
                                setInspectModalType('estimate');
                              }}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium p-1 hover:bg-blue-50 rounded"
                              title="Inspect estimate details"
                            >
                              <Eye size={14} /> View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : selectedModule === 'purchases' ? (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                        <th className="px-6 py-3 font-medium">Order ID</th>
                        <th className="px-6 py-3 font-medium">Office</th>
                        <th className="px-6 py-3 font-medium">Supplier / Party</th>
                        <th className="px-6 py-3 font-medium">Products (Ordered / Recv)</th>
                        <th className="px-6 py-3 font-medium">Order Status</th>
                        <th className="px-6 py-3 font-medium">Date</th>
                        <th className="px-6 py-3 font-medium text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredModuleRecords.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3.5 font-mono text-xs font-bold text-gray-900">
                            {item.purchaseNumber}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-700">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                              {item.Organization?.name || 'Assigned Office'}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-900 font-medium">
                            {item.vendorName || '—'}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-600 max-w-sm truncate">
                            {item.items && item.items.length > 0 ? (
                              item.items.map(it => `${it.productNameSnapshot} [${it.carbonType || 'Low Carbon'}]: ${it.receivedQuantity || 0}/${it.quantity} Ton`).join(', ')
                            ) : (
                              `${item.totalQuantity || 0} Ton`
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              item.status === 'Fully Received' ? 'bg-emerald-100 text-emerald-800' :
                              item.status === 'Partially Received' ? 'bg-amber-100 text-amber-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {item.status || 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-500">
                            {item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-6 py-3.5 text-center">
                            <button
                              onClick={() => {
                                setInspectModalRecord(item);
                                setInspectModalType('purchase');
                              }}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium p-1 hover:bg-blue-50 rounded"
                              title="Inspect purchase order details"
                            >
                              <Eye size={14} /> View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : selectedModule === 'products' ? (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                        <th className="px-6 py-3 font-medium">Product Name</th>
                        <th className="px-6 py-3 font-medium">Office</th>
                        <th className="px-6 py-3 font-medium">Category / Size</th>
                        <th className="px-6 py-3 font-medium text-right">Current Stock Left</th>
                        <th className="px-6 py-3 font-medium text-right">Default Rate</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredModuleRecords.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3.5 font-semibold text-gray-900 text-xs">
                            {item.name}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-700">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                              {item.Organization?.name || 'Assigned Office'}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-600">
                            {item.category || 'General'} {item.size && item.size !== '-' ? `• ${item.size}` : ''}
                          </td>
                          <td className="px-6 py-3.5 font-mono text-xs font-bold text-emerald-700 text-right">
                            {parseFloat(item.currentStock || 0).toFixed(3)} Ton
                          </td>
                          <td className="px-6 py-3.5 font-mono text-xs font-medium text-gray-800 text-right">
                            ₹{parseFloat(item.price || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-3.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.status === 'INACTIVE' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {item.status || 'ACTIVE'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : selectedModule === 'customers' ? (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                        <th className="px-6 py-3 font-medium">Customer Name</th>
                        <th className="px-6 py-3 font-medium">Office</th>
                        <th className="px-6 py-3 font-medium">Phone Number</th>
                        <th className="px-6 py-3 font-medium">City / Address</th>
                        <th className="px-6 py-3 font-medium">TIN / GST</th>
                        <th className="px-6 py-3 font-medium">Created Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredModuleRecords.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3.5 font-semibold text-gray-900 text-xs">
                            {item.name}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-700">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                              {item.Organization?.name || 'Assigned Office'}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-600">
                            {item.phone || '—'}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-600 max-w-xs truncate">
                            {item.city ? `${item.city}, ` : ''}{item.address || '—'}
                          </td>
                          <td className="px-6 py-3.5 font-mono text-xs text-gray-600">
                            {item.tin || '—'}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-gray-500">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  /* Weighbridge & Gate Passes */
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                        <th className="px-6 py-3 font-medium">Slip / Pass Number</th>
                        <th className="px-6 py-3 font-medium">Office</th>
                        <th className="px-6 py-3 font-medium">Vehicle / Entity</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium">Quantity / Weight</th>
                        <th className="px-6 py-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredModuleRecords.map((item) => {
                        const number = item.weighingNumber || item.gatePassNumber || `#${item.id}`;
                        const officeName = item.Organization?.name || 'Assigned Office';
                        const entity = item.vehicleNumber || item.driverName || '—';
                        const status = item.status || 'RECORDED';
                        const weight = item.netWeight ? `${item.netWeight} ${item.weightUnit || 'Kg'}` : item.gatePassType || '—';
                        const date = item.weighedAt || item.createdAt;

                        return (
                          <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3.5 font-mono text-xs font-bold text-gray-900">
                              {number}
                            </td>
                            <td className="px-6 py-3.5 text-xs text-gray-700">
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                                {officeName}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-xs text-gray-800 font-medium">
                              {entity}
                            </td>
                            <td className="px-6 py-3.5">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-800">
                                {status}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 font-mono text-xs text-gray-800">
                              {weight}
                            </td>
                            <td className="px-6 py-3.5 text-xs text-gray-500">
                              {date ? new Date(date).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INSPECT TRANSACTION RECORD DETAILS MODAL                                  */}
      {/* ========================================================================= */}
      {inspectModalRecord && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <span>
                    {inspectModalType === 'bill' ? 'Sale Bill Inspection' :
                     inspectModalType === 'estimate' ? 'Estimate Inspection' : 'Purchase Order Inspection'}
                  </span>
                  <span className="font-mono text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    {inspectModalRecord.billNumber || inspectModalRecord.estimateNumber || inspectModalRecord.purchaseNumber}
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Office: {inspectModalRecord.Organization?.name || 'Assigned Office'} &bull; Date: {
                    new Date(inspectModalRecord.billDate || inspectModalRecord.estimateDate || inspectModalRecord.purchaseDate || inspectModalRecord.createdAt).toLocaleDateString()
                  }
                </p>
              </div>
              <button
                onClick={() => setInspectModalRecord(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Party / Customer details */}
              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-500 block font-medium">
                    {inspectModalType === 'purchase' ? 'Supplier / Party' : 'Customer Name'}
                  </span>
                  <span className="font-semibold text-gray-900 text-sm">
                    {inspectModalRecord.Customer?.name || inspectModalRecord.vendorName || 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block font-medium">Status</span>
                  <span className="font-semibold text-gray-900">
                    {inspectModalRecord.status || 'RECORDED'}
                  </span>
                </div>
                {inspectModalRecord.Customer?.phone && (
                  <div>
                    <span className="text-gray-500 block font-medium">Phone</span>
                    <span className="text-gray-800">{inspectModalRecord.Customer.phone}</span>
                  </div>
                )}
                {inspectModalRecord.Customer?.city && (
                  <div>
                    <span className="text-gray-500 block font-medium">City / Location</span>
                    <span className="text-gray-800">{inspectModalRecord.Customer.city}</span>
                  </div>
                )}
              </div>

              {/* Itemized Breakdown Table */}
              <div>
                <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wider mb-2">
                  Line Items &amp; Products
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                      <tr>
                        <th className="px-4 py-2 font-medium">Product / Description</th>
                        {inspectModalType === 'purchase' ? (
                          <>
                            <th className="px-4 py-2 font-medium">Carbon Type</th>
                            <th className="px-4 py-2 font-medium text-right">Ordered Qty</th>
                            <th className="px-4 py-2 font-medium text-right">Received Qty</th>
                            <th className="px-4 py-2 font-medium text-right">Pending Qty</th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-2 font-medium text-right">Quantity</th>
                            <th className="px-4 py-2 font-medium text-right">Rate</th>
                            <th className="px-4 py-2 font-medium text-right">Amount</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {inspectModalRecord.items && inspectModalRecord.items.length > 0 ? (
                        inspectModalRecord.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-900">
                              {it.productNameSnapshot}
                              {it.productCategorySnapshot && (
                                <span className="text-gray-400 block text-[11px]">{it.productCategorySnapshot}</span>
                              )}
                            </td>
                            {inspectModalType === 'purchase' ? (
                              <>
                                <td className="px-4 py-2.5 text-gray-700">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    it.carbonType === 'High Carbon' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {it.carbonType || 'Low Carbon'}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono font-medium">
                                  {it.quantity} {it.unit || 'Ton'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono text-emerald-700 font-medium">
                                  {it.receivedQuantity || 0} {it.unit || 'Ton'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono text-amber-700 font-medium">
                                  {it.pendingQuantity !== undefined ? it.pendingQuantity : (parseFloat(it.quantity) - parseFloat(it.receivedQuantity || 0))} {it.unit || 'Ton'}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-2.5 text-right font-mono">
                                  {it.quantity} {it.unit || 'Ton'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono">
                                  ₹{parseFloat(it.rate || 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-900">
                                  ₹{parseFloat(it.amount || 0).toLocaleString()}
                                </td>
                              </>
                            )}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="px-4 py-4 text-center text-gray-400">
                            No individual line item records recorded for this transaction.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Financial Summary (if Bill or Estimate) */}
              {(inspectModalRecord.finalAmount || inspectModalRecord.totalAmount) && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-700 uppercase">Grand Total Amount</span>
                  <span className="text-base font-bold text-gray-900 font-mono">
                    ₹{parseFloat(inspectModalRecord.finalAmount || inspectModalRecord.totalAmount || 0).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setInspectModalRecord(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-medium transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ASSIGN OFFICE MODAL                                                       */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Assign Office to {ceo.fullName || ceo.username}</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAssignOffice} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Select Office Branch
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
                      {org.name} (ID: #{org.id}) {org.ceoId === ceo.id ? '✓ Already Owned' : org.ceoId ? `[Managed by CEO #${org.ceoId}]` : '[Unassigned Branch]'}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Assigning an office branch grants this CEO exclusive authority over its operations, inventory, and employees.
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
