import React, { useState, useEffect, useCallback, useContext } from 'react';
import { 
  ShieldCheck, 
  Building2, 
  UserCheck, 
  Search, 
  Save, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Layers, 
  Filter, 
  RotateCcw,
  Sparkles,
  Lock,
  Unlock,
  Check,
  X
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { 
  getModules, 
  getOrganizations, 
  getAdminsByOrganization, 
  getAdminPermissions, 
  saveAdminPermissions 
} from '../../services/dutyAssignmentService';

const DutyAssignment = () => {
  const { user, refreshPermissions } = useContext(AuthContext);

  // Core Data
  const [organizations, setOrganizations] = useState([]);
  const [modules, setModules] = useState([]);
  const [implementedModuleIds, setImplementedModuleIds] = useState([]);
  const [admins, setAdmins] = useState([]);

  // Selections
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedAdminId, setSelectedAdminId] = useState('');

  // Permissions State
  // { [moduleKey]: boolean }
  const [permissions, setPermissions] = useState({});
  const [originalPermissions, setOriginalPermissions] = useState({});
  const [hasConfiguredDuties, setHasConfiguredDuties] = useState(false);

  // UI state
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Load initial organizations and module registry
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoadingOrgs(true);
        setError('');

        const [orgsData, modsData] = await Promise.all([
          getOrganizations(),
          getModules()
        ]);

        setOrganizations(orgsData || []);
        setModules(modsData?.modules || []);
        setImplementedModuleIds(modsData?.implementedModuleIds || []);

        // Pre-select first organization if available
        if (orgsData && orgsData.length > 0) {
          setSelectedOrgId(String(orgsData[0].id));
        }
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || 'Failed to initialize organizations and module registry.');
      } finally {
        setLoadingOrgs(false);
      }
    };

    fetchInitialData();
  }, []);

  // When selected organization changes, load its Admins
  useEffect(() => {
    if (!selectedOrgId) {
      setAdmins([]);
      setSelectedAdminId('');
      setPermissions({});
      setOriginalPermissions({});
      return;
    }

    const fetchAdmins = async () => {
      try {
        setLoadingAdmins(true);
        setError('');
        setSelectedAdminId('');
        setPermissions({});
        setOriginalPermissions({});

        const res = await getAdminsByOrganization(selectedOrgId);
        const orgAdmins = res?.admins || [];
        setAdmins(orgAdmins);

        // Pre-select first Admin if available
        if (orgAdmins.length > 0) {
          setSelectedAdminId(String(orgAdmins[0].id));
        }
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || 'Failed to load organization Admins.');
        setAdmins([]);
      } finally {
        setLoadingAdmins(false);
      }
    };

    fetchAdmins();
  }, [selectedOrgId]);

  // When selected Admin changes, fetch their saved permissions
  useEffect(() => {
    if (!selectedAdminId || !selectedOrgId) {
      setPermissions({});
      setOriginalPermissions({});
      return;
    }

    const fetchPerms = async () => {
      try {
        setLoadingPerms(true);
        setError('');
        setSuccessMsg('');

        const res = await getAdminPermissions(selectedAdminId, selectedOrgId);
        const perms = res?.permissions || {};
        setPermissions(perms);
        setOriginalPermissions(perms);
        setHasConfiguredDuties(Boolean(res?.hasConfiguredDuties));
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || 'Failed to load Admin permissions.');
        setPermissions({});
        setOriginalPermissions({});
      } finally {
        setLoadingPerms(false);
      }
    };

    fetchPerms();
  }, [selectedAdminId, selectedOrgId]);

  // Toggle switch handler for a specific module
  const handleToggleModule = (moduleId) => {
    // Only implemented modules can be toggled
    if (!implementedModuleIds.includes(moduleId)) {
      return;
    }

    setPermissions(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  // Quick actions: Enable All / Disable All implemented modules
  const handleEnableAllImplemented = () => {
    const updated = { ...permissions };
    implementedModuleIds.forEach(id => {
      updated[id] = true;
    });
    setPermissions(updated);
  };

  const handleDisableAllImplemented = () => {
    const updated = { ...permissions };
    implementedModuleIds.forEach(id => {
      updated[id] = false;
    });
    setPermissions(updated);
  };

  // Check for unsaved changes
  const hasUnsavedChanges = implementedModuleIds.some(
    id => Boolean(permissions[id]) !== Boolean(originalPermissions[id])
  );

  // Save Permissions to Backend
  const handleSave = async () => {
    if (!selectedOrgId || !selectedAdminId) {
      setError('Please select both an Organization and an Admin.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccessMsg('');

      const payload = {
        organizationId: parseInt(selectedOrgId, 10),
        userId: parseInt(selectedAdminId, 10),
        permissions
      };

      const res = await saveAdminPermissions(payload);
      setPermissions(res?.permissions || permissions);
      setOriginalPermissions(res?.permissions || permissions);
      setHasConfiguredDuties(true);
      setSuccessMsg(res?.message || 'Duty assignments saved successfully.');

      // Also trigger refresh in current user context if modifying self
      if (user?.id === parseInt(selectedAdminId, 10)) {
        refreshPermissions();
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save duty assignments.');
    } finally {
      setSaving(false);
    }
  };

  // Selected entities for display
  const currentOrg = organizations.find(o => String(o.id) === String(selectedOrgId));
  const currentAdmin = admins.find(a => String(a.id) === String(selectedAdminId));

  // Module categories for filter
  const categories = ['ALL', ...new Set(modules.map(m => m.category || 'General'))];

  // Filtered modules based on search and category
  const filteredModules = modules.filter(m => {
    const matchesSearch = 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'ALL' || m.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Count active modules
  const activeCount = implementedModuleIds.filter(id => Boolean(permissions[id])).length;
  const totalImplemented = implementedModuleIds.length;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="text-blue-600" size={28} />
            Duty Assignment & Module Permissions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Grant or restrict business module access for organization Admins with real-time database enforcement.
          </p>
        </div>

        {/* Global Save Button */}
        {selectedAdminId && (
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 animate-pulse">
                Unsaved Changes
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || loadingPerms}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg shadow-sm transition-colors ${
                saving || loadingPerms
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Permissions
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5 text-sm font-medium">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800 font-bold">×</button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5 text-sm font-medium">
            <AlertTriangle size={18} className="text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold">×</button>
        </div>
      )}

      {/* Selection Card (Organization & Admin) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
          <Building2 size={16} className="text-blue-600" />
          Target Assignment Context
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Organization Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Organization <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                disabled={loadingOrgs}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
              >
                {loadingOrgs ? (
                  <option>Loading organizations...</option>
                ) : organizations.length === 0 ? (
                  <option value="">No organizations available</option>
                ) : (
                  organizations.map(org => (
                    <option key={org.id} value={org.id}>
                      {org.name} {org.city ? `(${org.city})` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Admin Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Organization Admin <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <UserCheck className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <select
                value={selectedAdminId}
                onChange={(e) => setSelectedAdminId(e.target.value)}
                disabled={loadingAdmins || admins.length === 0}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
              >
                {loadingAdmins ? (
                  <option>Loading admins...</option>
                ) : admins.length === 0 ? (
                  <option value="">No Admin accounts found for this organization</option>
                ) : (
                  admins.map(admin => (
                    <option key={admin.id} value={admin.id}>
                      {admin.username} (ID: {admin.id})
                    </option>
                  ))
                )}
              </select>
            </div>
            {admins.length === 0 && !loadingAdmins && selectedOrgId && (
              <p className="text-xs text-amber-600 mt-1">
                Tip: Create an account with the <strong>ADMIN</strong> role for this organization under Organization Users to assign duties.
              </p>
            )}
          </div>
        </div>

        {/* Selected Context Summary Banner */}
        {currentOrg && currentAdmin && (
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-medium text-slate-500">Configuring:</span>
              <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                Admin: {currentAdmin.username}
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Organization: {currentOrg.name}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500">Duties Active:</span>
              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                {activeCount} / {totalImplemented} Modules
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                hasConfiguredDuties 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {hasConfiguredDuties ? 'Customized in DB' : 'Default Access'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Module Permissions Section */}
      {selectedAdminId ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          {/* Toolbar: Search, Category Filter & Quick Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            {/* Search */}
            <div className="relative md:w-80">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs text-slate-400 shrink-0">Category:</span>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors shrink-0 ${
                    selectedCategory === cat 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleEnableAllImplemented}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors"
                title="Turn ON all implemented modules"
              >
                <Check size={14} /> Enable All
              </button>
              <button
                type="button"
                onClick={handleDisableAllImplemented}
                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg transition-colors"
                title="Turn OFF all modules"
              >
                <X size={14} /> Disable All
              </button>
            </div>
          </div>

          {/* Module Cards Grid */}
          {loadingPerms ? (
            <div className="py-16 text-center text-slate-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mb-2"></div>
              <p className="text-sm">Fetching module duty assignments...</p>
            </div>
          ) : filteredModules.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Layers size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="font-medium text-slate-600">No modules match your search filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredModules.map((module) => {
                const isImplemented = Boolean(module.isImplemented);
                const isEnabled = isImplemented && Boolean(permissions[module.id]);

                return (
                  <div
                    key={module.id}
                    className={`p-4 rounded-xl border transition-all ${
                      !isImplemented
                        ? 'bg-slate-50/50 border-slate-200 opacity-60'
                        : isEnabled
                        ? 'bg-blue-50/20 border-blue-200 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: Info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">
                            {module.name}
                          </h3>
                          {module.category && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              {module.category}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed">
                          {module.description}
                        </p>

                        <div className="flex items-center gap-2 pt-1 text-[11px]">
                          <span className="font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                            {module.id}
                          </span>
                          {!isImplemented && (
                            <span className="font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded text-[10px]">
                              Coming Soon
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Switch */}
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {isImplemented ? (
                          <button
                            type="button"
                            onClick={() => handleToggleModule(module.id)}
                            className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                              isEnabled ? 'bg-blue-600' : 'bg-slate-300'
                            }`}
                            aria-pressed={isEnabled}
                            title={`Click to turn ${isEnabled ? 'OFF' : 'ON'}`}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                isEnabled ? 'translate-x-6' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        ) : (
                          <div 
                            className="relative inline-flex h-6 w-12 shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-slate-200 opacity-60"
                            title="Module not implemented yet"
                          >
                            <span className="inline-block h-5 w-5 rounded-full bg-slate-400" />
                          </div>
                        )}

                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          !isImplemented 
                            ? 'text-slate-400' 
                            : isEnabled 
                            ? 'text-blue-700' 
                            : 'text-slate-400'
                        }`}>
                          {!isImplemented ? 'Locked' : isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer Save Row */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Changes take effect immediately on MySQL and will constrain backend API requests and dashboard navigation.
            </p>

            <button
              onClick={handleSave}
              disabled={saving || loadingPerms}
              className={`inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-lg shadow-sm transition-colors ${
                saving || loadingPerms
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Saving Permissions...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Duty Assignments
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 space-y-2">
          <ShieldCheck size={40} className="mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-700">No Admin Selected</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Please choose an Organization and an Admin account above to inspect and assign module duty permissions.
          </p>
        </div>
      )}
    </div>
  );
};

export default DutyAssignment;
