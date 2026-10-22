import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  Ticket, 
  ArrowLeft, 
  Truck, 
  User, 
  Scale,
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Building2,
  Save,
  Check
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import { getWeighingRecordById } from '../../services/weighbridgeService';
import { createGatePass, checkEligibility } from '../../services/gatePassService';

const GatePassForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialWeighingId = searchParams.get('weighingRecordId');

  const { user } = useContext(AuthContext);

  // Exactly three business input fields
  const [customerId, setCustomerId] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [grossWeight, setGrossWeight] = useState('');

  // Auxiliary context / selection (Multi-Office for Super Admin)
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [organizations, setOrganizations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  // Weighbridge association tracking
  const [weighingRecordId, setWeighingRecordId] = useState(initialWeighingId || '');

  // Real-time eligibility & 10-minute validity state
  const [eligibilityStatus, setEligibilityStatus] = useState(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(null);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Super Admin: fetch organizations
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      api.get('/organizations')
        .then(res => setOrganizations(res.data || []))
        .catch(err => console.error('Failed to load organizations', err));
    }
  }, [user]);

  // Fetch Customers for Dropdown based on authorized office
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoadingCustomers(true);
        const params = selectedOrgId ? `?organizationId=${selectedOrgId}` : '';
        const res = await api.get(`/customers${params}`);
        setCustomers(res.data || []);
      } catch (err) {
        console.error('Failed to load customers:', err);
        setError('Failed to load customer list for dropdown.');
      } finally {
        setLoadingCustomers(false);
      }
    };

    fetchCustomers();
  }, [selectedOrgId]);

  // If navigated with initialWeighingId, load record to preselect customer and vehicle
  // (NOTE: Gross weight is explicitly NOT copied; employee must enter manually)
  useEffect(() => {
    if (initialWeighingId) {
      const loadInitialRecord = async () => {
        try {
          const rec = await getWeighingRecordById(initialWeighingId);
          if (rec) {
            setWeighingRecordId(rec.id);
            if (rec.customerId) setCustomerId(String(rec.customerId));
            if (rec.vehicleDetails) setVehicleNumber(rec.vehicleDetails);
            if (rec.organizationId && user?.role === 'SUPER_ADMIN') {
              setSelectedOrgId(String(rec.organizationId));
            }
          }
        } catch (err) {
          console.error('Failed to load initial weighing record:', err);
        }
      };
      loadInitialRecord();
    }
  }, [initialWeighingId, user]);

  // Check 10-minute eligibility when customerId and vehicleNumber change
  const verifyEligibility = useCallback(async (cId, vNum, orgId) => {
    if (!cId || !vNum || !vNum.trim()) {
      setEligibilityStatus(null);
      setRemainingSeconds(null);
      return;
    }

    try {
      setCheckingEligibility(true);
      const data = await checkEligibility({
        customerId: cId,
        vehicleNumber: vNum.trim(),
        organizationId: orgId || undefined
      });

      setEligibilityStatus(data);
      if (data && data.found) {
        setWeighingRecordId(data.weighingRecordId);
        setRemainingSeconds(data.remainingSeconds);
      } else {
        setRemainingSeconds(null);
      }
    } catch (err) {
      console.error('Error verifying slip eligibility:', err);
    } finally {
      setCheckingEligibility(false);
    }
  }, []);

  // Debounced eligibility verification
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerId && vehicleNumber.trim()) {
        verifyEligibility(customerId, vehicleNumber, selectedOrgId);
      } else {
        setEligibilityStatus(null);
        setRemainingSeconds(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [customerId, vehicleNumber, selectedOrgId, verifyEligibility]);

  // Live countdown timer for the 10-minute window
  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingSeconds]);

  const formatCountdown = (secs) => {
    if (secs === null || secs === undefined) return '';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Validate exactly three business input fields
  const validateForm = () => {
    const errors = {};

    // Field 1: Customer Name
    if (!customerId) {
      errors.customerId = 'Customer Name is required. Please select a customer from the dropdown.';
    }

    // Field 2: Vehicle Number
    const trimmedVehicle = vehicleNumber.trim();
    if (!trimmedVehicle) {
      errors.vehicleNumber = 'Vehicle Number is required. Please enter the vehicle registration number.';
    }

    // Field 3: Gross Weight
    if (grossWeight === '' || grossWeight === null || grossWeight === undefined) {
      errors.grossWeight = 'Gross Weight is required. Please enter the manual gross weight.';
    } else {
      const parsedWeight = parseFloat(grossWeight);
      if (isNaN(parsedWeight) || parsedWeight <= 0) {
        errors.grossWeight = 'Gross Weight must be a valid positive number greater than zero.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        customerId: parseInt(customerId, 10),
        vehicleNumber: vehicleNumber.trim(),
        grossWeight: parseFloat(grossWeight),
        weightUnit: 'Ton',
        weighingRecordId: weighingRecordId || undefined,
        organizationId: selectedOrgId || undefined
      };

      const res = await createGatePass(payload);

      // Navigate to Gate Pass Slip view with success confirmation
      navigate(`/gate-passes/${res.gatePass.id}`, {
        state: { message: 'Gate Pass created and verified successfully within the 10-minute window.' }
      });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to create gate pass.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/gate-passes"
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Ticket className="text-blue-600" /> Create Gate Pass
          </h1>
          <p className="text-sm text-slate-500">
            Generate an official Gate Pass with authoritative 10-minute Weighbridge verification.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold ml-2">×</button>
        </div>
      )}

      {/* 10-Minute Validity Live Status Banner */}
      {checkingEligibility && (
        <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl flex items-center gap-2 text-xs text-slate-600">
          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-blue-600 border-t-transparent"></div>
          <span>Verifying Weighbridge slip generation timestamp...</span>
        </div>
      )}

      {eligibilityStatus && !checkingEligibility && (
        eligibilityStatus.found ? (
          eligibilityStatus.alreadyUsed ? (
            <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl flex items-start gap-3">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-amber-900">
                <p className="font-bold">Slip Already Used</p>
                <p className="mt-0.5">
                  Weighbridge Slip #{eligibilityStatus.weighingNumber} already has an active Gate Pass (Pass #{eligibilityStatus.existingPassNumber}).
                </p>
              </div>
            </div>
          ) : eligibilityStatus.isExpired || remainingSeconds === 0 ? (
            <div className="bg-rose-50 border border-rose-300 p-4 rounded-xl flex items-start gap-3">
              <Clock className="text-rose-600 shrink-0 mt-0.5" size={20} />
              <div className="text-xs text-rose-900">
                <p className="font-bold">10-Minute Window Expired</p>
                <p className="mt-0.5 text-rose-700">
                  Weighbridge Slip #{eligibilityStatus.weighingNumber} was generated at {new Date(eligibilityStatus.slipTime).toLocaleTimeString()}. The 10-minute window has expired. Re-weighing is mandatory.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={20} />
                <div className="text-xs text-emerald-900">
                  <p className="font-bold">Weighbridge Slip #{eligibilityStatus.weighingNumber} Verified</p>
                  <p className="text-emerald-700 mt-0.5">
                    Slip generated at {new Date(eligibilityStatus.slipTime).toLocaleTimeString()}. Ready for Gate Pass issuance.
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0 bg-white px-3 py-1.5 rounded-lg border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Time Left</span>
                <span className="text-lg font-black font-mono text-emerald-700">
                  {formatCountdown(remainingSeconds)}
                </span>
              </div>
            </div>
          )
        ) : (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3 text-xs text-blue-900">
            <Clock className="text-blue-600 shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-semibold">10-Minute Rule Active</p>
              <p className="text-blue-700 mt-0.5">
                The 10-minute timer starts when the Weighbridge slip is generated. Enter the Customer Name and Vehicle Number to link the slip.
              </p>
            </div>
          </div>
        )
      )}

      {/* Main Gate Pass Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        {/* Office Selection for Super Admin */}
        {user?.role === 'SUPER_ADMIN' && (
          <div className="pb-4 border-b border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Building2 size={14} className="text-slate-500" />
              Office Branch <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedOrgId}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
                setCustomerId('');
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
            >
              <option value="">-- All Authorized Offices --</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* FIELD 1: Customer Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <User size={14} className="text-blue-600" />
              Customer Name <span className="text-red-500">*</span>
            </span>
            <span className="text-[11px] text-slate-400 font-normal">Customer Master Dropdown</span>
          </label>
          <select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              if (fieldErrors.customerId) {
                setFieldErrors(prev => ({ ...prev, customerId: null }));
              }
            }}
            disabled={loadingCustomers}
            className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 border rounded-xl focus:outline-hidden focus:ring-2 focus:bg-white transition-all ${
              fieldErrors.customerId ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'
            }`}
          >
            <option value="">
              {loadingCustomers ? 'Loading customers...' : '-- Select Customer --'}
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.city ? `(${c.city})` : ''}
              </option>
            ))}
          </select>
          {fieldErrors.customerId && (
            <p className="text-xs text-red-600 mt-1.5">{fieldErrors.customerId}</p>
          )}
        </div>

        {/* FIELD 2: Vehicle Number */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Truck size={14} className="text-blue-600" />
              Vehicle Number <span className="text-red-500">*</span>
            </span>
            <span className="text-[11px] text-slate-400 font-normal">Manual Input</span>
          </label>
          <input
            type="text"
            placeholder="e.g. PB-10-AB-1234"
            value={vehicleNumber}
            onChange={(e) => {
              setVehicleNumber(e.target.value);
              if (fieldErrors.vehicleNumber) {
                setFieldErrors(prev => ({ ...prev, vehicleNumber: null }));
              }
            }}
            className={`w-full px-3.5 py-2.5 text-sm font-mono uppercase bg-slate-50 border rounded-xl focus:outline-hidden focus:ring-2 focus:bg-white transition-all ${
              fieldErrors.vehicleNumber ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'
            }`}
          />
          {fieldErrors.vehicleNumber && (
            <p className="text-xs text-red-600 mt-1.5">{fieldErrors.vehicleNumber}</p>
          )}
        </div>

        {/* FIELD 3: Gross Weight */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Scale size={14} className="text-blue-600" />
              Gross Weight <span className="text-red-500">*</span>
            </span>
            <span className="text-[11px] text-slate-400 font-normal">Manual Numeric Input (Ton)</span>
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.001"
              min="0.001"
              placeholder="0.000"
              value={grossWeight}
              onChange={(e) => {
                setGrossWeight(e.target.value);
                if (fieldErrors.grossWeight) {
                  setFieldErrors(prev => ({ ...prev, grossWeight: null }));
                }
              }}
              className={`w-full pl-3.5 pr-14 py-2.5 text-sm font-mono font-bold bg-slate-50 border rounded-xl focus:outline-hidden focus:ring-2 focus:bg-white transition-all ${
                fieldErrors.grossWeight ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'
              }`}
            />
            <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400 uppercase">
              Ton
            </span>
          </div>
          {fieldErrors.grossWeight ? (
            <p className="text-xs text-red-600 mt-1.5">{fieldErrors.grossWeight}</p>
          ) : (
            <p className="text-[11px] text-slate-400 mt-1">
              Enter the gross weight manually. Gross weight is not copied automatically from the Weighbridge slip.
            </p>
          )}
        </div>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <Link
            to="/gate-passes"
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className={`inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl shadow-xs transition-colors ${
              submitting
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Saving Gate Pass...
              </>
            ) : (
              <>
                <Save size={16} /> Save Gate Pass
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GatePassForm;
