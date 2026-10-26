import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { getAdminDashboardSummary } from '../../services/dutyAssignmentService';
import {
  Users,
  Package,
  FileText,
  Receipt,
  ShoppingCart,
  Scale,
  Ticket,
  Lock,
  Unlock,
  Building2,
  ShieldCheck,
  RefreshCw,
  Search,
  ExternalLink,
  Plus,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Wallet,
  BarChart3,
  ClipboardList,
  Clock,
  ArrowRight
} from 'lucide-react';

const MODULE_DEFINITIONS = [
  {
    id: 'BILLING',
    name: 'Billing / Sale Voucher',
    category: 'Sales & Invoicing',
    description: 'Create and finalize official sale vouchers, calculate GST, record negotiated prices, and print invoices.',
    icon: Receipt,
    path: '/bills',
    createPath: '/sale-voucher',
    createLabel: 'Sale Voucher',
    color: 'from-blue-600 to-indigo-700',
    lightBg: 'bg-blue-50 text-blue-700 border-blue-200',
    iconColor: 'text-blue-600',
    metricKey: 'BILLING',
    metricLabel: 'Bills Issued'
  },
  {
    id: 'ESTIMATES',
    name: 'Estimate Management',
    category: 'Sales & Invoicing',
    description: 'Draft initial price estimates, calculate approximate totals, and print quotation slips for customers.',
    icon: FileText,
    path: '/estimates',
    createPath: '/estimate-voucher',
    createLabel: 'New Estimate',
    color: 'from-emerald-600 to-teal-700',
    lightBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconColor: 'text-emerald-600',
    metricKey: 'ESTIMATES',
    metricLabel: 'Estimates Created'
  },
  {
    id: 'PURCHASES',
    name: 'Purchase Management',
    category: 'Procurement',
    description: 'Create supplier purchase vouchers, submit for Admin/CEO approval, track inward materials, and audit history.',
    icon: ShoppingCart,
    path: '/purchases',
    createPath: '/purchase-order',
    createLabel: 'Purchase Order',
    color: 'from-amber-600 to-orange-700',
    lightBg: 'bg-amber-50 text-amber-700 border-amber-200',
    iconColor: 'text-amber-600',
    metricKey: 'PURCHASES',
    metricLabel: 'Purchase Records'
  },
  {
    id: 'WEIGHBRIDGE',
    name: 'Weighbridge Management',
    category: 'Logistics & Dispatch',
    description: 'Record manual gross and tare weights for transport vehicles, detect weight variances, and link to billing.',
    icon: Scale,
    path: '/weighbridge',
    createPath: '/weighbridge/new',
    createLabel: 'Record Weight',
    color: 'from-cyan-600 to-blue-700',
    lightBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    iconColor: 'text-cyan-600',
    metricKey: 'WEIGHBRIDGE',
    metricLabel: 'Weighbridge Entries'
  },
  {
    id: 'GATE_PASS',
    name: 'Gate Pass Management',
    category: 'Logistics & Dispatch',
    description: 'Issue official exit passes with 10-minute validity timers, verify security release, and confirm dispatches.',
    icon: Ticket,
    path: '/gate-passes',
    createPath: '/gate-passes/new',
    createLabel: 'Issue Pass',
    color: 'from-violet-600 to-purple-700',
    lightBg: 'bg-violet-50 text-violet-700 border-violet-200',
    iconColor: 'text-violet-600',
    metricKey: 'GATE_PASS',
    metricLabel: 'Gate Passes Issued'
  },
  {
    id: 'CUSTOMER_MASTER',
    name: 'Customer Master',
    category: 'Master Data',
    description: 'Directory of approved customer accounts, contact numbers, TIN/GSTIN identifiers, and billing addresses.',
    icon: Users,
    path: '/customers',
    createPath: null,
    createLabel: null,
    color: 'from-rose-600 to-pink-700',
    lightBg: 'bg-rose-50 text-rose-700 border-rose-200',
    iconColor: 'text-rose-600',
    metricKey: 'CUSTOMER_MASTER',
    metricLabel: 'Registered Customers'
  },
  {
    id: 'PRODUCT_MASTER',
    name: 'Product Master',
    category: 'Master Data',
    description: 'Master catalog of reinforcing steel bars and pipes, standard measurement units, size diameters, and specs.',
    icon: Package,
    path: '/products',
    createPath: null,
    createLabel: null,
    color: 'from-teal-600 to-emerald-700',
    lightBg: 'bg-teal-50 text-teal-700 border-teal-200',
    iconColor: 'text-teal-600',
    metricKey: 'PRODUCT_MASTER',
    metricLabel: 'Catalog Products'
  }
];

