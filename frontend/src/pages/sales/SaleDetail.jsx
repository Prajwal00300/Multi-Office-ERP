import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit3, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Building2, 
  ShoppingBag, 
  AlertCircle, 
  Package,
  FileText,
  Layers,
  Printer,
  TrendingUp
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { getSaleOrderById } from '../../services/saleOrderService';

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

const SaleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSale = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getSaleOrderById(id);
      setSale(data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch sale order details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSale();
  }, [id]);

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Fully Processed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Fully Processed
          </span>
        );
      case 'Partially Processed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Clock className="w-3.5 h-3.5" />
            Partially Processed
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

  if (error || !sale) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <h2 className="text-lg font-bold text-red-800">Error Loading Sale Order</h2>
          <p className="text-sm text-red-700">{error || 'Sale Order not found'}</p>
          <Link
            to="/sales"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sales
          </Link>
        </div>
      </div>
    );
  }

  const items = sale.items || [];
  const totalOrdered = parseFloat(sale.totalQuantity) || items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
  const totalProcessed = items.reduce((s, i) => s + (parseFloat(i.processedQuantity) || 0), 0);
  const totalPending = Math.max(0, totalOrdered - totalProcessed);
  const allocations = sale.allocations || [];
  const totalAmt = parseFloat(sale.totalAmount) || items.reduce((s, i) => s + (parseFloat(i.amount) || (parseFloat(i.quantity || 0) * parseFloat(i.rate || 0))), 0);
  const averagePrice = totalOrdered > 0 ? (totalAmt / totalOrdered) : (parseFloat(sale.averagePrice) || 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            to="/sales"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-gray-900">Sale Order #{cleanSerialNumber(sale.orderNumber)}</h1>
              {renderStatusBadge(sale.status)}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Order Date: {sale.orderDate} | Created by {sale.creator?.username || 'User'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {totalPending > 0 && sale.status !== 'CANCELLED' && (
            <Link
              to={`/rough-estimate?saleId=${sale.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <FileText className="w-4 h-4" />
              Make Slip via Voucher
            </Link>
          )}

          {/* Print Slip */}
          <Link
            to={`/sales/${sale.id}/print`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Order Slip
          </Link>

          {totalProcessed === 0 && sale.status !== 'CANCELLED' && (
            <Link
              to={`/sale-order?saleId=${sale.id}&mode=edit`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Edit3 className="w-4 h-4" />
              Edit Order
            </Link>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Customer Info */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
            Customer / Buyer
          </h2>
          <div>
            <p className="text-lg font-bold text-gray-900">{sale.customerName || sale.Customer?.name || 'Unspecified Customer'}</p>
            {sale.Customer?.city && (
              <p className="text-xs text-gray-500 mt-0.5">City: {sale.Customer.city}</p>
            )}
            {sale.Customer?.tin && (
              <p className="text-xs text-gray-500">TIN: {sale.Customer.tin}</p>
            )}
            {sale.remarks && (
              <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{sale.remarks}</p>
            )}
          </div>
        </div>

        {/* Office Info */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            Sales Office
          </h2>
          <div>
            <p className="text-lg font-bold text-gray-900">{sale.Organization?.name || `Office #${sale.organizationId}`}</p>
            {sale.Organization?.address && (
              <p className="text-xs text-gray-500 mt-0.5">{sale.Organization.address}</p>
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
              <p className="text-[10px] text-gray-400 font-semibold uppercase">Delivered</p>
              <p className="text-sm font-bold text-emerald-600">{totalProcessed.toFixed(2)} T</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase">Pending</p>
              <p className="text-sm font-bold text-amber-600">{totalPending.toFixed(2)} T</p>
            </div>
          </div>
        </div>

        {/* Pricing Summary Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            Pricing Summary
          </h2>
          <div className="grid grid-cols-2 gap-2 text-center pt-1">
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase">Avg. Price</p>
              <p className="text-sm font-bold text-emerald-700">
                ₹{averagePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase">Total Value</p>
              <p className="text-sm font-bold text-gray-900">
                ₹{totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Product Lines Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Sale Order Product Lines ({items.length})
          </h2>
          <span className="text-xs text-gray-500">
            All quantities measured in Tons
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Specifications</th>
                <th className="py-3 px-4 text-center">Carbon Type</th>
                <th className="py-3 px-4 text-right">Ordered (T)</th>
                <th className="py-3 px-4 text-right">Delivered (T)</th>
                <th className="py-3 px-4 text-right">Pending (T)</th>
                <th className="py-3 px-4 text-right">Rate (₹)</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((it, idx) => {
                const ord = parseFloat(it.quantity) || 0;
                const proc = parseFloat(it.processedQuantity) || 0;
                const pen = Math.max(0, ord - proc);
                const rateVal = parseFloat(it.rate) || 0;
                const amtVal = parseFloat(it.amount) || (ord * rateVal);

                return (
                  <tr key={it.id || idx} className="hover:bg-gray-50/75 transition-colors">
                    <td className="py-3 px-4 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      {it.productNameSnapshot}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {it.productSpecificationsSnapshot || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        it.carbonType === 'High Carbon'
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-teal-100 text-teal-700 border border-teal-200'
                      }`}>
                        {it.carbonType || 'Low Carbon'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">
                      {ord.toFixed(3)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-700">
                      {proc.toFixed(3)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold">
                      {pen > 0 ? (
                        <span className="text-amber-600">{pen.toFixed(3)}</span>
                      ) : (
                        <span className="text-emerald-600">0.000</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">
                      ₹{rateVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">
                      ₹{amtVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold text-gray-900 border-t border-gray-200">
              <tr>
                <td colSpan={4} className="py-3 px-4 text-right">Totals:</td>
                <td className="py-3 px-4 text-right">{totalOrdered.toFixed(3)} T</td>
                <td className="py-3 px-4 text-right text-emerald-700">{totalProcessed.toFixed(3)} T</td>
                <td className="py-3 px-4 text-right text-amber-700">{totalPending.toFixed(3)} T</td>
                <td className="py-3 px-4 text-right text-xs text-gray-600 font-mono">
                  {averagePrice > 0 ? (
                    <span title="Average Price">Avg: ₹{averagePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  ) : '-'}
                </td>
                <td className="py-3 px-4 text-right text-blue-700 font-mono">
                  ₹{totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Linked Sale Estimate Vouchers / Allocations History */}
      {allocations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Generated Rough Estimate Slips ({allocations.length})
            </h2>
            {totalPending > 0 && sale.status !== 'CANCELLED' && (
              <Link
                to={`/rough-estimate?saleId=${sale.id}`}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                + Generate Slip via Voucher
              </Link>
            )}
          </div>

          <div className="space-y-3">
            {allocations.map((alloc) => (
              <div key={alloc.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/estimates/${alloc.estimateId}`}
                      className="font-mono font-bold text-blue-600 hover:underline text-sm"
                    >
                      Estimate Voucher #{alloc.Estimate?.estimateNumber || alloc.estimateId}
                    </Link>
                    <span className="text-gray-500">Date: {alloc.Estimate?.estimateDate || '-'}</span>
                    <span className="text-gray-500">Status: {alloc.Estimate?.status || 'APPROVED'}</span>
                  </div>
                  <div className="font-semibold text-emerald-700 text-sm">
                    Allocated: {parseFloat(alloc.allocatedQuantity || 0).toFixed(3)} Tons
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SaleDetail;