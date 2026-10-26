import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit3, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Building2, 
  User, 
  ShoppingCart, 
  AlertCircle, 
  Package,
  Inbox,
  FileText,
  Layers,
  Calendar,
  Printer
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { getPurchaseById } from '../../services/purchaseService';

const cleanSerialNumber = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  if (/^[0-9]+$/.test(str)) {
    return String(parseInt(str, 10));
  }
  const match = str.match(/\d+$/);
  if (match) {
    return String(parseInt(match[0], 10));
  }
  return str;
};

const PurchaseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPurchase = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getPurchaseById(id);
      setPurchase(data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch purchase details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchase();
  }, [id]);

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Fully Received':
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Fully Received
          </span>
        );
      case 'Partially Received':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Clock className="w-3.5 h-3.5" />
            Partially Received
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            Cancelled
          </span>
        );
      case 'Pending':
      case 'DRAFT':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <h2 className="text-lg font-bold text-red-800">Error Loading Purchase Order</h2>
          <p className="text-sm text-red-700">{error || 'Purchase Order not found'}</p>
          <Link
            to="/purchases"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Purchases
          </Link>
        </div>
      </div>
    );
  }

  const items = purchase.items || [];
  const totalOrdered = parseFloat(purchase.totalOrderedQuantity) || items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
  const totalReceived = parseFloat(purchase.totalReceivedQuantity) || items.reduce((s, i) => s + (parseFloat(i.receivedQuantity) || 0), 0);
  const totalPending = Math.max(0, totalOrdered - totalReceived);
  const receipts = purchase.receipts || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            to="/purchases"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-gray-900">{cleanSerialNumber(purchase.purchaseNumber)}</h1>
              {renderStatusBadge(purchase.status)}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Order Date: {purchase.purchaseDate} | Created by {purchase.creator?.username || 'User'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {totalPending > 0 && purchase.status !== 'CANCELLED' && (
            <Link
              to={`/purchases/receive?orderId=${encodeURIComponent(purchase.purchaseNumber)}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Inbox className="w-4 h-4" />
              Receive Goods
            </Link>
          )}

          {/* Print Slip */}
          <Link
            to={`/purchases/${purchase.id}/print`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Order Slip
          </Link>

          {totalReceived === 0 && purchase.status !== 'CANCELLED' && (
            <Link
              to={`/purchase-order?purchaseId=${purchase.id}&mode=edit`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Edit3 className="w-4 h-4" />
              Edit Order
            </Link>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Party Info */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
            Party / Supplier
          </h2>
          <div>
            <p className="text-lg font-bold text-gray-900">{purchase.vendorName || 'Unspecified Party'}</p>
            {purchase.remarks && (
              <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{purchase.remarks}</p>
            )}
          </div>
        </div>

        {/* Office Info */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            Purchasing Office
          </h2>
          <div>
            <p className="text-lg font-bold text-gray-900">{purchase.Organization?.name || `Office #${purchase.organizationId}`}</p>
            {purchase.Organization?.address && (
              <p className="text-xs text-gray-500 mt-0.5">{purchase.Organization.address}</p>
            )}
          </div>
        </div>

        {/* Quantity Status Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            Fulfillment Summary
          </h2>
          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase">Ordered</p>
              <p className="text-sm font-bold text-gray-900">{totalOrdered.toFixed(2)} T</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase">Received</p>
              <p className="text-sm font-bold text-emerald-600">{totalReceived.toFixed(2)} T</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase">Pending</p>
              <p className="text-sm font-bold text-amber-600">{totalPending.toFixed(2)} T</p>
            </div>
          </div>
        </div>
      </div>

      {/* Product Lines Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Purchase Order Product Lines ({items.length})
          </h2>
          <span className="text-xs text-gray-500">
            All quantities measured in Tons
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4 min-w-[200px]">Product</th>
                <th className="py-3 px-4 w-36">Carbon Type</th>
                <th className="py-3 px-4 text-right">Ordered Qty</th>
                <th className="py-3 px-4 text-right">Received Qty</th>
                <th className="py-3 px-4 text-right">Pending Qty</th>
                <th className="py-3 px-4 text-center">Line Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item, index) => {
                const ordered = parseFloat(item.quantity) || 0;
                const received = parseFloat(item.receivedQuantity) || 0;
                const pending = Math.max(0, ordered - received);
                const isLineComplete = pending <= 0;

                return (
                  <tr key={item.id || index} className="hover:bg-gray-50/60">
                    <td className="py-3.5 px-4 text-center text-gray-400 font-mono">{index + 1}</td>
                    <td className="py-3.5 px-4 font-semibold text-gray-900 text-sm">
                      {item.productNameSnapshot}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        item.carbonType === 'High Carbon'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-teal-100 text-teal-800 border border-teal-200'
                      }`}>
                        {item.carbonType || 'Low Carbon'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-gray-900 text-sm">
                      {ordered.toFixed(3)} Tons
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-emerald-700 text-sm">
                      {received.toFixed(3)} Tons
                    </td>
                    <td className="py-3.5 px-4 text-right text-sm">
                      {isLineComplete ? (
                        <span className="text-gray-400">0.000 Tons</span>
                      ) : (
                        <span className="font-bold text-amber-600">{pending.toFixed(3)} Tons</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {isLineComplete ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          <CheckCircle className="w-3 h-3" /> Fully Received
                        </span>
                      ) : received > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3" /> Partial ({((received / ordered) * 100).toFixed(0)}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Goods Receipts History */}
      {receipts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Goods Receipts History ({receipts.length})
            </h2>
            <Link
              to={`/purchases/receive?orderId=${encodeURIComponent(purchase.purchaseNumber)}`}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              + Record Another Receipt
            </Link>
          </div>

          <div className="space-y-3">
            {receipts.map(rcpt => (
              <div key={rcpt.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-gray-900 text-sm">{rcpt.receiptNumber}</span>
                    <span className="text-gray-500">Date: {rcpt.receiptDate}</span>
                  </div>
                  <div className="text-gray-500">
                    Received by: <span className="font-medium text-gray-800">{rcpt.receiver?.username || 'Employee'}</span>
                  </div>
                </div>

                {/* Items in this receipt */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-200/60">
                  {(rcpt.items || []).map((it, idx) => (
                    <span key={idx} className="bg-white px-2.5 py-1 border border-gray-200 rounded text-gray-800 font-medium">
                      {it.productNameSnapshot} ({it.carbonType}): <strong className="text-emerald-700">{parseFloat(it.quantityReceived || 0).toFixed(3)} Tons</strong>
                    </span>
                  ))}
                </div>

                {rcpt.remarks && (
                  <p className="text-[11px] text-gray-500 italic mt-1">
                    Notes: {rcpt.remarks}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseDetail;
