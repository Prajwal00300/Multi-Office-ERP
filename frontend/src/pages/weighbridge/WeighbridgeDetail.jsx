import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Scale, 
  ArrowLeft, 
  Truck, 
  FileText, 
  User, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  RotateCcw, 
  Ticket, 
  Building,
  Info,
  Clock,
  ShieldAlert
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { getWeighingRecordById, approveDiscrepancy } from '../../services/weighbridgeService';

const WeighbridgeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Discrepancy Approval Modal
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState('');

  const fetchRecord = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getWeighingRecordById(id);
      setRecord(data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to load weighing record details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  const handleApproveDiscrepancy = async (e) => {
    e.preventDefault();
    if (!approvalReason.trim()) {
      setApprovalError('Mandatory justification reason is required to approve discrepancy.');
      return;
    }

    try {
      setApproving(true);
      setApprovalError('');
      await approveDiscrepancy(id, { approvalReason: approvalReason.trim() });
      setShowApprovalModal(false);
      setSuccessMsg('Discrepancy successfully approved by Admin. Record is now eligible for gate pass dispatch.');
      fetchRecord();
    } catch (err) {
      console.error(err);
      setApprovalError(err.response?.data?.error || 'Failed to approve discrepancy.');
    } finally {
      setApproving(false);
    }
  };

  const isAuthorizedAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mb-3"></div>
        <p className="font-medium">Loading weighing record details...</p>
      </div>
    );
  }

  if (error && !record) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 p-5 rounded-xl space-y-3">
          <div className="flex items-center gap-2 font-bold text-base">
            <AlertTriangle size={20} />
            <span>Error Loading Record</span>
          </div>
          <p className="text-sm">{error}</p>
          <Link
            to="/weighbridge"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-800 hover:underline"
          >
            ← Back to Weighbridge History
          </Link>
        </div>
      </div>
    );
  }

  const docNumber = record.transactionType === 'BILL' 
    ? (record.bill?.billNumber || 'Bill') 
    : (record.estimate?.estimateNumber || 'Estimate');
  const docDate = record.transactionType === 'BILL' 
    ? record.bill?.billDate 
    : record.estimate?.estimateDate;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Navigation & Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/weighbridge"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {record.weighingNumber}
              </h1>
              {record.isReweigh && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
                  Reweigh Record
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Recorded on {new Date(record.weighedAt || record.createdAt).toLocaleString()} by {record.recorder?.username || 'Operator'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {record.status !== 'SUPERSEDED' && (
            <Link
              to={`/weighbridge/new?reweighOf=${record.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
            >
              <RotateCcw size={15} /> Reweigh Vehicle
            </Link>
          )}

          {['VERIFIED', 'APPROVED'].includes(record.status) && (
            <Link
              to={`/gate-passes/new?weighingRecordId=${record.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
            >
              <Ticket size={15} /> Generate Gate Pass
            </Link>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800 font-bold">×</button>
        </div>
      )}

      {/* Superseded Banner */}
      {record.status === 'SUPERSEDED' && (
        <div className="bg-slate-100 border border-slate-300 p-4 rounded-xl flex items-start gap-3">
          <Info className="text-slate-500 shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-slate-700">
            <p className="font-semibold">Record Superseded by Reweighing</p>
            <p className="text-xs text-slate-500 mt-0.5">
              This weighing record has been superseded by a subsequent reweighing operation. It is retained strictly for immutable audit trail compliance.
            </p>
          </div>
        </div>
      )}

      {/* Previous Record Reference Banner (If this is a reweigh) */}
      {record.isReweigh && record.previousRecord && (
        <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl flex items-center justify-between text-xs text-purple-900">
          <div className="flex items-center gap-2">
            <RotateCcw size={16} className="text-purple-600" />
            <span>
              Reweigh of previous record: <strong>{record.previousRecord.weighingNumber}</strong> (Net: {record.previousRecord.netWeight} {record.unit})
            </span>
          </div>
          <Link 
            to={`/weighbridge/${record.previousRecord.id}`}
            className="text-purple-700 font-semibold underline hover:text-purple-900"
          >
            View Original Record →
          </Link>
        </div>
      )}

      {/* Discrepancy Status Card & Approval Action */}
      {record.status === 'DISCREPANCY_FLAGGED' && (
        <div className="bg-amber-50 border-2 border-amber-300 p-5 rounded-xl space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={22} />
              <div>
                <h3 className="text-sm font-bold text-amber-900">
                  Weight Discrepancy Flagged — CEO / Admin Review Required
                </h3>
                <p className="text-xs text-amber-800 mt-1">
                  {record.discrepancyReason || 'Net weight does not match the expected bill/estimate quantity.'}
                </p>
                <p className="text-xs text-amber-700 mt-1 font-medium">
                  Dispatch is blocked until authorized Admin/CEO approval is granted with a mandatory reason, or vehicle is reweighed.
                </p>
              </div>
            </div>

            {isAuthorizedAdmin ? (
              <button
                onClick={() => setShowApprovalModal(true)}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 shadow-xs transition-colors"
              >
                <ShieldCheck size={16} /> Approve Discrepancy
              </button>
            ) : (
              <span className="shrink-0 px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-lg border border-amber-200">
                Awaiting Admin Approval
              </span>
            )}
          </div>
        </div>
      )}

      {/* Discrepancy Approved Card */}
      {record.status === 'APPROVED' && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-blue-900">
            <ShieldCheck className="text-blue-600" size={18} />
            <span>Discrepancy Approved by CEO / Admin</span>
          </div>
          <div className="text-xs text-blue-800 space-y-1">
            <p><strong>Approved By:</strong> {record.approver?.username || 'Admin'} on {new Date(record.discrepancyApprovedAt).toLocaleString()}</p>
            <p><strong>Justification / Reason:</strong> {record.discrepancyApprovalReason}</p>
          </div>
        </div>
      )}

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scale Weights Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Scale className="text-blue-600" size={16} /> Scale Readings
            </h2>
            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-600 border border-slate-200">
              Source: Manual Entry
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Tare Weight</p>
              <p className="text-lg font-bold font-mono text-slate-800 mt-1">
                {parseFloat(record.tareWeight).toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-400">{record.unit}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Gross Weight</p>
              <p className="text-lg font-bold font-mono text-slate-800 mt-1">
                {parseFloat(record.grossWeight).toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-400">{record.unit}</p>
            </div>

            <div className="p-3 bg-blue-50/80 rounded-lg border border-blue-200 text-center">
              <p className="text-[11px] font-semibold text-blue-700 uppercase">Net Weight</p>
              <p className="text-xl font-black font-mono text-blue-900 mt-1">
                {parseFloat(record.netWeight).toFixed(2)}
              </p>
              <p className="text-[10px] text-blue-600 font-semibold">{record.unit}</p>
            </div>
          </div>

          {/* Expected Weight Comparison */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Expected Weight (from items):</span>
              <span className="font-bold text-slate-800 font-mono">
                {record.expectedWeight !== null && record.expectedWeight !== undefined 
                  ? `${parseFloat(record.expectedWeight).toFixed(2)} ${record.unit}` 
                  : 'N/A (Manual Verification)'}
              </span>
            </div>
            {record.weightDifference !== null && record.weightDifference !== undefined && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-600">Variance / Difference:</span>
                <span className={`font-bold font-mono ${
                  parseFloat(record.weightDifference) === 0 
                    ? 'text-emerald-700' 
                    : 'text-amber-700'
                }`}>
                  {parseFloat(record.weightDifference) > 0 ? `+${parseFloat(record.weightDifference).toFixed(2)}` : parseFloat(record.weightDifference).toFixed(2)} {record.unit}
                </span>
              </div>
            )}
          </div>

          {record.notes && (
            <div className="pt-2">
              <p className="text-xs text-slate-500 font-semibold">Operator Remarks:</p>
              <p className="text-xs text-slate-700 mt-0.5 bg-slate-50 p-2.5 rounded border border-slate-100">
                {record.notes}
              </p>
            </div>
          )}
        </div>

        {/* Vehicle & Transaction Info */}
        <div className="space-y-6">
          {/* Vehicle Information */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <Truck className="text-blue-600" size={16} /> Vehicle & Driver
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-500 font-medium">Vehicle Registration:</p>
                <p className="font-bold text-slate-900 font-mono text-sm mt-0.5 tracking-wide">
                  {record.vehicleNumber}
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Driver Name:</p>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {record.driverName || 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Driver Phone:</p>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {record.driverPhone || 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Organization:</p>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {record.organization?.name || 'Office'}
                </p>
              </div>
            </div>
          </div>

          {/* Reference Transaction */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="text-blue-600" size={16} /> Reference Transaction
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Document:</span>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    record.transactionType === 'BILL' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {record.transactionType}
                  </span>
                  <span className="font-bold text-slate-900">{docNumber}</span>
                </div>
              </div>

              {docDate && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Document Date:</span>
                  <span className="text-slate-700 font-medium">{docDate}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Customer:</span>
                <span className="font-semibold text-slate-800">{record.customer?.name || 'Customer'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Approve Discrepancy */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="text-amber-600" size={20} />
                Authorize Discrepancy Approval
              </h3>
              <button 
                onClick={() => setShowApprovalModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-slate-600">
              You are approving a weight variance of <strong>{record.weightDifference} {record.unit}</strong> on record <strong>{record.weighingNumber}</strong>. This approval will be permanently logged under your user identity with an immutable timestamp.
            </p>

            {approvalError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                {approvalError}
              </div>
            )}

            <form onSubmit={handleApproveDiscrepancy} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mandatory Justification / Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows="3"
                  placeholder="e.g. Approved by CEO after physical verification of packing material and moisture correction..."
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approving || !approvalReason.trim()}
                  className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white rounded-lg transition-colors ${
                    approving || !approvalReason.trim()
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {approving ? 'Approving...' : 'Confirm Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeighbridgeDetail;
