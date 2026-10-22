import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Scale, 
  Truck, 
  User, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  Calculator
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import { createWeighingRecord } from '../../services/weighbridgeService';

const WeighbridgeForm = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState('');
  const [firstWeight, setFirstWeight] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [taleWeight, setTaleWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('Ton');
  const [selectedOrgId, setSelectedOrgId] = useState('');

  // Dropdown Data
  const [customers, setCustomers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  // UI State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch Organizations if Super Admin
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      api.get('/organizations')
        .then(res => setOrganizations(res.data || []))
        .catch(err => console.error('Failed to load organizations', err));
    }
  }, [user]);

  // Fetch Customers for Dropdown
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoadingCustomers(true);
        const params = selectedOrgId ? `?organizationId=${selectedOrgId}` : '';
        const res = await api.get(`/customers${params}`);
        setCustomers(res.data || []);
      } catch (err) {
        console.error('Failed to load customers:', err);
        setError('Failed to load customers list for dropdown.');
      } finally {
        setLoadingCustomers(false);
      }
    };

    fetchCustomers();
  }, [selectedOrgId]);

  // Automatically calculate Tale Weight = Gross Weight - First Weight
  const handleFirstWeightChange = (e) => {
    const val = e.target.value;
    setFirstWeight(val);
    if (grossWeight !== '' && val !== '') {
      const g = parseFloat(grossWeight) || 0;
      const f = parseFloat(val) || 0;
      const t = g - f;
      setTaleWeight(t >= 0 ? t.toFixed(3) : '0.000');
    }
  };

  const handleGrossWeightChange = (e) => {
    const val = e.target.value;
    setGrossWeight(val);
    if (firstWeight !== '' && val !== '') {
      const g = parseFloat(val) || 0;
      const f = parseFloat(firstWeight) || 0;
      const t = g - f;
      setTaleWeight(t >= 0 ? t.toFixed(3) : '0.000');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!customerId) {
      setError('Please select a Customer from the dropdown menu.');
      return;
    }

    if (!vehicleDetails.trim()) {
      setError('Please enter Vehicle Details.');
      return;
    }

    const fWeight = parseFloat(firstWeight);
    const gWeight = parseFloat(grossWeight);

    if (isNaN(fWeight) || fWeight < 0) {
      setError('Please enter a valid First Weight (empty vehicle weight).');
      return;
    }

    if (isNaN(gWeight) || gWeight < 0) {
      setError('Please enter a valid Gross Weight (vehicle + goods weight).');
      return;
    }

    if (gWeight < fWeight) {
      setError('Gross Weight cannot be less than First Weight (loaded vehicle must weigh at least as much as empty vehicle).');
      return;
    }

    const tWeight = parseFloat(taleWeight) || (gWeight - fWeight);

    try {
      setSubmitting(true);
      const payload = {
        customerId: parseInt(customerId, 10),
        vehicleDetails: vehicleDetails.trim(),
        firstWeight: fWeight,
        grossWeight: gWeight,
        taleWeight: tWeight,
        weightUnit: weightUnit || 'Ton',
        organizationId: selectedOrgId || undefined
      };

      const res = await createWeighingRecord(payload);
      setSuccessMsg('Weighbridge entry recorded successfully!');

      const newId = res.weighingRecord?.id;
      if (newId) {
        setTimeout(() => {
          navigate(`/weighbridge/${newId}`);
        }, 800);
      } else {
        setTimeout(() => {
          navigate('/weighbridge');
        }, 800);
      }
    } catch (err) {
      console.error('Error saving weighbridge entry:', err);
      setError(err.response?.data?.error || 'Failed to record weighbridge entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header & Back Link */}
      <div className="flex items-center justify-between">
        <Link
          to="/weighbridge"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={16} className="mr-1.5" /> Back to Weighbridge List
        </Link>
        <span className="text-xs text-slate-400 font-mono">Module: Weighbridge Manual Entry</span>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Card Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm">
              <Scale size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">New Weighbridge Entry</h1>
              <p className="text-xs text-blue-100 mt-0.5">
                Record vehicle weights and calculate goods tale weight
              </p>
            </div>
          </div>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-600" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-700 text-sm">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1 font-medium">{successMsg}</div>
          </div>
        )}

        {/* The Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Office Selection for Super Admin */}
          {user?.role === 'SUPER_ADMIN' && organizations.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Branch Office
              </label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                >
                  <option value="">-- All / Primary Office --</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* 1. Customer Name (Dropdown) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
              <select
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                disabled={loadingCustomers}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              >
                <option value="">
                  {loadingCustomers ? 'Loading customer master...' : '-- Select Customer from Dropdown --'}
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''} {c.city ? `• ${c.city}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Select the customer from the master list.
            </p>
          </div>

          {/* 2. Vehicle Details */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Vehicle Details <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Truck size={16} className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                required
                placeholder="e.g. HR 02 AB 1234 (Tata 407 / Trailer)"
                value={vehicleDetails}
                onChange={(e) => setVehicleDetails(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all uppercase"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Enter vehicle registration number, model, or transport details.
            </p>
          </div>

          {/* Weights Section */}
          <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calculator size={15} className="text-blue-600" /> Weight Measurements
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Unit:</span>
                <select
                  value={weightUnit}
                  onChange={(e) => setWeightUnit(e.target.value)}
                  className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Ton">Ton</option>
                  <option value="Kg">Kg</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 3. First Weight */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  First Weight <span className="text-red-500">*</span>
                  <span className="block text-[11px] font-normal text-slate-500">
                    (Empty Vehicle Weight)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    placeholder="0.000"
                    value={firstWeight}
                    onChange={handleFirstWeightChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all pr-12"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400 uppercase">
                    {weightUnit}
                  </span>
                </div>
              </div>

              {/* 4. Gross Weight */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Gross Weight <span className="text-red-500">*</span>
                  <span className="block text-[11px] font-normal text-slate-500">
                    (Vehicle + Goods Weight)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    placeholder="0.000"
                    value={grossWeight}
                    onChange={handleGrossWeightChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all pr-12"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400 uppercase">
                    {weightUnit}
                  </span>
                </div>
              </div>

              {/* 5. Tale Weight */}
              <div>
                <label className="block text-xs font-semibold text-emerald-800 mb-1.5">
                  Tale Weight <span className="text-emerald-600 font-bold">*</span>
                  <span className="block text-[11px] font-normal text-emerald-700">
                    (Weight of Goods)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={taleWeight}
                    onChange={(e) => setTaleWeight(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-sm font-mono font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all pr-12"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-emerald-600 uppercase">
                    {weightUnit}
                  </span>
                </div>
              </div>
            </div>

            {/* Formula hint */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Formula: <span className="font-semibold text-slate-700">Tale Weight</span> = <span className="text-slate-700 font-medium">Gross Weight</span> &minus; <span className="text-slate-700 font-medium">First Weight</span>
              </span>
              <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Net Goods: {taleWeight || '0.000'} {weightUnit}
              </span>
            </div>
          </div>

          {/* 6. Submit Button */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <Link
              to="/weighbridge"
              className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Recording Slip...</span>
                </>
              ) : (
                <>
                  <Scale size={16} />
                  <span>Submit Weighbridge Slip</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WeighbridgeForm;