const UPCOMING_MODULES = [
  { name: 'Payment Collections', icon: CreditCard, description: 'Ledger reconciliations, multi-mode customer payments, and receipts.', category: 'Finance' },
  { name: 'Expense Management', icon: Wallet, description: 'Office expenditures, petty cash logs, and expense approval chains.', category: 'Finance' },
  { name: 'Analytics & Reports', icon: BarChart3, description: 'Comprehensive monthly tonnage, dispatch velocity, and financial summaries.', category: 'Intelligence' },
  { name: 'System Audit Logs', icon: ClipboardList, description: 'Chronological timeline of all system actions and duty assignments.', category: 'Security' }
];

const AdminDashboard = () => {
  const { user, permissions, refreshPermissions } = useContext(AuthContext);
  const navigate = useNavigate();

  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'RESTRICTED'

  const loadSummary = async () => {
    try {
      setError('');
      const data = await getAdminDashboardSummary();
      setSummaryData(data);
    } catch (err) {
      console.error('Failed to load admin summary:', err);
      setError(err.response?.data?.error || 'Could not load office dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const handleSyncDuties = async () => {
    setSyncing(true);
    setSyncNotice('');
    try {
      await refreshPermissions();
      await loadSummary();
      setSyncNotice('Duties and permissions synchronized successfully with Super Admin.');
      setTimeout(() => setSyncNotice(''), 4000);
    } catch (err) {
      console.error('Failed to sync duties:', err);
      setSyncNotice('Failed to synchronize duties.');
    } finally {
      setSyncing(false);
    }
  };

  // Merge live context permissions with summaryData permissions
  const activePermissions = useMemo(() => {
    return permissions || summaryData?.permissions || {};
  }, [permissions, summaryData]);

  // Compute status for each module
  const modulesWithStatus = useMemo(() => {
    return MODULE_DEFINITIONS.map(mod => {
      // If permission is explicitly false, it is disabled. If undefined and no duty configured, defaults to true.
      const isEnabled = activePermissions[mod.id] !== false;
      const count = summaryData?.counts?.[mod.metricKey] ?? 0;
      return {
        ...mod,
        isEnabled,
        count
      };
    });
  }, [activePermissions, summaryData]);

  // Filter modules based on search and status
  const filteredModules = useMemo(() => {
    return modulesWithStatus.filter(mod => {
      if (statusFilter === 'ACTIVE' && !mod.isEnabled) return false;
      if (statusFilter === 'RESTRICTED' && mod.isEnabled) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        return (
          mod.name.toLowerCase().includes(query) ||
          mod.description.toLowerCase().includes(query) ||
          mod.category.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [modulesWithStatus, statusFilter, searchTerm]);

  const activeCount = modulesWithStatus.filter(m => m.isEnabled).length;
  const restrictedCount = modulesWithStatus.filter(m => !m.isEnabled).length;

  const orgName = user?.organization?.name || summaryData?.organization?.name || 'Assigned Office';
  const orgAddress = user?.organization?.address || summaryData?.organization?.address || '';

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <p className="text-sm font-medium text-gray-500">Loading Office Console...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Welcome Section */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden border border-slate-700/50">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                <ShieldCheck size={14} className="mr-1.5" />
                Office Administrator Console
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <Building2 size={14} className="mr-1.5" />
                {orgName}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Welcome back, {user?.username || 'Administrator'}
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              {orgAddress ? `${orgAddress} • ` : ''}Manage authorized daily office operations, dispatches, vouchers, and procurement based on duties assigned to your account by the Super Admin.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={handleSyncDuties}
              disabled={syncing}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/20 active:bg-white/30 text-white backdrop-blur border border-white/20 transition-all shadow-sm disabled:opacity-50"
              title="Synchronize duty permissions with Super Admin"
            >
              <RefreshCw size={16} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Permissions'}
            </button>
          </div>
        </div>

        {/* Sync Success Notification */}
        {syncNotice && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-emerald-200 text-xs flex items-center animate-fadeIn">
            <CheckCircle2 size={16} className="mr-2 text-emerald-400 shrink-0" />
            <span>{syncNotice}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center">
          <AlertCircle size={18} className="mr-2 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI / Duty Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Active Duties</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <h3 className="text-2xl font-bold text-gray-900">{activeCount}</h3>
              <span className="text-xs font-medium text-gray-400">of 7 Modules</span>
            </div>
            <p className="text-xs text-emerald-600 font-medium mt-1">
              {restrictedCount === 0 ? 'Full Office Access Granted' : `${restrictedCount} Restricted by Super Admin`}
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={26} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Sales & Invoicing</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <h3 className="text-2xl font-bold text-gray-900">
                {(summaryData?.counts?.BILLING || 0) + (summaryData?.counts?.ESTIMATES || 0)}
              </h3>
              <span className="text-xs font-medium text-gray-400">Total</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {summaryData?.counts?.BILLING || 0} Bills • {summaryData?.counts?.ESTIMATES || 0} Estimates
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Receipt size={26} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Dispatch & Security</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <h3 className="text-2xl font-bold text-gray-900">
                {(summaryData?.counts?.WEIGHBRIDGE || 0) + (summaryData?.counts?.GATE_PASS || 0)}
              </h3>
              <span className="text-xs font-medium text-gray-400">Logs</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {summaryData?.counts?.WEIGHBRIDGE || 0} Weights • {summaryData?.counts?.GATE_PASS || 0} Gate Passes
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
            <Scale size={26} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Master Directory</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <h3 className="text-2xl font-bold text-gray-900">
                {(summaryData?.counts?.CUSTOMER_MASTER || 0) + (summaryData?.counts?.PRODUCT_MASTER || 0)}
              </h3>
              <span className="text-xs font-medium text-gray-400">Records</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {summaryData?.counts?.CUSTOMER_MASTER || 0} Buyers • {summaryData?.counts?.PRODUCT_MASTER || 0} Products
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Package size={26} />
          </div>
        </div>
      </div>

      {/* Module Navigation & Control Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Business Modules</h2>
            <p className="text-sm text-gray-500">
              Select any permitted module to access records or trigger new workflows
            </p>
          </div>

          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Status Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-medium shrink-0">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-gray-900 shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({modulesWithStatus.length})
              </button>
              <button
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Active ({activeCount})
              </button>
              <button
                onClick={() => setStatusFilter('RESTRICTED')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === 'RESTRICTED'
                    ? 'bg-white text-rose-700 shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Restricted ({restrictedCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={15} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search modules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-56 pl-9 pr-3 py-1.5 border border-gray-300 rounded-xl text-xs bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredModules.map((module) => {
            const Icon = module.icon;
            const isPermitted = module.isEnabled;

            return (
              <div
                key={module.id}
                className={`rounded-2xl transition-all duration-200 flex flex-col justify-between overflow-hidden border ${
                  isPermitted
                    ? 'bg-white border-gray-200/80 shadow-sm hover:shadow-md hover:border-blue-300'
                    : 'bg-gray-50/80 border-gray-200 opacity-80'
                }`}
              >
                <div className="p-5 space-y-4">
                  {/* Card Top: Icon, Category & Duty Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shadow-xs shrink-0 ${
                        isPermitted
                          ? `bg-gradient-to-br ${module.color} text-white`
                          : 'bg-gray-200 text-gray-500'
                      }`}>
                        <Icon size={22} />
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                          {module.category}
                        </span>
                        <h3 className="text-base font-bold text-gray-900 leading-tight">
                          {module.name}
                        </h3>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isPermitted ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                          Active Duty
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <Lock size={11} className="mr-1" />
                          Disabled
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                    {module.description}
                  </p>

                  {/* Module Metrics or Restriction Note */}
                  {isPermitted ? (
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                      <span>{module.metricLabel}:</span>
                      <span className="font-bold text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-md">
                        {module.count}
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-rose-50/60 border border-rose-100 rounded-lg text-[11px] text-rose-700 flex items-start space-x-1.5">
                      <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-500" />
                      <span>Permission disabled by Super Admin in Duty Assignment console.</span>
                    </div>
                  )}
                </div>

                {/* Card Footer: Action Buttons */}
                <div className={`px-5 py-3.5 border-t ${isPermitted ? 'bg-gray-50/50 border-gray-100' : 'bg-gray-100/50 border-gray-200'}`}>
                  {isPermitted ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(module.path)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-colors shadow-xs"
                      >
                        <span>Open Module</span>
                        <ArrowRight size={14} className="ml-1.5" />
                      </button>

                      {module.createPath && (
                        <button
                          onClick={() => navigate(module.createPath)}
                          className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-colors shadow-xs shrink-0"
                          title={module.createLabel}
                        >
                          <Plus size={14} className="mr-1 text-blue-600" />
                          <span>{module.createLabel}</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      disabled
                      className="w-full bg-gray-200 text-gray-500 px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-center cursor-not-allowed"
                    >
                      <Lock size={13} className="mr-1.5 text-gray-400" />
                      Access Locked
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Modules Section */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Clock size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Upcoming Enterprise Modules</h3>
              <p className="text-xs text-gray-500">These modules are currently under development and cannot be assigned yet</p>
            </div>
          </div>
          <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
            Coming Soon
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {UPCOMING_MODULES.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="p-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-lg bg-gray-200 text-gray-500 flex items-center justify-center">
                    <Icon size={16} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
                    {item.category}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-gray-700">{item.name}</h4>
                <p className="text-xs text-gray-400 line-clamp-2">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Security & Multi-Tenant Notice */}
      <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-blue-800 flex items-start space-x-3">
        <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-900">Centralized Duty Enforcement & Data Isolation</p>
          <p className="text-blue-700">
            Access to all modules is isolated strictly to <strong>{orgName}</strong>. If an operational module is disabled above, 
            both your UI access and backend API endpoints are locked. To request duty assignment changes, contact your Super Administrator.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
