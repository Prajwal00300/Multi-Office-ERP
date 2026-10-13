import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  Printer, 
  Lock, 
  Edit3, 
  ShieldAlert, 
  CheckCircle, 
  Building, 
  User, 
  Calendar, 
  MapPin, 
  Phone, 
  Hash, 
  History, 
  Clock, 
  AlertCircle,
  Plus,
  Trash2
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';

const STANDARD_UNITS = ['Kg', 'Ton', 'Piece', 'Meter', 'Bundle', 'Length'];

const EstimateDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);

  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Override Modal State
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideBasic, setOverrideBasic] = useState('');
  const [overrideOthers, setOverrideOthers] = useState(0);
  const [overrideItems, setOverrideItems] = useState([]);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState('');

  // Fetch Estimate Details
  const fetchEstimate = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/estimates/${id}`);
      setEstimate(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to load estimate details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEstimate();
  }, [fetchEstimate]);

  // If URL has ?action=override, automatically open override modal once loaded
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'override' && estimate && estimate.status !== 'DRAFT') {
      handleOpenOverride();
    }
  }, [location.search, estimate]);

  // Handle Generate & Lock from Draft
  const handleGenerateLock = async () => {
    if (!window.confirm(`Generate and lock estimate ${estimate.estimateNumber}? Once locked, ordinary modifications are prohibited.`)) {
      return;
    }

    try {
      setLoading(true);
      await api.post(`/estimates/${id}/generate`);
      setSuccessMsg(`Estimate ${estimate.estimateNumber} successfully generated and locked.`);
      await fetchEstimate();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to generate estimate.');
    } finally {
      setLoading(false);
    }
  };

  // Open Override Modal
  const handleOpenOverride = () => {
    if (!estimate) return;
    setOverrideReason('');
    setOverrideBasic(estimate.basic || '');
    setOverrideOthers(estimate.others || 0);
    setOverrideItems(estimate.items.map(it => ({
      productId: it.productId,
      productNameSnapshot: it.productNameSnapshot,
      btls: it.btls || '',
      quantity: it.quantity,
      unit: it.unit || 'Kg',
      negotiatedRate: it.negotiatedRate,
      amount: it.amount
    })));
    setOverrideError('');
    setShowOverrideModal(true);
  };

  // Handle Item row change in Override Modal
  const handleOverrideItemChange = (index, field, value) => {
    const newItems = [...overrideItems];
    newItems[index][field] = value;

    if (field === 'quantity' || field === 'negotiatedRate') {
      const q = parseFloat(newItems[index].quantity) || 0;
      const r = parseFloat(newItems[index].negotiatedRate) || 0;
      newItems[index].amount = Math.round((q * r + Number.EPSILON) * 100) / 100;
    }

    setOverrideItems(newItems);
  };

  const handleAddOverrideRow = () => {
    setOverrideItems(prev => [
      ...prev,
      {
        productId: null,
        productNameSnapshot: '',
        btls: '',
        quantity: 1,
        unit: 'Kg',
        negotiatedRate: 0,
        amount: 0
      }
    ]);
  };

  const handleRemoveOverrideRow = (index) => {
    if (overrideItems.length <= 1) return;
    setOverrideItems(prev => prev.filter((_, i) => i !== index));
  };

  // Submit Override
  const handleSubmitOverride = async (e) => {
    e.preventDefault();

    if (!overrideReason || !overrideReason.trim()) {
      return setOverrideError('A detailed reason is mandatory for an authorized override.');
    }

    for (let i = 0; i < overrideItems.length; i++) {
      const it = overrideItems[i];
      if (!it.productNameSnapshot || !it.productNameSnapshot.trim()) {
        return setOverrideError(`Description Goods is required on item ${i + 1}.`);
      }
      if (parseFloat(it.quantity) <= 0) {
        return setOverrideError(`Quantity must be > 0 on item ${i + 1}.`);
      }
      if (parseFloat(it.negotiatedRate) < 0) {
        return setOverrideError(`Rate must be >= 0 on item ${i + 1}.`);
      }
    }

    try {
      setOverrideLoading(true);
      setOverrideError('');

      const payload = {
        reason: overrideReason.trim(),
        basic: overrideBasic.trim() || null,
        others: parseFloat(overrideOthers) || 0,
        items: overrideItems.map(it => ({
          productId: it.productId,
          productNameSnapshot: it.productNameSnapshot.trim(),
          btls: it.btls ? String(it.btls).trim() : null,
          quantity: parseFloat(it.quantity),
          unit: it.unit || 'Kg',
          negotiatedRate: parseFloat(it.negotiatedRate)
        }))
      };

      await api.post(`/estimates/${id}/override`, payload);
      setShowOverrideModal(false);
      setSuccessMsg('Authorized override completed and locked. Audit record created.');
      await fetchEstimate();
    } catch (err) {
      console.error(err);
      setOverrideError(err.response?.data?.error || 'Failed to perform override.');
    } finally {
      setOverrideLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  if (loading) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
        <span className="text-gray-500 text-sm">Loading estimate details...</span>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="p-8 text-center text-gray-500">
        Estimate not found.
      </div>
    );
  }

  const isLocked = estimate.status === 'GENERATED' || estimate.status === 'OVERRIDDEN';
  const canOverride = isLocked && ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <Link
            to="/estimates"
            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors shadow-xs"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-bold font-mono text-gray-900">
                {estimate.estimateNumber}
              </h2>
              {isLocked ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  <Lock size={12} className="mr-1" />
                  Locked
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                  <Clock size={12} className="mr-1" />
                  Draft
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Estimate (K) Document Record
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Print Slip */}
          <Link
            to={`/estimates/${estimate.id}/print`}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center shadow-xs transition-colors"
          >
            <Printer size={16} className="mr-1.5" />
            Print Estimate Slip
          </Link>

          {/* Edit Draft */}
          {estimate.status === 'DRAFT' && (
            <Link
              to={`/estimates/${estimate.id}/edit`}
              className="px-3.5 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium flex items-center shadow-xs transition-colors"
            >
              <Edit3 size={16} className="mr-1.5 text-amber-600" />
              Edit Draft
            </Link>
          )}

          {/* Generate & Lock from Draft */}
          {estimate.status === 'DRAFT' && (
            <button
              onClick={handleGenerateLock}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center shadow-xs transition-colors"
            >
              <Lock size={16} className="mr-1.5" />
              Generate & Lock
            </button>
          )}

          {/* Authorized Override */}
          {canOverride && (
            <button
              onClick={handleOpenOverride}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center shadow-xs transition-colors"
              title="Authorized Override with Audit Record"
            >
              <ShieldAlert size={16} className="mr-1.5" />
              Authorized Override
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center">
          <CheckCircle size={18} className="mr-2 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center">
          <AlertCircle size={18} className="mr-2 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Status Banner */}
      {isLocked && (
        <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Lock size={15} className="text-slate-500" />
            <span>
              <strong>LOCKED RECORD:</strong> This estimate was generated on {estimate.lockedAt ? new Date(estimate.lockedAt).toLocaleDateString() : estimate.estimateDate}
              {estimate.locker ? ` by ${estimate.locker.username}` : ''}.
              Ordinary modifications are prohibited.
            </span>
          </div>
          {estimate.status === 'OVERRIDDEN' && estimate.overrider && (
            <span className="font-semibold text-purple-700">
              Overridden by {estimate.overrider.username}
            </span>
          )}
        </div>
      )}

      {/* Header Info Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Info */}
        <div className="space-y-2 border-b md:border-b-0 md:border-r border-gray-100 pb-4 md:pb-0 md:pr-4">
          <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
            Customer Information
          </span>
          <h4 className="text-base font-bold text-gray-900">
            {estimate.Customer ? estimate.Customer.name : 'Unknown Customer'}
          </h4>
          {estimate.Customer?.address && (
            <p className="text-xs text-gray-500 flex items-center">
              <MapPin size={13} className="mr-1 text-gray-400 shrink-0" />
              {estimate.Customer.address}, {estimate.Customer.city}
            </p>
          )}
          {estimate.Customer?.phone && (
            <p className="text-xs text-gray-500 flex items-center">
              <Phone size={13} className="mr-1 text-gray-400 shrink-0" />
              Phone: {estimate.Customer.phone}
            </p>
          )}
          {estimate.Customer?.tin && (
            <p className="text-xs text-gray-500 flex items-center">
              <Hash size={13} className="mr-1 text-gray-400 shrink-0" />
              TIN: {estimate.Customer.tin}
            </p>
          )}
        </div>

        {/* Office & Details */}
        <div className="space-y-2 border-b md:border-b-0 md:border-r border-gray-100 pb-4 md:pb-0 md:pr-4">
          <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
            Issuing Office & Date
          </span>
          <h4 className="text-base font-bold text-gray-900 flex items-center">
            <Building size={16} className="mr-1.5 text-blue-600" />
            {estimate.Organization ? estimate.Organization.name : 'Organization'}
          </h4>
          <p className="text-xs text-gray-500 flex items-center">
            <Calendar size={13} className="mr-1 text-gray-400 shrink-0" />
            Dt.: {estimate.estimateDate}
          </p>
          <p className="text-xs text-gray-500 flex items-center">
            <User size={13} className="mr-1 text-gray-400 shrink-0" />
            Created By: {estimate.creator ? estimate.creator.username : 'User'}
          </p>
        </div>

        {/* Basic Header Value */}
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
            Header Label
          </span>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-xs text-gray-500 block">Basic:</span>
            <span className="text-sm font-semibold font-mono text-gray-800">
              {estimate.basic || 'Not Specified'}
            </span>
          </div>
          {estimate.notes && (
            <p className="text-xs text-gray-500 italic mt-2">
              Notes: {estimate.notes}
            </p>
          )}
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">
            Product Goods List (Estimate K)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100/70 text-gray-600 text-xs uppercase tracking-wider font-semibold border-b">
                <th className="px-5 py-3 w-12 text-center">#</th>
                <th className="px-5 py-3">Description Goods</th>
                <th className="px-5 py-3 w-32">Btls</th>
                <th className="px-5 py-3 w-32">Quantity</th>
                <th className="px-5 py-3 w-28">Unit</th>
                <th className="px-5 py-3 w-36">Rate</th>
                <th className="px-5 py-3 w-40 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {estimate.items && estimate.items.map((item, index) => (
                <tr key={item.id || index} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3.5 text-center text-xs text-gray-400 font-mono">
                    {index + 1}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    {item.productNameSnapshot}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 font-mono">
                    {item.btls || '-'}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-gray-800 font-mono">
                    {item.quantity}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-medium">
                      {item.unit}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-700 font-mono font-medium">
                    {formatCurrency(item.negotiatedRate)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-gray-900 font-mono">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="p-5 bg-gray-50/80 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-xs text-gray-500">
            <span>Client document format: </span>
            <span className="font-semibold text-gray-700">Estimate (K)</span>
          </div>

          <div className="w-full md:w-80 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Quantity:</span>
              <span className="font-semibold text-gray-800 font-mono">
                {estimate.totalQuantity}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total:</span>
              <span className="font-semibold text-gray-800 font-mono">
                {formatCurrency(estimate.total)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Others:</span>
              <span className="font-semibold text-gray-800 font-mono">
                {formatCurrency(estimate.others)}
              </span>
            </div>

            <div className="border-t border-gray-200 pt-2 flex justify-between text-base font-bold">
              <span className="text-gray-900">Grand Total:</span>
              <span className="text-blue-700 font-mono font-extrabold text-lg">
                {formatCurrency(estimate.grandTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit History Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
          <History size={18} className="text-gray-500" />
          <h3 className="text-base font-bold text-gray-800">
            Estimate Audit Trail & Lock History
          </h3>
        </div>

        {(!estimate.audits || estimate.audits.length === 0) ? (
          <p className="text-xs text-gray-400">No audit records logged yet.</p>
        ) : (
          <div className="space-y-3">
            {estimate.audits.map((audit) => (
              <div 
                key={audit.id} 
                className="p-3.5 bg-gray-50 rounded-lg border border-gray-200/80 text-xs space-y-1.5"
              >
                <div className="flex justify-between items-center">
                  <span className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                    audit.action === 'OVERRIDE'
                      ? 'bg-purple-100 text-purple-800'
                      : audit.action === 'GENERATE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {audit.action}
                  </span>
                  <span className="text-gray-400 font-mono">
                    {new Date(audit.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-gray-700">
                  Performed by: <strong className="text-gray-900">{audit.performer ? audit.performer.username : 'User'}</strong>
                </p>

                {audit.reason && (
                  <p className="text-gray-600 bg-white p-2 rounded border border-gray-200">
                    <strong>Reason:</strong> {audit.reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    Authorized Override: {estimate.estimateNumber}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Overrides are recorded in the permanent audit trail.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowOverrideModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {overrideError && (
              <div className="my-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center">
                <AlertCircle size={16} className="mr-2 text-red-500 shrink-0" />
                <span>{overrideError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitOverride} className="space-y-4 pt-4">
              {/* Mandatory Reason */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-purple-900 mb-1">
                  Override Reason <span className="text-red-500">* (Mandatory)</span>
                </label>
                <textarea
                  rows="2"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain why this locked estimate is being adjusted..."
                  className="block w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  required
                ></textarea>
              </div>

              {/* Basic and Others */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Basic (Header)
                  </label>
                  <input
                    type="text"
                    value={overrideBasic}
                    onChange={(e) => setOverrideBasic(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Others (Bottom Adjustment)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={overrideOthers}
                    onChange={(e) => setOverrideOthers(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-right font-medium"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="p-2.5 bg-gray-50 border-b flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                    Product Line Items
                  </span>
                  <button
                    type="button"
                    onClick={handleAddOverrideRow}
                    className="text-xs text-blue-600 font-semibold flex items-center hover:underline"
                  >
                    <Plus size={13} className="mr-0.5" /> Add Row
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 border-b font-semibold">
                        <th className="px-3 py-2">Description Goods</th>
                        <th className="px-3 py-2 w-20">Btls</th>
                        <th className="px-3 py-2 w-24">Quantity</th>
                        <th className="px-3 py-2 w-20">Unit</th>
                        <th className="px-3 py-2 w-28">Rate (₹)</th>
                        <th className="px-3 py-2 w-28 text-right">Amount (₹)</th>
                        <th className="px-3 py-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {overrideItems.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={row.productNameSnapshot}
                              onChange={(e) => handleOverrideItemChange(idx, 'productNameSnapshot', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                              required
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={row.btls}
                              onChange={(e) => handleOverrideItemChange(idx, 'btls', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-center"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="any"
                              value={row.quantity}
                              onChange={(e) => handleOverrideItemChange(idx, 'quantity', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-right"
                              required
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={row.unit}
                              onChange={(e) => handleOverrideItemChange(idx, 'unit', e.target.value)}
                              className="w-full px-1 py-1 border border-gray-300 rounded text-xs"
                            >
                              {STANDARD_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="any"
                              value={row.negotiatedRate}
                              onChange={(e) => handleOverrideItemChange(idx, 'negotiatedRate', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-right font-medium"
                              required
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-semibold font-mono">
                            {formatCurrency(row.amount)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {overrideItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOverrideRow(idx)}
                                className="text-gray-400 hover:text-red-600"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideLoading}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {overrideLoading ? 'Processing Override...' : 'Apply Authorized Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstimateDetail;
