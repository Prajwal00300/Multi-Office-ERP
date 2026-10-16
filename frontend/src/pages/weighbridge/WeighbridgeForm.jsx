import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  Scale, 
  Search, 
  Truck, 
  User, 
  FileText, 
  Receipt, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowLeft, 
  Save, 
  RotateCcw,
  Info,
  Calendar,
  Building
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { 
  searchTransactions, 
  createWeighingRecord, 
  getWeighingRecordById,
  reweighTransaction 
} from '../../services/weighbridgeService';

const WeighbridgeForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reweighOfId = searchParams.get('reweighOf');
  const isReweigh = Boolean(reweighOfId);

  const { user } = useContext(AuthContext);

  // Form State
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [unit, setUnit] = useState('Kg');
  const [notes, setNotes] = useState('');
  const [reweighReason, setReweighReason] = useState('');

  // Transaction Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [previousRecord, setPreviousRecord] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // If Reweigh mode, fetch the original weighing record
  useEffect(() => {
    if (isReweigh) {
      const fetchOriginal = async () => {
        try {
          setLoading(true);
          const data = await getWeighingRecordById(reweighOfId);
          setPreviousRecord(data);
          setVehicleNumber(data.vehicleNumber || '');
          setDriverName(data.driverName || '');
          setDriverPhone(data.driverPhone || '');
          setUnit(data.unit || 'Kg');

          // Synthesize selectedTransaction
          const txn = {
            id: data.billId || data.estimateId,
            transactionType: data.transactionType,
            documentNumber: data.bill?.billNumber || data.estimate?.estimateNumber || 'Reference Doc',
            date: data.bill?.billDate || data.estimate?.estimateDate,
            customerId: data.customerId,
            customerName: data.customer?.name || 'Customer',
            customerPhone: data.customer?.phone || '',
            customerCity: data.customer?.city || '',
            expectedWeight: data.expectedWeight,
            expectedWeightUnit: data.unit,
            isExpectedWeightAvailable: data.expectedWeight !== null && data.expectedWeight !== undefined,
            expectedWeightReason: data.expectedWeight === null ? 'Expected weight unavailable — manual verification required.' : null,
            items: data.bill?.items || data.estimate?.items || []
          };
          setSelectedTransaction(txn);
        } catch (err) {
          console.error(err);
          setError('Failed to load previous weighing record for reweighing.');
        } finally {
          setLoading(false);
        }
      };
      fetchOriginal();
    }
  }, [isReweigh, reweighOfId]);

  // Search Transactions (Debounced)
  const handleSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setSearching(true);
      setSearchError('');
      const data = await searchTransactions({ search: query.trim() });
      setSearchResults(data || []);
    } catch (err) {
      console.error(err);
      setSearchError('Failed to search transactions.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (isReweigh) return; // Don't search if reweighing fixed transaction
    const timer = setTimeout(() => {
      handleSearch(searchTerm);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm, handleSearch, isReweigh]);

  // Derived Calculations
  const tare = parseFloat(tareWeight) || 0;
  const gross = parseFloat(grossWeight) || 0;
  const calculatedNet = gross > tare ? gross - tare : 0;
  const hasWeightEntry = tareWeight !== '' && grossWeight !== '';
  const isGrossLessThanTare = hasWeightEntry && gross < tare;

  // Expected weight comparison
  let expectedDiff = null;
  let hasDiscrepancy = false;
  if (selectedTransaction?.isExpectedWeightAvailable && hasWeightEntry && !isGrossLessThanTare) {
    const expected = parseFloat(selectedTransaction.expectedWeight) || 0;
    expectedDiff = calculatedNet - expected;
    // Discrepancy if difference is not zero (within floating precision)
    hasDiscrepancy = Math.abs(expectedDiff) > 0.001;
  }

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedTransaction) {
      setError('Please select an eligible Bill or Estimate transaction.');
      return;
    }

    if (!vehicleNumber.trim()) {
      setError('Vehicle Registration Number is required.');
      return;
    }

    if (tareWeight === '' || isNaN(parseFloat(tareWeight)) || parseFloat(tareWeight) < 0) {
      setError('Please enter a valid Tare Weight.');
      return;
    }

    if (grossWeight === '' || isNaN(parseFloat(grossWeight)) || parseFloat(grossWeight) < 0) {
      setError('Please enter a valid Gross Weight.');
      return;
    }

    if (parseFloat(grossWeight) < parseFloat(tareWeight)) {
      setError('Gross weight cannot be less than tare weight (empty vehicle weight).');
      return;
    }

    if (isReweigh && !reweighReason.trim()) {
      setError('A mandatory reason is required when reweighing a vehicle.');
      return;
    }

    try {
      setLoading(true);

      if (isReweigh) {
        const payload = {
          vehicleNumber: vehicleNumber.trim(),
          driverName: driverName.trim(),
          driverPhone: driverPhone.trim(),
          tareWeight: parseFloat(tareWeight),
          grossWeight: parseFloat(grossWeight),
          unit,
          reason: reweighReason.trim(),
          notes: notes.trim()
        };
        const res = await reweighTransaction(reweighOfId, payload);
        navigate(`/weighbridge/${res.weighingRecord.id}`);
      } else {
        const payload = {
          transactionType: selectedTransaction.transactionType,
          transactionId: selectedTransaction.id,
          vehicleNumber: vehicleNumber.trim(),
          driverName: driverName.trim(),
          driverPhone: driverPhone.trim(),
          tareWeight: parseFloat(tareWeight),
          grossWeight: parseFloat(grossWeight),
          unit,
          notes: notes.trim()
        };
        const res = await createWeighingRecord(payload);
        navigate(`/weighbridge/${res.weighingRecord.id}`);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save weighing record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/weighbridge"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Scale className="text-blue-600" />
              {isReweigh ? 'Reweigh Vehicle' : 'New Weighbridge Entry'}
            </h1>
            <p className="text-sm text-slate-500">
              {isReweigh 
                ? `Reweighing transaction against previous record ${previousRecord?.weighingNumber || ''}`
                : 'Select an eligible transaction, record manual scale weights, and verify discrepancy.'}
            </p>
          </div>
        </div>

        {/* Weight Source Indicator */}
        <div className="bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-lg flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
          <span className="text-xs font-semibold text-slate-700">Source: Manual Entry</span>
        </div>
      </div>

      {/* Reweigh Notice Banner */}
      {isReweigh && (
        <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl flex items-start gap-3">
          <RotateCcw className="text-purple-600 shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-purple-900">
            <p className="font-semibold">Reweighing Protocol Active</p>
            <p className="text-xs text-purple-700 mt-0.5">
              Original weighing record <strong>{previousRecord?.weighingNumber}</strong> will be marked as <span className="font-semibold">SUPERSEDED</span>. Both records will be preserved in the audit log for complete traceability.
            </p>
          </div>
        </div>
      )}

      {/* Global Error Banner */}
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
        {/* Step 1: Transaction Selection */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="text-blue-600" size={18} /> 1. Select Bill or Estimate
            </h2>
            {selectedTransaction && !isReweigh && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTransaction(null);
                  setSearchTerm('');
                }}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Change Transaction
              </button>
            )}
          </div>

          {!selectedTransaction ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by Bill #, Estimate #, Customer Name, or Phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {searching && (
                <div className="py-4 text-center text-sm text-slate-500">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-2"></div>
                  Searching eligible transactions...
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {searchResults.map((t) => (
                    <div
                      key={`${t.transactionType}-${t.id}`}
                      onClick={() => {
                        setSelectedTransaction(t);
                        setSearchResults([]);
                        setSearchTerm('');
                      }}
                      className="p-3.5 hover:bg-blue-50/50 cursor-pointer transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            t.transactionType === 'BILL' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {t.transactionType}
                          </span>
                          <span className="font-semibold text-slate-900">{t.documentNumber}</span>
                          <span className="text-xs text-slate-400">({t.date})</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          <strong>Customer:</strong> {t.customerName} {t.customerCity ? `• ${t.customerCity}` : ''}
                        </p>
                      </div>

                      <div className="text-right">
                        {t.isExpectedWeightAvailable ? (
                          <div className="text-xs font-semibold text-emerald-700">
                            Expected: {t.expectedWeight} {t.expectedWeightUnit}
                          </div>
                        ) : (
                          <div className="text-[11px] text-amber-700 italic">
                            Weight unavailable
                          </div>
                        )}
                        <span className="text-xs text-blue-600 font-medium">Select →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!searching && searchTerm.length >= 2 && searchResults.length === 0 && (
                <p className="text-xs text-slate-500 italic py-2 text-center">
                  No finalized bills or generated estimates matching "{searchTerm}".
                </p>
              )}
            </div>
          ) : (
            /* Selected Transaction Summary */
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                    selectedTransaction.transactionType === 'BILL' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {selectedTransaction.transactionType}
                  </span>
                  <span className="font-bold text-slate-900 text-base">{selectedTransaction.documentNumber}</span>
                  <span className="text-xs text-slate-500">Date: {selectedTransaction.date}</span>
                </div>
                {selectedTransaction.organizationName && (
                  <span className="text-xs bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-600 font-medium">
                    {selectedTransaction.organizationName}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700 pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-500 font-medium">Customer:</span>{' '}
                  <span className="font-semibold text-slate-800">{selectedTransaction.customerName}</span>
                  {selectedTransaction.customerCity && ` (${selectedTransaction.customerCity})`}
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Contact:</span>{' '}
                  <span>{selectedTransaction.customerPhone || 'N/A'}</span>
                </div>
              </div>

              {/* Expected Weight Callout */}
              <div className="pt-2 border-t border-slate-200">
                {selectedTransaction.isExpectedWeightAvailable ? (
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-50 px-3 py-2 rounded-md border border-emerald-200">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>
                      Expected Weight from items: <strong>{selectedTransaction.expectedWeight} {selectedTransaction.expectedWeightUnit}</strong>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-medium text-amber-800 bg-amber-50 px-3 py-2 rounded-md border border-amber-200">
                    <Info size={16} className="text-amber-600 shrink-0" />
                    <span>Expected weight unavailable — manual verification required.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Vehicle & Driver Information */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Truck className="text-blue-600" size={18} /> 2. Vehicle Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vehicle Registration # <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. PB-65-AX-1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm uppercase font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Driver Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Jaswinder Singh"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Driver Phone (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 9876543210"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Scale Weight Entry (Manual) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Scale className="text-blue-600" size={18} /> 3. Weight Scale Readings (Manual Entry)
            </h2>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">Unit:</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="px-2.5 py-1 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="Kg">Kg</option>
                <option value="Ton">Ton</option>
                <option value="Quintal">Quintal</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tare Weight */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tare Weight (Empty Vehicle) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="0.00"
                  value={tareWeight}
                  onChange={(e) => setTareWeight(e.target.value)}
                  className="w-full px-3 py-2 text-base font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  required
                />
                <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">
                  {unit}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Weight of empty truck/trailer.</p>
            </div>

            {/* Gross Weight */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Gross Weight (Loaded Vehicle) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="0.00"
                  value={grossWeight}
                  onChange={(e) => setGrossWeight(e.target.value)}
                  className="w-full px-3 py-2 text-base font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  required
                />
                <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">
                  {unit}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Weight of truck with loaded goods.</p>
            </div>

            {/* Calculated Net Weight Card */}
            <div className={`p-4 rounded-xl border flex flex-col justify-center ${
              isGrossLessThanTare
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : calculatedNet > 0
                ? 'bg-blue-50 border-blue-200 text-blue-900'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <p className="text-xs font-semibold uppercase tracking-wider">
                Calculated Net Weight
              </p>
              <p className="text-2xl font-black font-mono mt-1">
                {isGrossLessThanTare ? 'INVALID' : `${calculatedNet.toFixed(2)} ${unit}`}
              </p>
              <p className="text-[11px] mt-1 opacity-75">
                {isGrossLessThanTare 
                  ? 'Gross cannot be less than Tare' 
                  : 'Gross Weight − Tare Weight'}
              </p>
            </div>
          </div>

          {/* Validation Warnings / Discrepancy Alert Card */}
          {isGrossLessThanTare && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>Gross weight ({gross} {unit}) cannot be less than tare weight ({tare} {unit}).</span>
            </div>
          )}

          {!isGrossLessThanTare && hasWeightEntry && (
            <div>
              {selectedTransaction?.isExpectedWeightAvailable ? (
                hasDiscrepancy ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle size={16} className="text-amber-600" />
                      <span>Weight Discrepancy Detected!</span>
                    </div>
                    <p>
                      Calculated Net: <strong>{calculatedNet.toFixed(2)} {unit}</strong> vs. Expected: <strong>{selectedTransaction.expectedWeight} {selectedTransaction.expectedWeightUnit}</strong> (Difference: <strong>{expectedDiff > 0 ? `+${expectedDiff.toFixed(2)}` : expectedDiff.toFixed(2)} {unit}</strong>).
                    </p>
                    <p className="text-amber-700">
                      This entry will be flagged as <span className="font-bold">DISCREPANCY_FLAGGED</span>. It will require CEO / Admin approval before gate pass dispatch.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>Weight Verified: Net weight matches expected bill/estimate quantity exactly ({calculatedNet.toFixed(2)} {unit}).</span>
                  </div>
                )
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs flex items-center gap-2">
                  <Info size={16} className="text-slate-500" />
                  <span>Expected weight unavailable — manual verification required by operator.</span>
                </div>
              )}
            </div>
          )}

          {/* Mandatory Reweigh Reason Field */}
          {isReweigh && (
            <div className="pt-2">
              <label className="block text-xs font-semibold text-purple-900 mb-1">
                Mandatory Reason for Reweighing <span className="text-red-500">*</span>
              </label>
              <textarea
                rows="2"
                placeholder="State reason (e.g. 10-minute gate pass validity expired, recount requested by driver, discrepancy check)..."
                value={reweighReason}
                onChange={(e) => setReweighReason(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-purple-50/50 border border-purple-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
          )}

          {/* General Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Operator Notes / Remarks (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Vehicle entered from North Gate, driver verified cargo"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to="/weighbridge"
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || isGrossLessThanTare || !selectedTransaction}
            className={`inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-lg shadow-sm transition-colors ${
              loading || isGrossLessThanTare || !selectedTransaction
                ? 'bg-slate-300 cursor-not-allowed'
                : isReweigh
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                {isReweigh ? 'Save Reweighed Record' : 'Save Weighing Record'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default WeighbridgeForm;
