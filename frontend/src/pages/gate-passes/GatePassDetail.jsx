import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Ticket, 
  ArrowLeft, 
  Printer, 
  Truck, 
  Scale, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Building2,
  Calendar
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { 
  getGatePassById, 
  confirmDispatch 
} from '../../services/gatePassService';

const GatePassDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);

  const [gatePass, setGatePass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState(location.state?.message || '');

  const fetchGatePass = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getGatePassById(id);
      setGatePass(data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to load gate pass details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGatePass();
  }, [fetchGatePass]);

  const handlePrint = () => {
    window.print();
  };

  const handleConfirmDispatch = async () => {
    if (!window.confirm('Confirm that vehicle has physically crossed the exit gate?')) {
      return;
    }
    try {
      setActionLoading(true);
      setError('');
      await confirmDispatch(id);
      setSuccessMsg('Gate exit confirmed successfully. Vehicle has departed.');
      fetchGatePass();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to confirm dispatch.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mb-3"></div>
        <p className="font-medium text-sm">Loading gate pass slip...</p>
      </div>
    );
  }

  if (error || !gatePass) {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-4">
        <Link
          to="/gate-passes"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft size={16} className="mr-1.5" /> Back to Gate Passes
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 p-5 rounded-xl text-sm">
          {error || 'Gate pass not found.'}
        </div>
      </div>
    );
  }

  const customerName = gatePass.Customer?.name || gatePass.customer?.name || 'Customer';
  const vehicleNo = gatePass.vehicleNumber || '—';
  const grossWt = parseFloat(gatePass.grossWeight || 0).toFixed(3);
  const unit = gatePass.weightUnit || 'Ton';

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Navigation & Screen-Only Actions */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          to="/gate-passes"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={16} className="mr-1.5" /> Back to Gate Passes
        </Link>
        <div className="flex items-center gap-2">
          {gatePass.status === 'ISSUED' && (
            <button
              onClick={handleConfirmDispatch}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all disabled:bg-slate-300"
            >
              <CheckCircle2 size={14} />
              <span>Confirm Exit</span>
            </button>
          )}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
          >
            <Printer size={14} />
            <span>Print Gate Pass Slip</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-4 rounded-xl flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800 font-bold ml-2">×</button>
        </div>
      )}

      {/* PRINTABLE GATE PASS SLIP */}
      <div 
        id="gate-pass-printable-slip"
        className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none print:m-0 print:p-0"
      >
        {/* Slip Header */}
        <div className="bg-slate-900 px-6 py-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Ticket size={20} className="text-blue-400" />
              <h2 className="text-lg font-bold tracking-wide uppercase">OFFICIAL GATE PASS</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Office: {gatePass.Organization?.name || gatePass.organization?.name || 'Authorized Office Branch'}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-400 block uppercase font-mono">Gate Pass Number</span>
            <span className="text-base font-bold font-mono text-blue-400">{gatePass.gatePassNumber}</span>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Slip Timing & Status Metadata */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 text-xs">
            <div className="flex items-center gap-4 text-slate-600">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-400" />
                <span>Date: {new Date(gatePass.issuedAt || gatePass.createdAt).toLocaleDateString()}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="text-slate-400" />
                <span>Time: {new Date(gatePass.issuedAt || gatePass.createdAt).toLocaleTimeString()}</span>
              </span>
            </div>
            <div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                gatePass.status === 'DISPATCHED' ? 'bg-emerald-100 text-emerald-800' :
                gatePass.status === 'CANCELLED' ? 'bg-slate-100 text-slate-500 line-through' :
                'bg-blue-100 text-blue-800'
              }`}>
                {gatePass.status}
              </span>
            </div>
          </div>

          {/* EXACTLY THREE BUSINESS DETAILS */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Authorized Dispatch Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Detail 1: Customer Name */}
              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/60">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] block flex items-center gap-1.5 mb-2">
                  <User size={14} className="text-blue-600" /> Customer Name
                </span>
                <p className="text-base font-bold text-slate-900 break-words">
                  {customerName}
                </p>
                {gatePass.Customer?.city && (
                  <p className="text-xs text-slate-500 mt-1">{gatePass.Customer.city}</p>
                )}
              </div>

              {/* Detail 2: Vehicle Number */}
              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/60">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] block flex items-center gap-1.5 mb-2">
                  <Truck size={14} className="text-blue-600" /> Vehicle Number
                </span>
                <p className="text-base font-mono font-bold text-slate-900 uppercase tracking-wider">
                  {vehicleNo}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Vehicle Registration</p>
              </div>

              {/* Detail 3: Gross Weight */}
              <div className="p-5 rounded-xl border-2 border-blue-500 bg-blue-50/50">
                <span className="font-bold text-blue-800 uppercase tracking-wider text-[11px] block flex items-center gap-1.5 mb-2">
                  <Scale size={14} className="text-blue-600" /> Gross Weight
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black font-mono text-blue-950">
                    {grossWt}
                  </span>
                  <span className="text-xs font-bold text-blue-800 uppercase">
                    {unit}
                  </span>
                </div>
                <p className="text-[11px] text-blue-700 font-medium mt-1">Total Vehicle &amp; Goods Weight</p>
              </div>
            </div>
          </div>

          {/* Verification / Security Notice */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Security &amp; Gate Verification Note:</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              This Gate Pass was authorized within the 10-minute validity window following Weighbridge verification. 
              The physical vehicle registration and gross weight recorded on this slip must be verified at the exit gate prior to departure.
            </p>
          </div>

          {/* Official Signatures */}
          <div className="pt-8 border-t border-slate-200 text-xs text-slate-500 grid grid-cols-2 sm:grid-cols-3 gap-6">
            <div className="space-y-8">
              <div className="w-full border-b border-slate-300"></div>
              <p className="text-[11px] font-medium text-slate-600 text-center">Weighbridge Operator</p>
            </div>
            <div className="space-y-8">
              <div className="w-full border-b border-slate-300"></div>
              <p className="text-[11px] font-medium text-slate-600 text-center">Driver's Signature</p>
            </div>
            <div className="space-y-8 sm:block hidden">
              <div className="w-full border-b border-slate-300"></div>
              <p className="text-[11px] font-medium text-slate-600 text-center">Gate Security Officer</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GatePassDetail;
