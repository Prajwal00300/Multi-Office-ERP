import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, UserCheck, UserPlus, Shield, AlertCircle } from 'lucide-react';
import superAdminService from '../../services/superAdminService';

const OrganizationForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  // Office Fields
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    status: 'ACTIVE'
  });

  // CEO Assignment: 'existing' | 'new'
  const [ceoMode, setCeoMode] = useState('existing');
  const [eligibleCeos, setEligibleCeos] = useState([]);
  const [selectedCeoId, setSelectedCeoId] = useState('');
  const [currentCeo, setCurrentCeo] = useState(null);

  // New CEO fields
  const [newCeo, setNewCeo] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    phone: ''
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInitialData();
  }, [id]);

  const loadInitialData = async () => {
    try {
      setFetching(true);
      setError('');

      // Fetch eligible unassigned CEOs
      const ceos = await superAdminService.getEligibleCeos(id || null);
      setEligibleCeos(ceos || []);

      if (isEditMode) {
        const org = await superAdminService.getOrganizationById(id);
        setFormData({
          name: org.name || '',
          address: org.address || '',
          phone: org.phone || '',
          status: org.status || 'ACTIVE'
        });

        if (org.ceo) {
          setCurrentCeo(org.ceo);
          setSelectedCeoId(String(org.ceo.id));
        }
      } else {
        // In create mode: if eligible CEOs exist, preselect the first one; else default to 'new'
        if (ceos && ceos.length > 0) {
          setCeoMode('existing');
          setSelectedCeoId(String(ceos[0].id));
        } else {
          setCeoMode('new');
        }
      }
    } catch (err) {
      console.error('Error loading form data:', err);
      setError(err.response?.data?.error || 'Failed to load office form data.');
    } finally {
      setFetching(false);
    }
  };

  const handleOfficeChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleNewCeoChange = (e) => {
    setNewCeo({ ...newCeo, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Office field validations
    if (!formData.name.trim()) {
      return setError('Office name is required.');
    }
    if (!formData.phone.trim()) {
      return setError('Phone number is required.');
    }
    if (!formData.address.trim()) {
      return setError('Complete address is required.');
    }

    // CEO validation
    let payload = {
      name: formData.name.trim(),
      address: formData.address.trim(),
      phone: formData.phone.trim(),
      status: formData.status
    };

    if (isEditMode) {
      if (!selectedCeoId) {
        return setError('An assigned CEO is required for this office.');
      }
      payload.ceoId = parseInt(selectedCeoId, 10);
    } else {
      // Create mode
      if (ceoMode === 'existing') {
        if (!selectedCeoId) {
          return setError('Please select an eligible unassigned CEO for this office.');
        }
        payload.ceoId = parseInt(selectedCeoId, 10);
      } else {
        // New CEO mode
        if (!newCeo.username.trim()) {
          return setError('CEO Username is required.');
        }
        if (!newCeo.password.trim()) {
          return setError('CEO Initial Password is required.');
        }
        payload.newCeo = {
          username: newCeo.username.trim(),
          password: newCeo.password.trim(),
          fullName: newCeo.fullName.trim() || null,
          email: newCeo.email.trim() || null,
          phone: newCeo.phone.trim() || null
        };
      }
    }

    setLoading(true);
    try {
      if (isEditMode) {
        await superAdminService.updateOffice(id, payload);
      } else {
        await superAdminService.createOffice(payload);
      }
      navigate('/super-admin/organizations');
    } catch (err) {
      console.error('Failed to save office:', err);
      setError(err.response?.data?.error || 'Failed to save office and assign CEO.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
        <span className="text-gray-500 text-sm">Loading office setup...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-2">
        <Link 
          to="/super-admin/organizations" 
          className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          title="Back to Offices"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="text-blue-600" size={24} />
            {isEditMode ? 'Edit Office Branch' : 'Create Office & Assign CEO'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Hierarchy: Super Admin &rarr; Office &rarr; CEO &rarr; Office Employees
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: Office Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-100 flex items-center gap-2">
            <Building2 size={16} className="text-blue-600" />
            1. Office Branch Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Office Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleOfficeChange}
                disabled={loading}
                required
                className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                placeholder="e.g. Chandigarh Regional Office"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Contact Phone <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleOfficeChange}
                disabled={loading}
                required
                className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                placeholder="e.g. +91 98765 43210"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Complete Physical Address <span className="text-red-500">*</span>
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleOfficeChange}
              disabled={loading}
              required
              rows="3"
              className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
              placeholder="Enter complete office address with city, state, and pin code"
            ></textarea>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Operational Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleOfficeChange}
              disabled={loading}
              className="w-full sm:w-48 px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
        </div>

        {/* SECTION 2: Mandatory CEO Assignment */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-2 border-b border-gray-100 gap-2">
            <div>
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <UserCheck size={16} className="text-blue-600" />
                2. Mandatory CEO Assignment <span className="text-red-500">*</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Every office must have exactly one designated CEO. Each CEO can manage only one office.
              </p>
            </div>

            {!isEditMode && (
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setCeoMode('existing')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    ceoMode === 'existing'
                      ? 'bg-white text-blue-600 shadow-sm font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Select Existing CEO
                </button>
                <button
                  type="button"
                  onClick={() => setCeoMode('new')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    ceoMode === 'new'
                      ? 'bg-white text-blue-600 shadow-sm font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Create New CEO
                </button>
              </div>
            )}
          </div>

          {/* Edit Mode: CEO Reassignment Dropdown */}
          {isEditMode ? (
            <div className="space-y-3">
              {currentCeo && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-900">
                  <span className="font-semibold">Current CEO:</span> {currentCeo.fullName || currentCeo.username} (@{currentCeo.username}) &bull; Ph: {currentCeo.phone || 'N/A'}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Assign / Transfer to CEO <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCeoId}
                  onChange={(e) => setSelectedCeoId(e.target.value)}
                  disabled={loading}
                  required
                  className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  {currentCeo && (
                    <option value={currentCeo.id}>
                      {currentCeo.fullName ? `${currentCeo.fullName} (@${currentCeo.username})` : `@${currentCeo.username}`} (Current Assigned CEO)
                    </option>
                  )}
                  {eligibleCeos
                    .filter(c => !currentCeo || c.id !== currentCeo.id)
                    .map((ceo) => (
                      <option key={ceo.id} value={ceo.id}>
                        {ceo.fullName ? `${ceo.fullName} (@${ceo.username})` : `@${ceo.username}`} {ceo.phone ? `• Ph: ${ceo.phone}` : ''}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Only eligible unassigned CEOs appear in this list. Already-assigned CEOs cannot manage multiple offices.
                </p>
              </div>
            </div>
          ) : (
            /* Create Mode: Existing or New CEO */
            ceoMode === 'existing' ? (
              <div className="space-y-3">
                {eligibleCeos.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs space-y-2">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertCircle size={15} /> No Unassigned CEOs Available
                    </p>
                    <p>
                      All existing registered CEOs are already assigned to offices. Since each CEO can only manage one office, please click <strong>"Create New CEO"</strong> above to register an account for this office in this submission.
                    </p>
                    <button
                      type="button"
                      onClick={() => setCeoMode('new')}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium"
                    >
                      Switch to "Create New CEO"
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Select Eligible CEO <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedCeoId}
                      onChange={(e) => setSelectedCeoId(e.target.value)}
                      disabled={loading}
                      required
                      className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="">-- Choose an unassigned CEO --</option>
                      {eligibleCeos.map((ceo) => (
                        <option key={ceo.id} value={ceo.id}>
                          {ceo.fullName ? `${ceo.fullName} (@${ceo.username})` : `@${ceo.username}`} {ceo.phone ? `• Ph: ${ceo.phone}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Showing {eligibleCeos.length} unassigned CEO accounts eligible for office ownership.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Inline New CEO Creation */
              <div className="space-y-4 pt-1">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 flex items-center gap-2">
                  <Shield size={16} className="text-blue-600 shrink-0" />
                  <span>
                    A new CEO account will be created and bound to this office atomically in one submission.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      CEO Full Name
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={newCeo.fullName}
                      onChange={handleNewCeoChange}
                      disabled={loading}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      CEO Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={newCeo.username}
                      onChange={handleNewCeoChange}
                      disabled={loading}
                      required
                      placeholder="e.g. ramesh_ceo"
                      className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Initial Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={newCeo.password}
                      onChange={handleNewCeoChange}
                      disabled={loading}
                      required
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={newCeo.email}
                      onChange={handleNewCeoChange}
                      disabled={loading}
                      placeholder="e.g. ramesh@company.com"
                      className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      name="phone"
                      value={newCeo.phone}
                      onChange={handleNewCeoChange}
                      disabled={loading}
                      placeholder="+91 98765 00000"
                      className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-2">
          <Link
            to="/super-admin/organizations"
            className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || (!isEditMode && ceoMode === 'existing' && eligibleCeos.length === 0)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving Office &amp; CEO...
              </>
            ) : isEditMode ? (
              'Update Office Branch'
            ) : (
              'Create Office & Assign CEO'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OrganizationForm;
