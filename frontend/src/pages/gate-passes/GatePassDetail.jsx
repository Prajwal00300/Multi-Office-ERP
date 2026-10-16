import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Ticket, 
  ArrowLeft, 
  Printer, 
  Truck, 
  Scale, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  Ban, 
  ShieldCheck, 
  User, 
  FileText, 
  MapPin, 
  History,
  Send
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { 
  getGatePassById, 
  issueGatePass, 
  confirmDispatch, 
  cancelGatePass, 
  requestReweigh 
} from '../../services/gatePassService';

const GatePassDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [gatePass, setGatePass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [now, setNow] = useState(Date.now());

  // Modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showReweighModal, setShowReweighModal] = useState(false);
  const [reweighReason, setReweighReason] = useState('');

  // Live timer tick
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  // Actions
  const handleIssue = async () => {
    try {
      setActionLoading(true);
      setError('');
      await issueGatePass(id);
      setSuccessMsg('Gate pass issued successfully. Printing is now unlocked.');
      fetchGatePass();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to issue gate pass.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!window.confirm('Confirm that vehicle has physically crossed the exit gate? This action is irreversible.')) {
      return;
    }
    try {
      setActionLoading(true);
      setError('');
      await confirmDispatch(id);
      setSuccessMsg('Vehicle dispatch confirmed successfully. Gate crossing recorded in audit log.');
      fetchGatePass();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to confirm dispatch.');
      fetchGatePass();
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setError('A mandatory reason is required to cancel a gate pass.');
      return;
    }
    try {
      setActionLoading(true);
      await cancelGatePass(id, { reason: cancelReason.trim() });
      setShowCancelModal(false);
      setSuccessMsg('Gate pass has been cancelled.');
      fetchGatePass();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to cancel gate pass.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestReweigh = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await requestReweigh(id, { reason: reweighReason.trim() });
      setShowReweighModal(false);
      setSuccessMsg('Gate pass marked as REWEIGHING_REQUIRED.');
      fetchGatePass();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to request reweighing.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mb-3"></div>
        <p className="font-medium">Loading gate pass details...</p>
      </div>
    );
  }

  if (error && !gatePass) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 p-5 rounded-xl space-y-3">
          <div className="flex items-center gap-2 font-bold text-base">
            <AlertTriangle size={20} />
            <span>Error Loading Gate Pass</span>
          </div>
          <p className="text-sm">{error}</p>
          <Link
            to="/gate-passes"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-800 hover:underline"
          >
            ← Back to Gate Passes
          </Link>
        </div>
      </div>
    );
  }

  // Validity calculations
  const expiryTime = new Date(gatePass.validityExpiry).getTime();
  const remainingMs = expiryTime - now;
  const isExpired = remainingMs <= 0 || gatePass.status === 'REWEIGHING_REQUIRED';
  const totalSeconds = isExpired ? 0 : Math.floor(remainingMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const formattedCountdown = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const docNumber = gatePass.transactionType === 'BILL' 
    ? (gatePass.bill?.billNumber || 'Bill') 
    : (gatePass.estimate?.estimateNumber || 'Estimate');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/gate-passes"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                {gatePass.gatePassNumber}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                gatePass.status === 'DISPATCHED' ? 'bg-emerald-100 text-emerald-800' :
                gatePass.status === 'ISSUED' ? 'bg-indigo-100 text-indigo-800' :
                gatePass.status === 'REWEIGHING_REQUIRED' ? 'bg-rose-100 text-rose-800' :
                gatePass.status === 'CANCELLED' ? 'bg-slate-100 text-slate-500 line-through' :
                'bg-blue-100 text-blue-800'
              }`}>
                {gatePass.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Created on {new Date(gatePass.createdAt).toLocaleString()} by {gatePass.creator?.username || 'User'}
            </p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Issue Pass Button */}
          {gatePass.status === 'READY_FOR_DISPATCH' && (
            <button
              onClick={handleIssue}
              disabled={actionLoading || isExpired}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-lg transition-colors ${
                actionLoading || isExpired
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              <Send size={15} /> Issue Gate Pass
            </button>
          )}

          {/* Print Button (Unlocked after issuance or dispatch) */}
          {['ISSUED', 'DISPATCHED'].includes(gatePass.status) && (
            <Link
              to={`/gate-passes/${gatePass.id}/print`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
            >
              <Printer size={15} /> Print A4 Gate Pass
            </Link>
          )}

          {/* Confirm Gate Crossing (Operator physical dispatch action) */}
          {gatePass.status === 'ISSUED' && (
            <button
              onClick={handleConfirmDispatch}
              disabled={actionLoading || isExpired}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-lg shadow-xs transition-colors ${
                actionLoading || isExpired
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <CheckCircle2 size={15} /> Confirm Gate Crossing
            </button>
          )}

          {/* Request Reweigh */}
          {!['DISPATCHED', 'CANCELLED', 'REWEIGHING_REQUIRED'].includes(gatePass.status) && (
            <button
              onClick={() => setShowReweighModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RotateCcw size={15} /> Request Reweigh
            </button>
          )}

          {/* Cancel Pass */}
          {!['DISPATCHED', 'CANCELLED'].includes(gatePass.status) && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Ban size={15} /> Cancel Pass
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800 font-bold">×</button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle size={18} className="text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold">×</button>
        </div>
      )}

      {/* 10-Minute Validity Banner / Countdown Card */}
      {gatePass.status !== 'DISPATCHED' && gatePass.status !== 'CANCELLED' && (
        <div className={`p-5 rounded-xl border-2 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isExpired 
            ? 'bg-rose-50 border-rose-300 text-rose-900' 
            : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-start gap-3">
            <Clock className={isExpired ? 'text-rose-600 mt-1 shrink-0' : 'text-blue-600 mt-1 shrink-0 animate-pulse'} size={24} />
            <div>
              <h2 className="text-base font-bold">
                {isExpired ? 'Time Exceeded — Re-weighing Mandatory' : '10-Minute Exit Validity Window Active'}
              </h2>
              {isExpired ? (
                <p className="text-xs text-rose-700 font-medium mt-1">
                  The vehicle did not cross the exit gate within the allowable 10-minute window. Physical dispatch is locked on the backend. Fresh weighbridge readings must be recorded before a gate pass can be dispatched.
                </p>
              ) : (
                <p className="text-xs text-blue-700 mt-1">
                  Validity started at {new Date(gatePass.validityStart).toLocaleTimeString()} and expires at {new Date(gatePass.validityExpiry).toLocaleTimeString()}.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isExpired ? (
              gatePass.weighingRecordId && (
                <Link
                  to={`/weighbridge/new?reweighOf=${gatePass.weighingRecordId}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                >
                  <RotateCcw size={15} /> Reweigh Vehicle Now
                </Link>
              )
            ) : (
              <div className="bg-white px-5 py-2.5 rounded-xl border border-blue-200 text-center shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Time Remaining</span>
                <span className="text-2xl font-black font-mono text-blue-900">{formattedCountdown}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dispatched Confirmation Banner */}
      {gatePass.status === 'DISPATCHED' && (
        <div className="bg-emerald-50 border border-emerald-300 p-5 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-emerald-600" />
            <div>
              <h2 className="text-base font-bold text-emerald-900">Vehicle Dispatched</h2>
              <p className="text-xs text-emerald-700 mt-0.5">
                Physical gate crossing confirmed at {new Date(gatePass.dispatchedAt).toLocaleString()} by {gatePass.dispatcher?.username || 'Gate Operator'}.
              </p>
            </div>
          </div>
          <Link
            to={`/gate-passes/${gatePass.id}/print`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50"
          >
            <Printer size={15} /> Print Pass
          </Link>
        </div>
      )}

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vehicle & Gate Pass Overview */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <Truck className="text-blue-600" size={16} /> Vehicle & Destination
          </h2>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-slate-500 font-medium">Vehicle Registration:</p>
              <p className="font-bold text-slate-900 font-mono text-base mt-0.5 tracking-wide">
                {gatePass.vehicleNumber}
              </p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Driver Name:</p>
              <p className="font-semibold text-slate-800 mt-0.5">{gatePass.driverName || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Driver Phone:</p>
              <p className="font-semibold text-slate-800 mt-0.5">{gatePass.driverPhone || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Organization:</p>
              <p className="font-semibold text-slate-800 mt-0.5">{gatePass.organization?.name || 'Office'}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-xs">
            <p className="text-slate-500 font-medium">Destination:</p>
            <p className="font-medium text-slate-800 mt-0.5 bg-slate-50 p-2.5 rounded border border-slate-100">
              {gatePass.destination || 'Direct Customer Delivery'}
            </p>
          </div>

          {gatePass.remarks && (
            <div className="text-xs">
              <p className="text-slate-500 font-medium">Security / Dispatch Remarks:</p>
              <p className="text-slate-700 mt-0.5 bg-slate-50 p-2.5 rounded border border-slate-100">
                {gatePass.remarks}
              </p>
            </div>
          )}
        </div>

        {/* Weighing & Transaction Details */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <Scale className="text-blue-600" size={16} /> Weighing Verification
          </h2>

          {gatePass.weighingRecord ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Weighing Number:</span>
                <Link
                  to={`/weighbridge/${gatePass.weighingRecord.id}`}
                  className="font-bold font-mono text-blue-600 hover:underline"
                >
                  {gatePass.weighingRecord.weighingNumber}
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[10px] text-slate-400 block uppercase">Tare</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {parseFloat(gatePass.weighingRecord.tareWeight).toFixed(1)} {gatePass.weighingRecord.unit}
                  </span>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[10px] text-slate-400 block uppercase">Gross</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {parseFloat(gatePass.weighingRecord.grossWeight).toFixed(1)} {gatePass.weighingRecord.unit}
                  </span>
                </div>
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <span className="text-[10px] text-blue-700 font-semibold block uppercase">Net Weight</span>
                  <span className="font-black text-blue-900 font-mono">
                    {parseFloat(gatePass.weighingRecord.netWeight).toFixed(2)} {gatePass.weighingRecord.unit}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <span className="text-slate-500">Weight Scale Source:</span>
                <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-600 border border-slate-200">
                  Manual Entry
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No weighing record attached.</p>
          )}

          {/* Reference Transaction */}
          <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Reference Document:</span>
              <div className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  gatePass.transactionType === 'BILL' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {gatePass.transactionType}
                </span>
                <span className="font-bold text-slate-900">{docNumber}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Customer:</span>
              <span className="font-semibold text-slate-800">{gatePass.customer?.name || 'Customer'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit History Timeline */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
          <History className="text-blue-600" size={16} /> Audit Trail & History
        </h2>

        {gatePass.audits && gatePass.audits.length > 0 ? (
          <div className="space-y-3">
            {gatePass.audits.map((a) => (
              <div key={a.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-start justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{a.action}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600">by {a.performer?.username || 'User'}</span>
                    {a.ipAddress && (
                      <span className="text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {a.ipAddress}
                      </span>
                    )}
                  </div>
                  {a.reason && (
                    <p className="text-slate-600 mt-1">{a.reason}</p>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No audit records recorded yet.</p>
        )}
      </div>

      {/* Modal: Cancel Gate Pass */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-red-900 flex items-center gap-2">
                <Ban className="text-red-600" size={18} /> Cancel Gate Pass
              </h3>
              <button onClick={() => setShowCancelModal(false)} className="text-slate-400 font-bold">×</button>
            </div>
            <form onSubmit={handleCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mandatory Cancellation Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows="3"
                  placeholder="State reason for cancellation..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !cancelReason.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Request Reweigh */}
      {showReweighModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="text-purple-600" size={18} /> Request Vehicle Reweigh
              </h3>
              <button onClick={() => setShowReweighModal(false)} className="text-slate-400 font-bold">×</button>
            </div>
            <form onSubmit={handleRequestReweigh} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Reweighing Request (Optional)
                </label>
                <textarea
                  rows="3"
                  placeholder="e.g. Visual inspection discrepancy, load shifted..."
                  value={reweighReason}
                  onChange={(e) => setReweighReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReweighModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg"
                >
                  Mark for Reweighing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GatePassDetail;
