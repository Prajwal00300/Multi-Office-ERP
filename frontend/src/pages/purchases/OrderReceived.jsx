import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  Inbox, 
  Calendar, 
  Package, 
  Clock, 
  Layers, 
  FileText,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { lookupPurchaseByNumber, receiveGoods } from '../../services/purchaseService';

const OrderReceived = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Search input state
  const [orderIdInput, setOrderIdInput] = useState(searchParams.get('orderId') || '');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // Loaded order state
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderData, setOrderData] = useState(null);

  // Line item received inputs: keyed by purchaseItemId -> quantityReceivedNow
  const [receivedInputs, setReceivedInputs] = useState({});

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [lastReceipt, setLastReceipt] = useState(null);

  // Auto-search if orderId was passed in query params
  useEffect(() => {
    const initialOrderId = searchParams.get('orderId');
    if (initialOrderId && initialOrderId.trim()) {
      handleLookup(initialOrderId.trim());
    }
  }, [searchParams]);

  const handleLookup = async (lookupId) => {
    const target = (lookupId || orderIdInput || '').trim();
    if (!target) {
      setError('Please enter an Order ID to search.');
      return;
    }

    try {
      setLoadingOrder(true);
      setError('');
      setSuccessMsg('');
      setLastReceipt(null);

      const data = await lookupPurchaseByNumber(target);
      setOrderData(data);

      // Initialize inputs for each line with 0
      const initialInputs = {};
      (data.productLines || []).forEach(line => {
        initialInputs[line.id] = '';
      });
      setReceivedInputs(initialInputs);
    } catch (err) {
      console.error(err);
      setOrderData(null);
      setError(err.response?.data?.error || `Purchase Order "${target}" not found or unauthorized.`);
    } finally {
      setLoadingOrder(false);
    }
  };

  const handleQuantityChange = (itemId, val, maxPending) => {
    // Keep raw string for input control
    setReceivedInputs(prev => ({
      ...prev,
      [itemId]: val
    }));
  };

  const handleReceiveAllPending = (itemId, pendingQty) => {
    setReceivedInputs(prev => ({
      ...prev,
      [itemId]: String(pendingQty)
    }));
  };

  // Status Badge Helper
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Fully Received':
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Fully Received
          </span>
        );
      case 'Partially Received':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Clock className="w-3.5 h-3.5" />
            Partially Received
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
            Cancelled
          </span>
        );
      case 'Pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
    }
  };

  // Calculations for current receipt
  const currentTotalReceiving = Object.entries(receivedInputs).reduce((sum, [_, val]) => {
    const num = parseFloat(val);
    return sum + (isNaN(num) || num < 0 ? 0 : num);
  }, 0);

  // Submit Receipt
  const handleRecordReceipt = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!orderData) {
      setError('Please search and load a valid Purchase Order first.');
      return;
    }

    if (!receiptDate) {
      setError('Date received is required.');
      return;
    }

    const linesToSubmit = [];
    let hasOverReceiving = false;
    let hasNegative = false;

    (orderData.productLines || []).forEach(line => {
      const inputVal = receivedInputs[line.id];
      const qtyNow = parseFloat(inputVal) || 0;

      if (qtyNow < 0) {
        hasNegative = true;
      } else if (qtyNow > line.pendingQuantity) {
        hasOverReceiving = true;
      } else if (qtyNow > 0) {
        linesToSubmit.push({
          purchaseItemId: line.id,
          quantityReceivedNow: qtyNow
        });
      }
    });

    if (hasNegative) {
      setError('Received quantities cannot be negative.');
      return;
    }

    if (hasOverReceiving) {
      setError('Quantity received now cannot exceed the pending quantity for any product line.');
      return;
    }

    if (linesToSubmit.length === 0) {
      setError('Please enter a quantity greater than 0 for at least one product line.');
      return;
    }

    try {
      setSubmitting(true);

      // Generate client-side idempotency key to prevent double submits
      const idempotencyKey = `rcpt_${orderData.id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const payload = {
        orderId: orderData.purchaseNumber,
        receiptDate,
        remarks: remarks.trim() || undefined,
        idempotencyKey,
        items: linesToSubmit
      };

      const res = await receiveGoods(payload);

      setLastReceipt(res.goodsReceipt || res.receipt);
      setSuccessMsg(`Goods Receipt #${res.goodsReceipt?.receiptNumber || 'Saved'} recorded successfully! Inventory stock has been updated.`);

      // Refresh order data to show updated received and pending quantities
      await handleLookup(orderData.purchaseNumber);
      setRemarks('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to record goods receipt.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            to="/purchases"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                PART 2: ORDER RECEIVED
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Goods Receipt Interface</h1>
            <p className="text-sm text-gray-500">
              Lookup a Purchase Order by ID and record incoming product deliveries into inventory.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/purchases/new"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Package className="w-4 h-4 text-gray-500" />
            Place New Order
          </Link>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-3 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{successMsg}</p>
            {lastReceipt && (
              <p className="text-xs text-emerald-700 mt-0.5">
                Receipt Reference: <span className="font-mono font-bold">{lastReceipt.receiptNumber}</span> | Date: {lastReceipt.receiptDate}
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: ORDER LOOKUP & DATE SELECTION */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-600" />
          Lookup Purchase Order
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Order ID Input */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Enter Order ID <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={orderIdInput}
                onChange={(e) => setOrderIdInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLookup();
                  }
                }}
                placeholder="e.g. PO-001 or PUR-YYYYMM-XXXX"
                className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
              />
              <button
                type="button"
                onClick={() => handleLookup()}
                disabled={loadingOrder}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
              >
                {loadingOrder ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {loadingOrder ? 'Searching...' : 'Retrieve Order'}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Manually entered by the employee. Must match an existing Place Order ID.
            </p>
          </div>

          {/* Goods Receipt Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Goods Received Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Order Header Summary (When loaded) */}
        {orderData && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-base font-bold text-gray-900">
                  {orderData.purchaseNumber}
                </span>
                {getStatusBadge(orderData.status)}
              </div>
              <div className="text-xs text-gray-500">
                Order Date: <span className="font-medium text-gray-700">{orderData.purchaseDate}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-gray-500 block">Party / Supplier:</span>
                <span className="font-semibold text-gray-900 text-sm">
                  {orderData.partyName || orderData.vendorName || '-'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Office / Organization:</span>
                <span className="font-medium text-gray-800">
                  {orderData.organization?.name || 'Authorized Office'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Overall Status:</span>
                <span className="font-semibold text-gray-800">
                  {orderData.status}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: PRODUCT LINES & RECEIVE QUANTITIES */}
      {orderData && (
        <form onSubmit={handleRecordReceipt} className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-600" />
                  Order Product Lines
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Record newly received quantities in Tons for each line. Zero quantity rows will not affect stock.
                </p>
              </div>

              {currentTotalReceiving > 0 && (
                <div className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
                  Receiving Now: {currentTotalReceiving.toFixed(3)} Tons
                </div>
              )}
            </div>

            {/* Product Lines Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/50">
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3 min-w-[200px]">Product</th>
                    <th className="py-3 px-3 w-36">Carbon Type</th>
                    <th className="py-3 px-3 w-32 text-right">Ordered Qty</th>
                    <th className="py-3 px-3 w-36 text-right">Previously Received</th>
                    <th className="py-3 px-3 w-32 text-right">Pending Qty</th>
                    <th className="py-3 px-3 w-48 text-right">Quantity Received Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(orderData.productLines || []).map((line, index) => {
                    const inputVal = receivedInputs[line.id] || '';
                    const numVal = parseFloat(inputVal) || 0;
                    const isFullyReceived = line.pendingQuantity <= 0;
                    const isOver = numVal > line.pendingQuantity;

                    return (
                      <tr key={line.id} className="hover:bg-gray-50/50 transition-colors">
                        {/* Index */}
                        <td className="py-3.5 px-3 text-center text-xs font-semibold text-gray-400">
                          {index + 1}
                        </td>

                        {/* Product */}
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-gray-900 text-sm">
                            {line.productName}
                          </div>
                          {line.currentStock !== undefined && (
                            <div className="text-[11px] text-gray-400">
                              Current Stock: {parseFloat(line.currentStock || 0).toFixed(3)} Tons
                            </div>
                          )}
                        </td>

                        {/* Carbon Type */}
                        <td className="py-3.5 px-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            line.carbonType === 'High Carbon'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-teal-100 text-teal-800 border border-teal-200'
                          }`}>
                            {line.carbonType || 'Low Carbon'}
                          </span>
                        </td>

                        {/* Ordered Qty */}
                        <td className="py-3.5 px-3 text-right font-medium text-gray-700 text-sm">
                          {line.orderedQuantity.toFixed(3)} <span className="text-xs text-gray-400">T</span>
                        </td>

                        {/* Previously Received Qty */}
                        <td className="py-3.5 px-3 text-right font-medium text-emerald-700 text-sm">
                          {line.previouslyReceivedQuantity.toFixed(3)} <span className="text-xs text-gray-400">T</span>
                        </td>

                        {/* Pending Qty */}
                        <td className="py-3.5 px-3 text-right text-sm">
                          {isFullyReceived ? (
                            <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                              0.000 (Complete)
                            </span>
                          ) : (
                            <span className="font-bold text-amber-600">
                              {line.pendingQuantity.toFixed(3)} <span className="text-xs font-normal text-gray-400">T</span>
                            </span>
                          )}
                        </td>

                        {/* Quantity Received Now Input */}
                        <td className="py-3.5 px-3 text-right">
                          {isFullyReceived ? (
                            <div className="text-xs font-medium text-gray-400 italic">
                              Fully Received
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="relative inline-block w-full">
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  max={line.pendingQuantity}
                                  value={inputVal}
                                  onChange={(e) => handleQuantityChange(line.id, e.target.value, line.pendingQuantity)}
                                  placeholder="0.000"
                                  className={`w-full px-3 py-1.5 pr-12 border rounded-lg text-sm text-right font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                                    isOver 
                                      ? 'border-red-500 bg-red-50 text-red-700' 
                                      : numVal > 0 
                                      ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900' 
                                      : 'border-gray-300'
                                  }`}
                                />
                                <span className="absolute right-3 top-2 text-xs text-gray-400 pointer-events-none">
                                  Tons
                                </span>
                              </div>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleReceiveAllPending(line.id, line.pendingQuantity)}
                                  className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  Receive Full ({line.pendingQuantity.toFixed(3)} T)
                                </button>
                              </div>
                              {isOver && (
                                <p className="text-[10px] text-red-600">
                                  Exceeds pending ({line.pendingQuantity.toFixed(3)} T)
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Summary Footer */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center mt-4">
              <div>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Total Ordered</p>
                <p className="text-lg font-bold text-gray-900">
                  {orderData.totalOrderedQuantity?.toFixed(3) || '0.000'} Tons
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Previously Received</p>
                <p className="text-lg font-bold text-emerald-700">
                  {orderData.totalReceivedQuantity?.toFixed(3) || '0.000'} Tons
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Remaining Pending</p>
                <p className="text-lg font-bold text-amber-700">
                  {orderData.totalPendingQuantity?.toFixed(3) || '0.000'} Tons
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Receiving Now</p>
                <p className="text-lg font-extrabold text-blue-700">
                  {currentTotalReceiving.toFixed(3)} Tons
                </p>
              </div>
            </div>

            {/* Optional Remarks for this receipt */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Receipt Notes / Remarks (Optional)
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Weighbridge Slip #4412, Gate receipt batch 1"
                className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Inventory Safe Notice */}
            <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-lg p-3 text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Inventory Stock Update:</strong> Saving this receipt will increment product inventory stock <strong>only</strong> by the quantity received in this receipt. Cumulative quantities are never double counted.
              </span>
            </div>
          </div>

          {/* Past Receipts History (If any) */}
          {orderData.receipts && orderData.receipts.length > 0 && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                Previous Receipts for this Order ({orderData.receipts.length})
              </h3>
              <div className="space-y-2">
                {orderData.receipts.map(rcpt => (
                  <div key={rcpt.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-mono font-bold text-gray-800">{rcpt.receiptNumber}</span>
                      <span className="text-gray-500 ml-2">Date: {rcpt.receiptDate}</span>
                      {rcpt.receiver && (
                        <span className="text-gray-500 ml-2">By: {rcpt.receiver.username}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(rcpt.items || []).map((it, idx) => (
                        <span key={idx} className="bg-white px-2 py-0.5 border border-gray-200 rounded font-medium text-gray-700">
                          {it.productNameSnapshot}: {parseFloat(it.quantityReceived || 0).toFixed(3)} T
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Link
              to="/purchases"
              className="px-5 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              Back to Purchases
            </Link>
            <button
              type="submit"
              disabled={submitting || currentTotalReceiving <= 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {submitting ? 'Recording Receipt...' : `Record Receipt (${currentTotalReceiving.toFixed(3)} Tons)`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default OrderReceived;
