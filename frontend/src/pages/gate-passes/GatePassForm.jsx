import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  Ticket, 
  ArrowLeft, 
  Scale, 
  Truck, 
  User, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Building,
  MapPin,
  Save,
  Search,
  Info
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { getWeighingRecords, getWeighingRecordById } from '../../services/weighbridgeService';
import { createGatePass } from '../../services/gatePassService';

const GatePassForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialWeighingId = searchParams.get('weighingRecordId');

  const { user } = useContext(AuthContext);

  const [availableRecords, setAvailableRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Form Fields
  const [destination, setDestination] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch available weighing records (VERIFIED or APPROVED)
  useEffect(() => {
    const fetchEligibleRecords = async () => {
      try {
        setLoadingRecords(true);
        const data = await getWeighingRecords({ limit: 50 });
        // Filter active records
        const active = (data || []).filter(r => r.status !== 'SUPERSEDED');
        setAvailableRecords(active);

        // If initialWeighingId was provided in URL, select it
        if (initialWeighingId) {
          const found = active.find(r => String(r.id) === String(initialWeighingId));
          if (found) {
            setSelectedRecord(found);
          } else {
            // Load by ID directly
            const direct = await getWeighingRecordById(initialWeighingId);
            setSelectedRecord(direct);
          }
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load eligible weighing records.');
      } finally {
        setLoadingRecords(false);
      }
    };

    fetchEligibleRecords();
  }, [initialWeighingId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedRecord) {
      setError('Please select a valid weighing record to generate a Gate Pass.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        weighingRecordId: selectedRecord.id,
        destination: destination.trim(),
        remarks: remarks.trim()
      };

      const res = await createGatePass(payload);
      navigate(`/gate-passes/${res.gatePass.id}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to create gate pass.');
    } finally {
      setLoading(false);
    }
  };

  const docNumber = selectedRecord
    ? (selectedRecord.transactionType === 'BILL' 
        ? (selectedRecord.bill?.billNumber || 'Bill') 
        : (selectedRecord.estimate?.estimateNumber || 'Estimate'))
    : '';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
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
            Generate an official dispatch pass with 10-minute validity tracking and weighing verification.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold">×</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Select Weighing Record */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Scale className="text-blue-600" size={18} /> 1. Select Weighing Record
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Active Weighing Record <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedRecord?.id || ''}
              onChange={(e) => {
                const rec = availableRecords.find(r => String(r.id) === e.target.value);
                setSelectedRecord(rec || null);
              }}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
              required
            >
              <option value="">-- Choose Weighing Record --</option>
              {availableRecords.map((r) => {
                const doc = r.transactionType === 'BILL' ? (r.bill?.billNumber || 'Bill') : (r.estimate?.estimateNumber || 'Estimate');
                return (
                  <option key={r.id} value={r.id}>
                    {r.weighingNumber} — Vehicle: {r.vehicleNumber} | {doc} | Net: {parseFloat(r.netWeight).toFixed(2)} {r.unit} [{r.status}]
                  </option>
                );
              })}
            </select>
          </div>

          {/* Selected Record Snapshot */}
          {selectedRecord && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 mt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 font-mono text-base">
                    {selectedRecord.weighingNumber}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    selectedRecord.transactionType === 'BILL' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {selectedRecord.transactionType}: {docNumber}
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  selectedRecord.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' :
                  selectedRecord.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {selectedRecord.status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-500">Customer:</span>
                  <p className="font-semibold text-slate-800">{selectedRecord.customer?.name || 'Customer'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Vehicle:</span>
                  <p className="font-semibold text-slate-800 font-mono">{selectedRecord.vehicleNumber}</p>
                </div>
                <div>
                  <span className="text-slate-500">Net Weight:</span>
                  <p className="font-bold text-slate-900 font-mono">
                    {parseFloat(selectedRecord.netWeight).toFixed(2)} {selectedRecord.unit}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Tare / Gross:</span>
                  <p className="font-medium text-slate-700 font-mono">
                    {parseFloat(selectedRecord.tareWeight).toFixed(1)} / {parseFloat(selectedRecord.grossWeight).toFixed(1)}
                  </p>
                </div>
              </div>

              {/* Discrepancy warning */}
              {selectedRecord.status === 'DISCREPANCY_FLAGGED' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  <span>
                    Warning: Weight discrepancy is currently flagged for this record. Gate pass issuance and dispatch will require CEO / Admin approval.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Destination & Dispatch Information */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Truck className="text-blue-600" size={18} /> 2. Dispatch Details
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Destination / Unloading Address
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="e.g. Central Depot, GT Road, Ludhiana, Punjab"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dispatch Remarks / Security Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Tarpaulin covered, verified seal #1042"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* 10-Minute Validity Notice */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
            <Clock className="text-blue-600 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-blue-900 space-y-1">
              <p className="font-semibold">Ten-Minute Validity Rule Active</p>
              <p className="text-blue-700">
                Gate passes are valid for exactly <strong>10 minutes</strong> from transaction generation (or reweighing timestamp). If the vehicle does not physically exit the gate within this window, dispatch will be blocked with:
              </p>
              <p className="font-mono font-bold text-red-700 bg-white/80 px-2 py-0.5 rounded inline-block border border-red-200">
                "Time exceeded, re-weighing mandatory."
              </p>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to="/gate-passes"
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !selectedRecord}
            className={`inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-lg shadow-sm transition-colors ${
              loading || !selectedRecord
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Generating Gate Pass...
              </>
            ) : (
              <>
                <Save size={18} /> Generate Gate Pass
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GatePassForm;
