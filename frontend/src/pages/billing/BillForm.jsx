import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Lock, 
  Plus, 
  Trash2, 
  Receipt, 
  FileText, 
  Building2, 
  User, 
  AlertCircle, 
  CheckCircle,
  HelpCircle,
  ShieldAlert,
  Percent,
  Truck,
  DollarSign
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { 
  getBillById, 
  createBill, 
  updateBill, 
  finalizeBill, 
  overrideBill 
} from '../../services/billingService';

const BillForm = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isOverrideMode = searchParams.get('mode') === 'override';
  const isEditMode = Boolean(id);

  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Core Form State
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedEstimateId, setSelectedEstimateId] = useState('');
  const [notes, setNotes] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  // Financial fields
  const [gstPercentage, setGstPercentage] = useState(18); // Default 18% standard GST
  const [transportCost, setTransportCost] = useState(0);

  // Line items state
  const [items, setItems] = useState([
    {
      productId: '',
      productNameSnapshot: '',
      productCategorySnapshot: '',
      productSizeSnapshot: '',
      productSpecificationsSnapshot: '',
      btls: '',
      quantity: 1,
      unit: 'Kg',
      rate: '',
      amount: 0
    }
  ]);

  // Master Lists
  const [organizations, setOrganizations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerEstimates, setCustomerEstimates] = useState([]);

  // UI state
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Super Admin: determine active organization
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

  // Load Customers for current organization
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const params = effectiveOrgId ? `?organizationId=${effectiveOrgId}` : '';
        const res = await api.get(`/customers${params}`);
        setCustomers(res.data || []);
      } catch (err) {
        console.error('Failed to load customers:', err);
      }
    };
    if (effectiveOrgId || user?.role !== 'SUPER_ADMIN') {
      fetchCustomers();
    }
  }, [effectiveOrgId, user]);

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
    fetchProducts();
  }, [effectiveOrgId]);

  // Load Estimates for selected customer
  useEffect(() => {
    const fetchEstimatesForCustomer = async () => {
      if (!selectedCustomerId) {
        setCustomerEstimates([]);
        return;
      }
      try {
        const res = await api.get(`/estimates?customerId=${selectedCustomerId}`);
        setCustomerEstimates(res.data || []);
      } catch (err) {
        console.error('Failed to load estimates for customer:', err);
        setCustomerEstimates([]);
      }
    };
    fetchEstimatesForCustomer();
  }, [selectedCustomerId]);

  // Load existing Bill if editing or overriding
  useEffect(() => {
    if (!id) return;

    const fetchBill = async () => {
      try {
        setLoading(true);
        const bill = await getBillById(id);

        if (bill.status === 'FINALIZED' && !isOverrideMode) {
          setError('This bill is Finalized and locked. Switch to Authorized Override mode to make changes.');
        }

        setBillNumber(bill.billNumber || '');
        setBillDate(bill.billDate || new Date().toISOString().split('T')[0]);
        setSelectedOrgId(bill.organizationId || '');
        setSelectedCustomerId(bill.customerId || '');
        setSelectedEstimateId(bill.estimateId || '');
        setNotes(bill.notes || '');
        setGstPercentage(parseFloat(bill.gstPercentage) || 0);
        setTransportCost(parseFloat(bill.transportCost) || 0);

        if (bill.items && bill.items.length > 0) {
          setItems(bill.items.map(i => ({
            id: i.id,
            productId: i.productId || '',
            productNameSnapshot: i.productNameSnapshot || '',
            productCategorySnapshot: i.productCategorySnapshot || '',
            productSizeSnapshot: i.productSizeSnapshot || '',
            productSpecificationsSnapshot: i.productSpecificationsSnapshot || '',
            btls: i.btls || '',
            quantity: parseFloat(i.quantity) || 0,
            unit: i.unit || 'Kg',
            rate: parseFloat(i.rate) || 0,
            amount: parseFloat(i.amount) || 0
          })));
        }
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || 'Failed to load bill.');
      } finally {
        setLoading(false);
      }
    };

    fetchBill();
  }, [id, isOverrideMode]);

  // Selected Customer details
  const selectedCustomer = useMemo(() => {
    return customers.find(c => String(c.id) === String(selectedCustomerId));
  }, [customers, selectedCustomerId]);

  // Reactive Calculations
  const calculatedTotals = useMemo(() => {
    let subtotal = 0;
    let totalQty = 0;

    const calculatedItems = items.map(item => {
      const q = parseFloat(item.quantity) || 0;
      const r = parseFloat(item.rate) || 0;
      const amt = Math.round((q * r + Number.EPSILON) * 100) / 100;
      subtotal += amt;
      totalQty += q;
      return { ...item, amount: amt };
    });

    const parsedGstPct = parseFloat(gstPercentage) || 0;
    const safeGstPct = Math.min(Math.max(parsedGstPct, 0), 100);

    const parsedTransport = parseFloat(transportCost) || 0;
    const safeTransport = Math.max(parsedTransport, 0);

    const roundedSubtotal = Math.round((subtotal + Number.EPSILON) * 100) / 100;
    const calculatedGstAmt = Math.round(((roundedSubtotal * safeGstPct) / 100 + Number.EPSILON) * 100) / 100;
    const finalAmt = Math.round((roundedSubtotal + calculatedGstAmt + safeTransport + Number.EPSILON) * 100) / 100;

    return {
      items: calculatedItems,
      totalQuantity: totalQty,
      productSubtotal: roundedSubtotal,
      gstPercentage: safeGstPct,
      gstAmount: calculatedGstAmt,
      transportCost: safeTransport,
      finalAmount: finalAmt
    };
  }, [items, gstPercentage, transportCost]);

  // Handle line item change
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
        // Note: rate is deliberately left unchanged / empty because Product Master has no selling price!
      }
    }

    setItems(updated);
  };

  // Add line item
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productId: '',
        productNameSnapshot: '',
        productCategorySnapshot: '',
        productSizeSnapshot: '',
        productSpecificationsSnapshot: '',
        btls: '',
        quantity: 1,
        unit: 'Kg',
        rate: '',
        amount: 0
      }
    ]);
  };

  // Remove line item
  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      alert('A bill must contain at least one line item.');
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Import products from selected estimate
  const handleImportEstimate = () => {
    if (!selectedEstimateId) {
      alert('Please select an estimate first.');
      return;
    }

    const est = customerEstimates.find(e => String(e.id) === String(selectedEstimateId));
    if (!est || !est.items || est.items.length === 0) {
      alert('The selected estimate has no line items to import.');
      return;
    }

    const confirmed = window.confirm(
      `Import ${est.items.length} line item(s) from Estimate ${est.estimateNumber}? This will replace current items in this bill.`
    );
    if (!confirmed) return;

    const importedItems = est.items.map(i => ({
      productId: i.productId || '',
      productNameSnapshot: i.productNameSnapshot || '',
      productCategorySnapshot: i.productCategorySnapshot || '',
      productSizeSnapshot: i.productSizeSnapshot || '',
      productSpecificationsSnapshot: i.productSpecificationsSnapshot || '',
      btls: i.btls || '',
      quantity: parseFloat(i.quantity) || 0,
      unit: i.unit || 'Kg',
      rate: parseFloat(i.negotiatedRate) || 0,
      amount: parseFloat(i.amount) || 0
    }));

    setItems(importedItems);
    setSuccessMsg(`Imported ${importedItems.length} items from Estimate ${est.estimateNumber}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Form submission handler
  const handleSubmit = async (shouldFinalize = false) => {
    setError('');
    setSuccessMsg('');

    // Validations
    if (!selectedCustomerId) {
      setError('Please select a customer.');
      return;
    }

    if (!items || items.length === 0) {
      setError('Please add at least one line item.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const itm = items[i];
      if (!itm.productNameSnapshot || !itm.productNameSnapshot.trim()) {
        setError(`Row #${i + 1}: Description Goods (product name) is required.`);
        return;
      }
      const q = parseFloat(itm.quantity);
      if (isNaN(q) || q <= 0) {
        setError(`Row #${i + 1}: Quantity must be greater than 0.`);
        return;
      }
      const r = parseFloat(itm.rate);
      if (isNaN(r) || r < 0) {
        setError(`Row #${i + 1}: Rate must be a valid positive number.`);
        return;
      }
    }

    if (isOverrideMode && (!overrideReason || !overrideReason.trim())) {
      setError('A mandatory reason is required to perform an authorized override.');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        organizationId: effectiveOrgId,
        customerId: parseInt(selectedCustomerId, 10),
        estimateId: selectedEstimateId ? parseInt(selectedEstimateId, 10) : null,
        billDate,
        gstPercentage: calculatedTotals.gstPercentage,
        transportCost: calculatedTotals.transportCost,
        notes,
        items: items.map(itm => ({
          productId: itm.productId ? parseInt(itm.productId, 10) : null,
          productNameSnapshot: itm.productNameSnapshot.trim(),
          productCategorySnapshot: itm.productCategorySnapshot || null,
          productSizeSnapshot: itm.productSizeSnapshot || null,
          productSpecificationsSnapshot: itm.productSpecificationsSnapshot || null,
          btls: itm.btls ? String(itm.btls).trim() : null,
          quantity: parseFloat(itm.quantity),
          unit: itm.unit || 'Kg',
          rate: parseFloat(itm.rate)
        }))
      };

      if (isOverrideMode) {
        payload.reason = overrideReason.trim();
        await overrideBill(id, payload);
        setSuccessMsg('Bill overridden and updated successfully.');
        setTimeout(() => navigate(`/bills/${id}`), 1200);
      } else if (isEditMode) {
        const updated = await updateBill(id, payload);
        if (shouldFinalize) {
          await finalizeBill(updated.id);
        }
        setSuccessMsg('Bill updated successfully.');
        setTimeout(() => navigate(`/bills/${id}`), 1200);
      } else {
        const created = await createBill(payload);
        if (shouldFinalize) {
          await finalizeBill(created.id);
        }
        setSuccessMsg('Bill created successfully.');
        setTimeout(() => navigate(`/bills/${created.id}`), 1200);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save bill.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-3 text-sm text-gray-500">Loading bill data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            to={isEditMode ? `/bills/${id}` : '/bills'}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {isOverrideMode
                  ? `Authorized Override: ${billNumber}`
                  : isEditMode
                  ? `Edit Draft: ${billNumber}`
                  : 'Create Sales Bill / Voucher'}
              </h1>
              {isOverrideMode && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                  Override Mode
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {isOverrideMode
                ? 'Supervisor override for finalized bill with mandatory audit trail'
                : 'Enter customer, optional estimate reference, line items, GST rate, and transport charges'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Link
            to={isEditMode ? `/bills/${id}` : '/bills'}
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
                {submitting ? 'Overriding...' : 'Save Authorized Override'}
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                {submitting ? 'Finalizing...' : 'Save & Finalize Bill'}
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
            Mandatory Audit Reason for Authorized Override
          </div>
          <p className="text-xs text-purple-700">
            Please document why this finalized bill is being modified. Your username, timestamp, and a before/after snapshot of the financial data will be permanently logged.
          </p>
          <textarea
            rows="2"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="e.g. Corrected negotiated rate after customer agreement, adjusted transportation charges..."
            className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>
      )}

      {/* Section 1: Header / Details */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-blue-600" />
          Bill & Customer Details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Organization (Super Admin only) */}
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

          {/* Bill Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Bill Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Customer <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => {
                setSelectedCustomerId(e.target.value);
                setSelectedEstimateId(''); // Reset estimate on customer change
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Select Customer --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.city ? `(${c.city})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Customer Info Card if Selected */}
        {selectedCustomer && (
          <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-lg text-xs text-blue-900 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <span className="font-semibold text-blue-950">Customer:</span> {selectedCustomer.name}
            </div>
            <div>
              <span className="font-semibold text-blue-950">City/Address:</span> {selectedCustomer.city || selectedCustomer.address || 'N/A'}
            </div>
            <div>
              <span className="font-semibold text-blue-950">Phone / TIN:</span> {selectedCustomer.phone || 'N/A'} {selectedCustomer.tin ? `| TIN: ${selectedCustomer.tin}` : ''}
            </div>
          </div>
        )}

        {/* Optional Estimate Reference */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 max-w-md">
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                Reference Existing Estimate (Optional)
              </label>
              <select
                value={selectedEstimateId}
                onChange={(e) => setSelectedEstimateId(e.target.value)}
                disabled={!selectedCustomerId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
              >
                <option value="">-- No Estimate Reference --</option>
                {customerEstimates.map(est => (
                  <option key={est.id} value={est.id}>
                    {est.estimateNumber} ({est.estimateDate}) - ₹{parseFloat(est.grandTotal || est.total || 0).toFixed(2)} [{est.status}]
                  </option>
                ))}
              </select>
            </div>

            {selectedEstimateId && (
              <button
                type="button"
                onClick={handleImportEstimate}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium self-end transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Import Line Items from Estimate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Product Line Items Table */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Product Line Items</h2>
            <p className="text-xs text-gray-500">
              Select products from catalogue and enter negotiated rates. (Product catalogue does not store prices).
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                <th className="py-2.5 px-3 w-10">#</th>
                <th className="py-2.5 px-3 min-w-[200px]">Product Selection</th>
                <th className="py-2.5 px-3 min-w-[220px]">Description Goods *</th>
                <th className="py-2.5 px-3 w-24">Btls</th>
                <th className="py-2.5 px-3 w-28">Quantity *</th>
                <th className="py-2.5 px-3 w-20">Unit</th>
                <th className="py-2.5 px-3 w-32 text-right">Negotiated Rate (₹) *</th>
                <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                <th className="py-2.5 px-3 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item, index) => {
                const lineAmt = Math.round(((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0) + Number.EPSILON) * 100) / 100;

                return (
                  <tr key={index} className="hover:bg-gray-50/50">
                    {/* Index */}
                    <td className="py-2 px-3 text-gray-400 font-mono">
                      {index + 1}
                    </td>

                    {/* Catalogue Product Select */}
                    <td className="py-2 px-3">
                      <select
                        value={item.productId || ''}
                        onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-- Choose Catalogue Product --</option>
                        <option value="">✏️ Custom / Manual Item (Not in Catalogue)</option>
                        {products.length > 0 && (
                          <optgroup label={`Catalogue Products (${products.length})`}>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} [{p.category}] ({p.size || 'N/A'})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </td>

                    {/* Description Goods */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={item.productNameSnapshot}
                        onChange={(e) => handleItemChange(index, 'productNameSnapshot', e.target.value)}
                        placeholder="e.g. Iron Pipe 20mm"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </td>

                    {/* Btls (Bundles) */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={item.btls || ''}
                        onChange={(e) => handleItemChange(index, 'btls', e.target.value)}
                        placeholder="e.g. 10"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* Quantity */}
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </td>

                    {/* Unit */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* Negotiated Rate */}
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.rate}
                        onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-medium"
                        required
                      />
                    </td>

                    {/* Line Amount */}
                    <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900">
                      ₹{lineAmt.toFixed(2)}
                    </td>

                    {/* Delete Action */}
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title="Remove row"
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
      </div>

      {/* Section 3: Financial Summary & Taxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Notes & Tax Information */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
            Notes & Terms
          </h2>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Internal Notes / Terms of Sale
            </label>
            <textarea
              rows="4"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Payment terms within 15 days, weighbridge slip verified..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-950">Client Tax Architecture:</p>
              <p className="mt-0.5 text-amber-800">
                GST percentage is entered manually for each sale voucher and calculated authoritatively by the backend. The taxable base is currently the Product Subtotal.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Authoritative Calculations & Breakdown */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
            Financial Calculation
          </h2>

          <div className="space-y-3 text-sm">
            {/* Subtotal */}
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-600">Product Subtotal:</span>
              <span className="font-semibold text-gray-900 font-mono">
                ₹{calculatedTotals.productSubtotal.toFixed(2)}
              </span>
            </div>

            {/* GST Rate Input */}
            <div className="py-2 border-t border-gray-100 space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-gray-700 font-medium flex items-center gap-1.5 text-xs">
                  <Percent className="w-3.5 h-3.5 text-blue-600" />
                  GST Percentage (%):
                </label>
                <div className="w-32">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={gstPercentage}
                    onChange={(e) => setGstPercentage(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-right text-xs font-mono font-medium focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Quick GST Chips */}
              <div className="flex justify-end gap-1.5 pt-1">
                {[0, 5, 12, 18, 28].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setGstPercentage(pct)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      parseFloat(gstPercentage) === pct
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              <div className="flex justify-between items-center pt-1 text-xs">
                <span className="text-gray-500">Calculated GST Amount:</span>
                <span className="font-medium text-gray-800 font-mono">
                  + ₹{calculatedTotals.gstAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Transportation Cost Input */}
            <div className="py-2 border-t border-gray-100 flex justify-between items-center">
              <label className="text-gray-700 font-medium flex items-center gap-1.5 text-xs">
                <Truck className="w-3.5 h-3.5 text-emerald-600" />
                Transportation Charges (₹):
              </label>
              <div className="w-32">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={transportCost}
                  onChange={(e) => setTransportCost(e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-right text-xs font-mono font-medium focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Final Bill Amount */}
            <div className="pt-3 border-t-2 border-gray-900 flex justify-between items-center">
              <div>
                <span className="text-base font-bold text-gray-900 block">Final Bill Amount</span>
                <span className="text-[11px] text-gray-500">Net Payable (Subtotal + GST + Transport)</span>
              </div>
              <span className="text-2xl font-black text-blue-700 font-mono">
                ₹{calculatedTotals.finalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillForm;
