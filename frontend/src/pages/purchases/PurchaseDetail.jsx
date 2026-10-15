import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit3, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Send, 
  ShieldAlert, 
  Building2, 
  User, 
  ShoppingCart, 
  AlertCircle, 
  History,
  UserCheck,
  DollarSign,
  Package
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { 
  getPurchaseById, 
  submitPurchase, 
  approvePurchase, 
  rejectPurchase 
} from '../../services/purchaseService';

const PurchaseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Reject Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

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

  // Submit for approval
  const handleSubmit = async () => {
    if (!window.confirm(`Submit Purchase "${purchase?.purchaseNumber}" for review and approval?`)) {
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      await submitPurchase(id);
      setSuccessMsg('Purchase submitted for review and approval.');
      fetchPurchase();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit purchase.');
    } finally {
      setActionLoading(false);
    }
  };

  // Approve
  const handleApprove = async () => {
    if (!window.confirm(`Approve Purchase "${purchase?.purchaseNumber}"? Once approved, changes will be restricted.`)) {
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      await approvePurchase(id);
      setSuccessMsg('Purchase approved successfully.');
      fetchPurchase();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve purchase.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject
  const handleRejectConfirm = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejecting the purchase.');
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      await rejectPurchase(id, rejectReason.trim());
      setShowRejectModal(false);
      setRejectReason('');
      setSuccessMsg('Purchase submission rejected.');
      fetchPurchase();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject purchase.');
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            APPROVED
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <UserCheck className="w-3.5 h-3.5" />
            PENDING REVIEW
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            REJECTED
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
        <p className="mt-3 text-sm text-gray-500">Loading purchase record...</p>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="p-12 text-center space-y-4">
        <p className="text-gray-500">Purchase record not found or access denied.</p>
        <Link to="/purchases" className="inline-flex items-center gap-2 text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Purchases
        </Link>
      </div>
    );
  }

  const canApprove = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);
  const totalAmt = parseFloat(purchase.totalAmount) || 0;
  const totalQty = parseFloat(purchase.totalQuantity) || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
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
              <h1 className="text-2xl font-bold text-gray-900">{purchase.purchaseNumber}</h1>
              {renderStatusBadge(purchase.status)}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Created on {new Date(purchase.createdAt).toLocaleString()} by {purchase.creator?.username || 'User'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Edit (Draft or Pending) */}
          {['DRAFT', 'REJECTED', 'PENDING_APPROVAL'].includes(purchase.status) && (
            <Link
              to={`/purchases/${purchase.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </Link>
          )}

          {/* Submit for Approval (Draft) */}
          {['DRAFT', 'REJECTED'].includes(purchase.status) && (
            <button
              onClick={handleSubmit}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Submit for Approval
            </button>
          )}

          {/* Executive Approval & Rejection (Pending) */}
          {purchase.status === 'PENDING_APPROVAL' && canApprove && (
            <>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>

              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Approve Purchase
              </button>
            </>
          )}

          {/* Authorized Override (Approved & Admin) */}
          {purchase.status === 'APPROVED' && canApprove && (
            <Link
              to={`/purchases/${purchase.id}/edit?mode=override`}
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

      {/* Rejection Alert Banner */}
      {purchase.status === 'REJECTED' && purchase.rejectionReason && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl space-y-1 text-sm">
          <div className="font-bold flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600" />
            Submission Rejected by Approver
          </div>
          <p className="text-xs text-rose-800 pl-6">
            <span className="font-semibold">Reason:</span> {purchase.rejectionReason}
          </p>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Vendor & Details */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
            Supplier & Details
          </h2>
          <div>
            <p className="text-base font-bold text-gray-900">{purchase.vendorName || 'N/A'}</p>
            {purchase.purchaseDetails && (
              <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{purchase.purchaseDetails}</p>
            )}
          </div>
        </div>

        {/* Organization */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            Purchasing Office
          </h2>
          <div>
            <p className="text-base font-bold text-gray-900">{purchase.Organization?.name || 'N/A'}</p>
            {purchase.Organization?.address && (
              <p className="text-xs text-gray-600 mt-0.5">{purchase.Organization.address}</p>
            )}
          </div>
        </div>

        {/* Workflow & Approvals */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            Workflow Status
          </h2>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Purchase Date:</span>
              <span className="font-semibold text-gray-900">{purchase.purchaseDate}</span>
            </div>
            {purchase.submittedAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Submitted:</span>
                <span className="text-gray-800">
                  {new Date(purchase.submittedAt).toLocaleDateString()} by {purchase.submitter?.username || 'User'}
                </span>
              </div>
            )}
            {purchase.approvedAt && (
              <div className="flex justify-between text-emerald-700">
                <span className="font-medium">Approved:</span>
                <span className="font-semibold">
                  {new Date(purchase.approvedAt).toLocaleDateString()} by {purchase.approver?.username || 'Admin'}
                </span>
              </div>
            )}
            {purchase.lastOverriddenAt && (
              <div className="flex justify-between text-purple-700">
                <span className="font-medium">Overridden:</span>
                <span className="font-semibold">
                  {new Date(purchase.lastOverriddenAt).toLocaleDateString()} by {purchase.overrider?.username || 'Admin'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Items Table */}
      {purchase.items && purchase.items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/50">
            <h2 className="text-base font-bold text-gray-900">Purchase Line Items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                  <th className="py-3 px-4 w-12">#</th>
                  <th className="py-3 px-4 min-w-[220px]">Product / Description</th>
                  <th className="py-3 px-4">Specifications</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4 text-right">Purchase Rate (₹)</th>
                  <th className="py-3 px-4 text-right font-bold">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchase.items.map((item, index) => (
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
      )}

      {/* Totals & Remarks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Remarks & Delivery Notes
          </h2>
          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
            {purchase.remarks || 'No remarks specified.'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-2">
            Purchase Value
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Quantity:</span>
              <span className="font-semibold text-gray-900 font-mono">
                {totalQty.toFixed(3)} Units
              </span>
            </div>

            <div className="pt-2 border-t-2 border-gray-900 flex justify-between items-center">
              <span className="font-bold text-gray-900 text-base">Total Amount:</span>
              <span className="text-2xl font-black text-blue-700 font-mono">
                ₹{totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit History Timeline */}
      {purchase.audits && purchase.audits.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <History className="w-5 h-5 text-gray-600" />
            <h2 className="text-base font-bold text-gray-900">Audit Trail & Workflow History</h2>
          </div>

          <div className="space-y-3">
            {purchase.audits.map((audit) => {
              let parsedNew = null;
              try {
                if (audit.newValues) parsedNew = JSON.parse(audit.newValues);
              } catch (e) {
                // ignore
              }

              return (
                <div key={audit.id} className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                        audit.action === 'PURCHASE_APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : audit.action === 'PURCHASE_REJECTED'
                          ? 'bg-rose-100 text-rose-800'
                          : audit.action === 'PURCHASE_AUTHORIZED_MODIFICATION'
                          ? 'bg-purple-100 text-purple-800'
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

                  {parsedNew && parsedNew.totalAmount !== undefined && (
                    <div className="text-[11px] text-gray-600 font-mono">
                      Recorded Total: ₹{parseFloat(parsedNew.totalAmount || 0).toFixed(2)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              Reject Purchase Submission
            </h3>
            <p className="text-xs text-gray-600">
              Please provide a clear reason for rejecting this purchase. The submitter will be able to review the reason and resubmit.
            </p>
            <form onSubmit={handleRejectConfirm} className="space-y-4">
              <textarea
                rows="3"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Rate exceeds authorized procurement budget, missing vendor invoice copy..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500"
                required
              />
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 shadow-sm disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseDetail;
