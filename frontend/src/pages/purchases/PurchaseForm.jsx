import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
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
  DollarSign, 
  Package, 
  Layers, 
  Ruler, 
  X,
  Sparkles
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

const CATEGORIES = [
  'Reinforcing Steel Bar',
  'Pipe',
  'Other'
];

const STANDARD_UNITS = [
  'Kg',
  'Ton',
  'Piece',
  'Meter',
  'Bundle',
  'Length',
  'Box',
  'Nos'
];

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
      isManual: false,
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
  const [productsLoading, setProductsLoading] = useState(false);

  // Quick Add Product to Catalogue Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [targetRowIndex, setTargetRowIndex] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    category: 'Reinforcing Steel Bar',
    customCategory: '',
    size: '',
    unit: 'Kg',
    description: '',
    organizationId: '',
    steelGrade: '',
    pipePressureRating: '',
    pipeLength: '',
    extraSpecs: ''
  });

  // UI state
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const effectiveOrgId = useMemo(() => {
    if (user?.role === 'SUPER_ADMIN') {
      return selectedOrgId || '';
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
  }, [user]);

  // Load Products for current organization
  const fetchProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      const params = new URLSearchParams();
      params.append('status', 'ACTIVE');
      if (effectiveOrgId) {
        params.append('organizationId', effectiveOrgId);
      }
      const res = await api.get(`/products?${params.toString()}`);
      setProducts(res.data || []);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setProductsLoading(false);
    }
  }, [effectiveOrgId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
            isManual: !i.productId,
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
    setItems(updated);
  };

  // Handle Product Selection on a Row
  const handleProductSelect = (index, value) => {
    if (value === 'CREATE_NEW') {
      setTargetRowIndex(index);
      setNewProductForm({
        name: '',
        category: 'Reinforcing Steel Bar',
        customCategory: '',
        size: '',
        unit: 'Kg',
        description: '',
        organizationId: effectiveOrgId || '',
        steelGrade: '',
        pipePressureRating: '',
        pipeLength: '',
        extraSpecs: ''
      });
      setModalError('');
      setShowProductModal(true);
      return;
    }

    const updated = [...items];
    if (value === 'MANUAL') {
      updated[index].productId = '';
      updated[index].isManual = true;
    } else if (!value) {
      updated[index].productId = '';
      updated[index].isManual = false;
      updated[index].productNameSnapshot = '';
      updated[index].productCategorySnapshot = '';
      updated[index].productSizeSnapshot = '';
      updated[index].productSpecificationsSnapshot = '';
    } else {
      const prod = products.find(p => String(p.id) === String(value));
      if (prod) {
        updated[index].productId = prod.id;
        updated[index].isManual = false;
        updated[index].productNameSnapshot = prod.name;
        updated[index].productCategorySnapshot = prod.category;
        updated[index].productSizeSnapshot = prod.size;
        updated[index].productSpecificationsSnapshot = prod.specifications || '';
        updated[index].unit = prod.unit || 'Kg';
      }
    }
    setItems(updated);
  };

  // Add Item Row
  const handleAddItem = (isManual = false) => {
    setItems([
      ...items,
      {
        productId: '',
        isManual: Boolean(isManual),
        productNameSnapshot: '',
        productCategorySnapshot: isManual ? 'Other' : '',
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

  // Open Add Product to Catalogue Modal
  const handleOpenAddProductModal = (rowIndex = null) => {
    setTargetRowIndex(rowIndex);
    setNewProductForm({
      name: '',
      category: 'Reinforcing Steel Bar',
      customCategory: '',
      size: '',
      unit: 'Kg',
      description: '',
      organizationId: effectiveOrgId || (organizations[0]?.id) || '',
      steelGrade: '',
      pipePressureRating: '',
      pipeLength: '',
      extraSpecs: ''
    });
    setModalError('');
    setShowProductModal(true);
  };

  // Submit New Product to Catalogue (Strictly NO Price Fields)
  const handleCreateProductSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!newProductForm.name || !newProductForm.name.trim()) {
      return setModalError('Product name is required.');
    }

    const actualCategory = newProductForm.category === 'Other'
      ? newProductForm.customCategory?.trim()
      : newProductForm.category;

    if (!actualCategory) {
      return setModalError('Product category is required.');
    }

    if (!newProductForm.size || !newProductForm.size.trim()) {
      return setModalError('Product size / diameter is required (e.g. 10 mm, 2 inch).');
    }

    if (!newProductForm.unit || !newProductForm.unit.trim()) {
      return setModalError('Unit of measurement is required.');
    }

    const targetOrg = newProductForm.organizationId || effectiveOrgId || (organizations.length > 0 ? organizations[0].id : '') || user?.organizationId;
    if (user?.role === 'SUPER_ADMIN' && !targetOrg) {
      return setModalError('Please select an Organization for this product.');
    }

    try {
      setModalLoading(true);

      const specsObj = {};
      if (actualCategory === 'Reinforcing Steel Bar') {
        if (newProductForm.steelGrade.trim()) specsObj.grade = newProductForm.steelGrade.trim();
      } else if (actualCategory === 'Pipe') {
        if (newProductForm.pipePressureRating.trim()) specsObj.pressureRating = newProductForm.pipePressureRating.trim();
        if (newProductForm.pipeLength.trim()) specsObj.length = newProductForm.pipeLength.trim();
      }
      if (newProductForm.extraSpecs.trim()) {
        specsObj.extra = newProductForm.extraSpecs.trim();
      }

      // Payload - strictly NO price fields
      const payload = {
        name: newProductForm.name.trim(),
        category: actualCategory,
        size: newProductForm.size.trim(),
        unit: newProductForm.unit.trim(),
        description: newProductForm.description.trim() || null,
        specifications: Object.keys(specsObj).length > 0 ? specsObj : null,
        status: 'ACTIVE',
        organizationId: targetOrg
      };

      const res = await api.post('/products', payload);
      const createdProd = res.data.product;

      // Add to local catalogue products state
      setProducts(prev => [createdProd, ...prev]);

      // If targeted to a row, auto-select it
      if (targetRowIndex !== null && targetRowIndex >= 0 && targetRowIndex < items.length) {
        const updated = [...items];
        updated[targetRowIndex].productId = createdProd.id;
        updated[targetRowIndex].isManual = false;
        updated[targetRowIndex].productNameSnapshot = createdProd.name;
        updated[targetRowIndex].productCategorySnapshot = createdProd.category;
        updated[targetRowIndex].productSizeSnapshot = createdProd.size;
        updated[targetRowIndex].productSpecificationsSnapshot = createdProd.specifications || '';
        updated[targetRowIndex].unit = createdProd.unit || 'Kg';
        setItems(updated);
      } else {
        // Append a new row with this product
        setItems(prev => [
          ...prev,
          {
            productId: createdProd.id,
            isManual: false,
            productNameSnapshot: createdProd.name,
            productCategorySnapshot: createdProd.category,
            productSizeSnapshot: createdProd.size,
            productSpecificationsSnapshot: createdProd.specifications || '',
            quantity: 1,
            unit: createdProd.unit || 'Kg',
            rate: '',
            amount: 0
          }
        ]);
      }

      setSuccessMsg(`Product "${createdProd.name}" added to catalogue successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setShowProductModal(false);
      setTargetRowIndex(null);
    } catch (err) {
      console.error(err);
      setModalError(err.response?.data?.error || 'Failed to create product in catalogue.');
    } finally {
      setModalLoading(false);
    }
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
          productId: (itm.productId && itm.productId !== 'MANUAL') ? parseInt(itm.productId, 10) : null,
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-sm text-gray-500">Loading purchase record...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to={isEditMode ? `/purchases/${id}` : '/purchases'}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">
                {isOverrideMode
                  ? 'Authorized Purchase Modification'
                  : isEditMode
                  ? `Edit Purchase (${purchaseNumber || 'Draft'})`
                  : 'Record New Purchase'}
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
                : 'Select products from catalogue, enter manual custom items, or register new catalogue products'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
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
              {submitting ? 'Saving...' : 'Save Draft'}
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
                {submitting ? 'Overriding...' : 'Save Authorized Modification'}
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
            Mandatory Audit Reason for Authorized Modification
          </div>
          <p className="text-xs text-purple-700">
            Please document why this approved purchase is being modified. Your username, timestamp, and financial values will be permanently logged.
          </p>
          <textarea
            rows="2"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="e.g. Rate adjusted as per supplier credit note, quantity corrected after weighbridge reconciliation..."
            className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>
      )}

      {/* Section 1: Header / Details */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-blue-600" />
          Purchase & Vendor Details
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900">Purchase Line Items</h2>
              {productsLoading ? (
                <span className="text-xs text-gray-400 animate-pulse">Loading catalogue...</span>
              ) : (
                <span className="text-xs bg-blue-100 text-blue-800 font-medium px-2 py-0.5 rounded-full">
                  {products.length} in catalogue
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Select products from catalogue, enter manual custom items, or register new catalogue products.
            </p>
          </div>

          {/* Line Item Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleAddItem(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add from Catalogue
            </button>
            <button
              type="button"
              onClick={() => handleAddItem(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Manual Item
            </button>
            <button
              type="button"
              onClick={() => handleOpenAddProductModal(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-medium transition-colors"
            >
              <Package className="w-3.5 h-3.5" />
              + Add to Catalogue
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center space-y-3">
            <p className="text-xs text-gray-500">No individual line items added.</p>
            <div className="flex flex-wrap justify-center items-center gap-3">
              <button
                type="button"
                onClick={() => handleAddItem(false)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
              >
                + Choose from Catalogue
              </button>
              <button
                type="button"
                onClick={() => handleAddItem(true)}
                className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700"
              >
                + Add Manual Product
              </button>
              <span className="text-xs text-gray-400">or enter total purchase amount directly:</span>
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
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 min-w-[220px]">Product Selection</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Item Description *</th>
                  <th className="py-2.5 px-3 w-28">Size / Spec</th>
                  <th className="py-2.5 px-3 w-24">Quantity *</th>
                  <th className="py-2.5 px-3 w-24">Unit</th>
                  <th className="py-2.5 px-3 w-32 text-right">Purchase Rate (₹) *</th>
                  <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-3 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => {
                  const lineAmt = Math.round(((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0) + Number.EPSILON) * 100) / 100;
                  const isCatalogueItem = Boolean(item.productId);

                  return (
                    <tr key={index} className="hover:bg-gray-50/50">
                      <td className="py-2 px-3 text-gray-400 font-mono text-center">{index + 1}</td>
                      
                      {/* Product Selector */}
                      <td className="py-2 px-3">
                        <select
                          value={item.productId || (item.isManual ? 'MANUAL' : '')}
                          onChange={(e) => handleProductSelect(index, e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">-- Choose Catalogue Product --</option>
                          <option value="MANUAL">✏️ Custom / Manual Product (Not in Catalogue)</option>
                          <option value="CREATE_NEW">✨ + Add New Product to Catalogue...</option>
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
                        <div className="mt-1">
                          {isCatalogueItem ? (
                            <span className="inline-flex items-center text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              ✓ In Catalogue: {item.productCategorySnapshot || ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                              ✏️ Manual / Custom Product
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Item Description */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.productNameSnapshot}
                          onChange={(e) => handleItemChange(index, 'productNameSnapshot', e.target.value)}
                          placeholder="e.g. Iron Pipe 20mm or Custom Item"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                          required
                        />
                      </td>

                      {/* Size / Specs */}
                      <td className="py-2 px-3">
                        {isCatalogueItem ? (
                          <div className="text-xs text-gray-700 font-medium py-1 px-1 bg-gray-50 rounded border border-gray-200 truncate" title={item.productSizeSnapshot || ''}>
                            {item.productSizeSnapshot || '-'}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={item.productSizeSnapshot || ''}
                            onChange={(e) => handleItemChange(index, 'productSizeSnapshot', e.target.value)}
                            placeholder="e.g. 10 mm"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                          />
                        )}
                      </td>

                      {/* Quantity */}
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

                      {/* Unit */}
                      <td className="py-2 px-3">
                        <select
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500"
                        >
                          {STANDARD_UNITS.map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </td>

                      {/* Purchase Rate */}
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

                      {/* Amount */}
                      <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900">
                        ₹{lineAmt.toFixed(2)}
                      </td>

                      {/* Actions */}
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

      {/* Quick Add Product to Catalogue Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Add Product to Catalogue</h3>
                  <p className="text-xs text-gray-500">
                    Product Master stores specifications only. Purchase rates belong to the purchase record.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Error */}
            {modalError && (
              <div className="my-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center">
                <AlertCircle size={15} className="mr-2 text-red-500 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleCreateProductSubmit} className="space-y-4 pt-3">
              {/* Organization (Super Admin Only) */}
              {user?.role === 'SUPER_ADMIN' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Organization <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newProductForm.organizationId}
                    onChange={(e) => setNewProductForm({ ...newProductForm, organizationId: e.target.value })}
                    className="block w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Organization</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newProductForm.name}
                  onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                  placeholder="e.g. TMT Reinforcing Bar, MS Seamless Pipe"
                  className="block w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Category & Custom Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newProductForm.category}
                    onChange={(e) => setNewProductForm({ ...newProductForm, category: e.target.value })}
                    className="block w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {newProductForm.category === 'Other' ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Specify Category <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newProductForm.customCategory}
                      onChange={(e) => setNewProductForm({ ...newProductForm, customCategory: e.target.value })}
                      placeholder="e.g. Iron Angle, Plate"
                      className="block w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Unit of Measurement <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newProductForm.unit}
                      onChange={(e) => setNewProductForm({ ...newProductForm, unit: e.target.value })}
                      className="block w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {STANDARD_UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Size & Unit (if Other) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Size / Diameter <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newProductForm.size}
                    onChange={(e) => setNewProductForm({ ...newProductForm, size: e.target.value })}
                    placeholder="e.g. 10 mm, 2 inch"
                    className="block w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {newProductForm.category === 'Other' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Unit of Measurement <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newProductForm.unit}
                      onChange={(e) => setNewProductForm({ ...newProductForm, unit: e.target.value })}
                      className="block w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {STANDARD_UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Category-specific specifications */}
              {newProductForm.category === 'Reinforcing Steel Bar' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Steel Grade (Optional)
                  </label>
                  <input
                    type="text"
                    value={newProductForm.steelGrade}
                    onChange={(e) => setNewProductForm({ ...newProductForm, steelGrade: e.target.value })}
                    placeholder="e.g. Fe 500D, Fe 550"
                    className="block w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {newProductForm.category === 'Pipe' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Pressure Rating (Optional)
                    </label>
                    <input
                      type="text"
                      value={newProductForm.pipePressureRating}
                      onChange={(e) => setNewProductForm({ ...newProductForm, pipePressureRating: e.target.value })}
                      placeholder="e.g. Schedule 40, Class C"
                      className="block w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Standard Length (Optional)
                    </label>
                    <input
                      type="text"
                      value={newProductForm.pipeLength}
                      onChange={(e) => setNewProductForm({ ...newProductForm, pipeLength: e.target.value })}
                      placeholder="e.g. 6 Meters"
                      className="block w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Product Description / Notes (Optional)
                </label>
                <textarea
                  rows="2"
                  value={newProductForm.description}
                  onChange={(e) => setNewProductForm({ ...newProductForm, description: e.target.value })}
                  placeholder="Manufacturing standards, specifications..."
                  className="block w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 flex justify-end space-x-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {modalLoading ? 'Saving...' : 'Save Product to Catalogue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseForm;
