import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Send, 
  Plus, 
  Trash2, 
  ShoppingCart, 
  Building2, 
  AlertCircle, 
  CheckCircle,
  ShieldAlert,
  Calendar,
  DollarSign
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { 
  getPurchaseById, 
  createPurchase, 
  updatePurchase, 
  submitPurchase, 
  overridePurchase 
} from '../../services/purchaseService';

const PurchaseForm = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isOverrideMode = searchParams.get('mode') === 'override';
  const isEditMode = Boolean(id);

  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Form State
  const [purchaseNumber, setPurchaseNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [purchaseDetails, setPurchaseDetails] = useState('');
  const [remarks, setRemarks] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [manualAmount, setManualAmount] = useState('');

  // Line items
  const [items, setItems] = useState([
    {
      productId: '',
      productNameSnapshot: '',
      productCategorySnapshot: '',
      productSizeSnapshot: '',
      productSpecificationsSnapshot: '',
      quantity: 1,
      unit: 'Kg',
      rate: '',
      amount: 0
    }
  ]);

  // Master lists
  const [organizations, setOrganizations] = useState([]);
  const [products, setProducts] = useState([]);

  // UI state
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const effectiveOrgId = useMemo(() => {
    if (user?.role === 'SUPER_ADMIN') {
      return selectedOrgId || user?.organizationId || '';
    }
    return user?.organizationId || '';
  }, [user, selectedOrgId]);

  // Load organizations for Super Admin
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      const fetchOrgs = async () => {
        try {
          const res = await api.get('/organizations');
          setOrganizations(res.data || []);
          if (!selectedOrgId && res.data?.length > 0) {
            setSelectedOrgId(res.data[0].id);
          }
        } catch (err) {
          console.error('Failed to load organizations:', err);
        }
      };
      fetchOrgs();
    }
  }, [user, selectedOrgId]);

  // Load Products for current organization
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const params = effectiveOrgId ? `?organizationId=${effectiveOrgId}&status=ACTIVE` : '?status=ACTIVE';
        const res = await api.get(`/products${params}`);
        setProducts(res.data || []);
      } catch (err) {
        console.error('Failed to load products:', err);
      }
    };
    if (effectiveOrgId || user?.role !== 'SUPER_ADMIN') {
      fetchProducts();
    }
  }, [effectiveOrgId, user]);

  // Load existing purchase if edit or override
  useEffect(() => {
    if (!id) return;

    const fetchPurchase = async () => {
      try {
        setLoading(true);
        const data = await getPurchaseById(id);

        if (data.status === 'APPROVED' && !isOverrideMode) {
          setError('This purchase is approved and locked. Switch to Authorized Modification mode to update.');
        }

        setPurchaseNumber(data.purchaseNumber || '');
        setPurchaseDate(data.purchaseDate || new Date().toISOString().split('T')[0]);
        setSelectedOrgId(data.organizationId || '');
        setVendorName(data.vendorName || '');
        setPurchaseDetails(data.purchaseDetails || '');
        setRemarks(data.remarks || '');
        setManualAmount(data.totalAmount ? String(data.totalAmount) : '');

        if (data.items && data.items.length > 0) {
          setItems(data.items.map(i => ({
            id: i.id,
            productId: i.productId || '',
            productNameSnapshot: i.productNameSnapshot || '',
            productCategorySnapshot: i.productCategorySnapshot || '',
            productSizeSnapshot: i.productSizeSnapshot || '',
            productSpecificationsSnapshot: i.productSpecificationsSnapshot || '',
            quantity: parseFloat(i.quantity) || 0,
            unit: i.unit || 'Kg',
            rate: parseFloat(i.rate) || 0,
            amount: parseFloat(i.amount) || 0
          })));
        } else {
          setItems([]);
        }
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || 'Failed to load purchase record.');
      } finally {
        setLoading(false);
      }
    };

    fetchPurchase();
  }, [id, isOverrideMode]);

  // Reactive calculations
  const calculatedTotals = useMemo(() => {
    if (!items || items.length === 0) {
      const parsed = parseFloat(manualAmount) || 0;
      return {
        totalQuantity: 0,
        totalAmount: Math.round((parsed + Number.EPSILON) * 100) / 100
      };
    }

    let qty = 0;
    let amt = 0;

    items.forEach(item => {
      const q = parseFloat(item.quantity) || 0;
      const r = parseFloat(item.rate) || 0;
      const lineAmt = Math.round((q * r + Number.EPSILON) * 100) / 100;
      qty += q;
      amt += lineAmt;
    });

    return {
      totalQuantity: Math.round((qty + Number.EPSILON) * 1000) / 1000,
      totalAmount: Math.round((amt + Number.EPSILON) * 100) / 100
    };
  }, [items, manualAmount]);

  // Handle Item change
  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    if (field === 'productId') {
      const prod = products.find(p => String(p.id) === String(value));
      if (prod) {
        updated[index].productNameSnapshot = prod.name;
        updated[index].productCategorySnapshot = prod.category;
        updated[index].productSizeSnapshot = prod.size;
        updated[index].productSpecificationsSnapshot = prod.specifications;
        updated[index].unit = prod.unit || 'Kg';
      }
    }

    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productId: '',
        productNameSnapshot: '',
        productCategorySnapshot: '',
        productSizeSnapshot: '',
        productSpecificationsSnapshot: '',
        quantity: 1,
        unit: 'Kg',
        rate: '',
        amount: 0
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Submit Handler
  const handleSubmit = async (shouldSubmitForApproval = false) => {
    setError('');
    setSuccessMsg('');

    if (!vendorName || !vendorName.trim()) {
      setError('Please provide a Vendor / Supplier name.');
      return;
    }

    if (items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const itm = items[i];
        if (!itm.productNameSnapshot || !itm.productNameSnapshot.trim()) {
          setError(`Item Row #${i + 1}: Product name / description is required.`);
          return;
        }
        const q = parseFloat(itm.quantity);
        if (isNaN(q) || q <= 0) {
          setError(`Item Row #${i + 1}: Quantity must be greater than 0.`);
          return;
        }
        const r = parseFloat(itm.rate);
        if (isNaN(r) || r < 0) {
          setError(`Item Row #${i + 1}: Rate must be a valid positive number.`);
          return;
        }
      }
    } else {
      const amt = parseFloat(manualAmount);
      if (isNaN(amt) || amt <= 0) {
        setError('Please either add product line items or specify a valid Total Purchase Amount.');
        return;
      }
    }

    if (isOverrideMode && (!overrideReason || !overrideReason.trim())) {
      setError('A mandatory reason is required for an authorized modification of an approved purchase.');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        organizationId: effectiveOrgId,
        vendorName: vendorName.trim(),
        purchaseDate,
        purchaseDetails: purchaseDetails.trim(),
        remarks: remarks.trim(),
        totalAmount: calculatedTotals.totalAmount,
        items: items.map(itm => ({
          productId: itm.productId ? parseInt(itm.productId, 10) : null,
          productNameSnapshot: itm.productNameSnapshot.trim(),
          productCategorySnapshot: itm.productCategorySnapshot || null,
          productSizeSnapshot: itm.productSizeSnapshot || null,
          productSpecificationsSnapshot: itm.productSpecificationsSnapshot || null,
          quantity: parseFloat(itm.quantity),
          unit: itm.unit || 'Kg',
          rate: parseFloat(itm.rate)
        }))
      };

      if (isOverrideMode) {
        payload.reason = overrideReason.trim();
        await overridePurchase(id, payload);
        setSuccessMsg('Purchase modified and logged in audit trail successfully.');
        setTimeout(() => navigate(`/purchases/${id}`), 1200);
      } else if (isEditMode) {
        const updated = await updatePurchase(id, payload);
        if (shouldSubmitForApproval) {
          await submitPurchase(updated.id);
        }
        setSuccessMsg('Purchase record updated successfully.');
        setTimeout(() => navigate(`/purchases/${id}`), 1200);
      } else {
        const created = await createPurchase(payload);
        if (shouldSubmitForApproval) {
          await submitPurchase(created.id);
        }
        setSuccessMsg('Purchase created successfully.');
        setTimeout(() => navigate(`/purchases/${created.id}`), 1200);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save purchase record.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-3 text-sm text-gray-500">Loading purchase data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            to={isEditMode ? `/purchases/${id}` : '/purchases'}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {isOverrideMode
                  ? `Authorized Modification: ${purchaseNumber}`
                  : isEditMode
                  ? `Edit Purchase: ${purchaseNumber}`
                  : 'Create Purchase Record'}
              </h1>
              {isOverrideMode && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                  Override Mode
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {isOverrideMode
                ? 'Supervisor override for approved purchase with permanent audit logging'
                : 'Record vendor purchases, raw material intake, specifications, and negotiated rates'}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <Link
            to={isEditMode ? `/purchases/${id}` : '/purchases'}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>

          {!isOverrideMode && (
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Saving...' : 'Save as Draft'}
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSubmit(!isOverrideMode)}
            disabled={submitting}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm disabled:opacity-50 ${
              isOverrideMode
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isOverrideMode ? (
              <>
                <ShieldAlert className="w-4 h-4" />
                {submitting ? 'Saving Override...' : 'Save Authorized Override'}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : 'Save & Submit for Approval'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-3 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Override Reason Box */}
      {isOverrideMode && (
        <div className="bg-purple-50 p-5 rounded-xl border border-purple-200 space-y-3">
          <div className="flex items-center gap-2 text-purple-900 font-semibold text-sm">
            <ShieldAlert className="w-4 h-4 text-purple-600" />
            Mandatory Reason for Modifying Approved Purchase
          </div>
          <p className="text-xs text-purple-700">
            Approved purchases require executive authorization. Your username, timestamp, and a snapshot of changed values will be recorded in the audit trail.
          </p>
          <textarea
            rows="2"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="e.g. Corrected supplier invoice amount after freight reconciliation..."
            className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>
      )}

      {/* Section 1: Purchase Metadata */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-blue-600" />
          Vendor & Purchase Details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Organization */}
          {user?.role === 'SUPER_ADMIN' ? (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Organization / Office <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                disabled={isEditMode}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Organization
              </label>
              <input
                type="text"
                disabled
                value={user?.organization?.name || 'Assigned Office'}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600"
              />
            </div>
          )}

          {/* Purchase Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Purchase Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Vendor / Supplier Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Supplier / Vendor Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="e.g. Tata Steel BSL Ltd"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Purchase Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Purchase Details / Description
          </label>
          <textarea
            rows="2"
            value={purchaseDetails}
            onChange={(e) => setPurchaseDetails(e.target.value)}
            placeholder="e.g. Procurement of 12mm TMT rebars for warehouse restocking, Invoice #TS-4091"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Section 2: Products Table */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Purchase Line Items</h2>
            <p className="text-xs text-gray-500">
              Select products from catalogue or specify custom goods, quantities, and agreed purchase rates.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>

        {items.length === 0 ? (
          <div className="p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center space-y-3">
            <p className="text-xs text-gray-500">No individual line items added.</p>
            <div className="flex justify-center items-center gap-3">
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium"
              >
                + Add Line Items
              </button>
              <span className="text-xs text-gray-400">or enter total amount directly:</span>
              <div className="w-36">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="Total ₹ Amount"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono font-medium focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                  <th className="py-2.5 px-3 w-10">#</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Catalogue Product</th>
                  <th className="py-2.5 px-3 min-w-[220px]">Item Description *</th>
                  <th className="py-2.5 px-3 w-28">Quantity *</th>
                  <th className="py-2.5 px-3 w-20">Unit</th>
                  <th className="py-2.5 px-3 w-32 text-right">Purchase Rate (₹) *</th>
                  <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => {
                  const lineAmt = Math.round(((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0) + Number.EPSILON) * 100) / 100;

                  return (
                    <tr key={index} className="hover:bg-gray-50/50">
                      <td className="py-2 px-3 text-gray-400 font-mono">{index + 1}</td>
                      <td className="py-2 px-3">
                        <select
                          value={item.productId || ''}
                          onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">-- Choose Product --</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} [{p.category}] ({p.size || 'N/A'})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.productNameSnapshot}
                          onChange={(e) => handleItemChange(index, 'productNameSnapshot', e.target.value)}
                          placeholder="e.g. Iron Pipe 20mm"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                          required
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                          required
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs text-right focus:ring-1 focus:ring-blue-500 font-mono font-medium"
                          required
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900">
                        ₹{lineAmt.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Remarks and Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Remarks */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-3">
          <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
            Remarks & Approver Notes
          </h2>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Internal Remarks
            </label>
            <textarea
              rows="3"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Weighbridge gross verified, supplier invoice attached..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Totals Summary */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
            Purchase Summary
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Quantity:</span>
              <span className="font-semibold text-gray-900 font-mono">
                {calculatedTotals.totalQuantity.toFixed(3)} Units
              </span>
            </div>

            <div className="pt-3 border-t-2 border-gray-900 flex justify-between items-center">
              <div>
                <span className="text-base font-bold text-gray-900 block">Total Purchase Amount</span>
                <span className="text-[11px] text-gray-500">Agreed Procurement Value</span>
              </div>
              <span className="text-2xl font-black text-blue-700 font-mono">
                ₹{calculatedTotals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseForm;
