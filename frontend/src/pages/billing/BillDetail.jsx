import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Printer, 
  Edit3, 
  Lock, 
  ShieldAlert, 
  Calendar, 
  Building2, 
  User, 
  Receipt, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  History,
  Truck,
  Percent,
  DollarSign
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { getBillById, finalizeBill } from '../../services/billingService';

const BillDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchBill = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getBillById(id);
      setBill(data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch bill details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBill();
  }, [id]);

  const handleFinalize = async () => {
    if (!window.confirm(`Are you sure you want to finalize Bill "${bill?.billNumber}"? Once finalized, ordinary editing will be locked.`)) {
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      await finalizeBill(id);
      setSuccessMsg('Bill finalized and locked successfully.');
      fetchBill();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to finalize bill.');
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'FINALIZED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Lock className="w-3.5 h-3.5" />
            FINALIZED & LOCKED
          </span>
        );
      case 'OVERRIDDEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <ShieldAlert className="w-3.5 h-3.5" />
            SUPERVISOR OVERRIDDEN
          </span>
        );
      case 'DRAFT':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            DRAFT (EDITABLE)
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-3 text-sm text-gray-500">Loading bill details...</p>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="p-12 text-center space-y-4">
        <p className="text-gray-500">Bill not found or you do not have permission to view it.</p>
        <Link to="/bills" className="inline-flex items-center gap-2 text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Bills
        </Link>
      </div>
    );
  }

  const subtotal = parseFloat(bill.productSubtotal) || 0;
  const gstPct = parseFloat(bill.gstPercentage) || 0;
  const gstAmt = parseFloat(bill.gstAmount) || 0;
  const transport = parseFloat(bill.transportCost) || 0;
  const finalAmt = parseFloat(bill.finalAmount) || 0;

  const canOverride = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            to="/bills"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{bill.billNumber}</h1>
              {renderStatusBadge(bill.status)}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Created on {new Date(bill.createdAt).toLocaleString()} by {bill.creator?.username || 'User'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Print Button */}
          <Link
            to={`/bills/${bill.id}/print`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4 text-gray-500" />
            Print / PDF
          </Link>

          {/* Edit Draft */}
          {bill.status === 'DRAFT' && (
            <>
              <Link
                to={`/bills/${bill.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Edit Draft
              </Link>

              <button
                type="button"
                onClick={handleFinalize}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                {actionLoading ? 'Finalizing...' : 'Finalize & Lock'}
              </button>
            </>
          )}

          {/* Authorized Override */}
          {bill.status !== 'DRAFT' && canOverride && (
            <Link
              to={`/bills/${bill.id}/edit?mode=override`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
            >
              <ShieldAlert className="w-4 h-4" />
              Authorized Override
            </Link>
          )}
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-3 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Information */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-blue-600" />
            Customer (Buyer)
          </h2>
          <div>
            <p className="text-base font-bold text-gray-900">{bill.Customer?.name || 'N/A'}</p>
            {bill.Customer?.city && (
              <p className="text-xs text-gray-600 mt-0.5">{bill.Customer.city}</p>
            )}
            {bill.Customer?.address && (
              <p className="text-xs text-gray-500 mt-0.5">{bill.Customer.address}</p>
            )}
            <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
              {bill.Customer?.phone && <div>Phone: {bill.Customer.phone}</div>}
              {bill.Customer?.tin && <div>TIN: {bill.Customer.tin}</div>}
            </div>
          </div>
        </div>

        {/* Organization / Office */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            Issuing Organization
          </h2>
          <div>
            <p className="text-base font-bold text-gray-900">{bill.Organization?.name || 'N/A'}</p>
            {bill.Organization?.address && (
              <p className="text-xs text-gray-600 mt-0.5">{bill.Organization.address}</p>
            )}
            {bill.Organization?.phone && (
              <p className="text-xs text-gray-500 mt-0.5">Phone: {bill.Organization.phone}</p>
            )}
          </div>
        </div>

        {/* Bill Metadata */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-emerald-600" />
            Voucher Details
          </h2>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Bill Date:</span>
              <span className="font-semibold text-gray-900">{bill.billDate}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Estimate Reference:</span>
              {bill.Estimate ? (
                <Link
                  to={`/estimates/${bill.Estimate.id}`}
                  className="font-mono text-indigo-600 hover:underline flex items-center gap-1"
                >
                  <FileText className="w-3 h-3" />
                  {bill.Estimate.estimateNumber}
                </Link>
              ) : (
                <span className="text-gray-400">None</span>
              )}
            </div>
            {bill.finalizedAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Finalized:</span>
                <span className="text-gray-900">
                  {new Date(bill.finalizedAt).toLocaleDateString()} by {bill.finalizer?.username || 'User'}
                </span>
              </div>
            )}
            {bill.lastOverriddenAt && (
              <div className="flex justify-between text-purple-700">
                <span>Overridden:</span>
                <span className="font-medium">
                  {new Date(bill.lastOverriddenAt).toLocaleDateString()} by {bill.overrider?.username || 'Admin'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Line Items */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50">
          <h2 className="text-base font-bold text-gray-900">Bill Line Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4 min-w-[220px]">Description Goods</th>
                <th className="py-3 px-4">Specifications</th>
                <th className="py-3 px-4 text-center">Btls</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4 text-right">Rate (₹)</th>
                <th className="py-3 px-4 text-right font-bold">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {bill.items?.map((item, index) => (
                <tr key={item.id || index} className="hover:bg-gray-50/60">
                  <td className="py-3 px-4 text-gray-400 font-mono">{index + 1}</td>
                  <td className="py-3 px-4 font-semibold text-gray-900">
                    {item.productNameSnapshot}
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {item.productSizeSnapshot && <span className="mr-2">Size: {item.productSizeSnapshot}</span>}
                    {item.productCategorySnapshot && <span className="mr-2">({item.productCategorySnapshot})</span>}
                    {item.productSpecificationsSnapshot && (
                      <span className="text-gray-400 block text-[11px]">{item.productSpecificationsSnapshot}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-gray-700">
                    {item.btls || '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-gray-900">
                    {parseFloat(item.quantity).toFixed(3)}
                  </td>
                  <td className="py-3 px-4 text-gray-600">{item.unit || 'Kg'}</td>
                  <td className="py-3 px-4 text-right font-mono text-gray-800">
                    ₹{parseFloat(item.rate).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                    ₹{parseFloat(item.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Summary Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Notes Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Notes / Special Terms
          </h2>
          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
            {bill.notes || 'No notes specified.'}
          </p>
        </div>

        {/* Totals Breakdown Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-2">
            Financial Summary
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Product Subtotal:</span>
              <span className="font-semibold text-gray-900 font-mono">
                ₹{subtotal.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between text-xs text-gray-700">
              <span className="flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-blue-600" />
                GST ({gstPct}%):
              </span>
              <span className="font-mono text-gray-800 font-medium">
                + ₹{gstAmt.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between text-xs text-gray-700">
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-emerald-600" />
                Transportation Charges:
              </span>
              <span className="font-mono text-gray-800 font-medium">
                + ₹{transport.toFixed(2)}
              </span>
            </div>

            <div className="pt-2 border-t-2 border-gray-900 flex justify-between items-center">
              <span className="font-bold text-gray-900 text-base">Net Final Amount:</span>
              <span className="text-2xl font-black text-blue-700 font-mono">
                ₹{finalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Audit Trail History */}
      {bill.audits && bill.audits.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <History className="w-5 h-5 text-gray-600" />
            <h2 className="text-base font-bold text-gray-900">Audit Trail & Change History</h2>
          </div>

          <div className="space-y-4">
            {bill.audits.map((audit) => {
              let parsedPrev = null;
              let parsedNew = null;
              try {
                if (audit.previousValues) parsedPrev = JSON.parse(audit.previousValues);
                if (audit.newValues) parsedNew = JSON.parse(audit.newValues);
              } catch (e) {
                // Ignore parse errors
              }

              return (
                <div key={audit.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                        audit.action === 'OVERRIDE'
                          ? 'bg-purple-100 text-purple-800'
                          : audit.action === 'FINALIZE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {audit.action}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {audit.performer?.username || 'User'} ({audit.performer?.role || 'N/A'})
                      </span>
                    </div>
                    <span className="text-gray-500">
                      {new Date(audit.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {audit.reason && (
                    <div className="p-2 bg-white rounded border border-gray-200 text-gray-800 font-medium">
                      <span className="text-gray-500 font-semibold mr-1">Reason:</span>
                      {audit.reason}
                    </div>
                  )}

                  {parsedNew && (
                    <div className="text-[11px] text-gray-600 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
                      <div>Subtotal: ₹{parseFloat(parsedNew.productSubtotal || 0).toFixed(2)}</div>
                      <div>GST: ₹{parseFloat(parsedNew.gstAmount || 0).toFixed(2)} ({parsedNew.gstPercentage}%)</div>
                      <div>Transport: ₹{parseFloat(parsedNew.transportCost || 0).toFixed(2)}</div>
                      <div className="font-bold text-gray-900">Final: ₹{parseFloat(parsedNew.finalAmount || 0).toFixed(2)}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default BillDetail;
