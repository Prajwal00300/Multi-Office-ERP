import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  ShoppingCart, 
  Building2, 
  AlertCircle, 
  CheckCircle, 
  Calendar, 
  Package,
  Layers,
  Sparkles,
  Inbox
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { 
  getPurchaseById, 
  createPurchase, 
  updatePurchase, 
  getNextPurchaseNumber 
} from '../../services/purchaseService';

const PurchaseForm = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditMode = Boolean(id);

  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Order-level fields
  const [purchaseNumber, setPurchaseNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [partyName, setPartyName] = useState('');
  const [remarks, setRemarks] = useState('');

  // Product-level lines
  const [items, setItems] = useState([
    {
      productId: '',
      productName: '',
      quantity: '',
      carbonType: 'Low Carbon',
      unit: 'Ton',
      rate: ''
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
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') {
      return selectedOrgId || user?.organizationId || '';
    }
    return user?.organizationId || '';
  }, [user, selectedOrgId]);

  // 1. Load organizations for Super Admin or CEO
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        if (user?.role === 'SUPER_ADMIN') {
          const res = await api.get('/organizations');
          setOrganizations(res.data || []);
          if (!selectedOrgId && res.data?.length > 0) {
            setSelectedOrgId(res.data[0].id);
          }
        } else if (user?.role === 'CEO') {
          const res = await api.get('/ceo/offices');
          setOrganizations(res.data || []);
          if (!selectedOrgId && res.data?.length > 0) {
            setSelectedOrgId(res.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load organizations:', err);
      }
    };
    if (user) {
      fetchOrgs();
    }
  }, [user]);

  // 2. Fetch Next Order ID preview if creating new
  useEffect(() => {
    if (isEditMode) return;
    const fetchNextNumber = async () => {
      try {
        const data = await getNextPurchaseNumber();
        if (data?.nextPurchaseNumber && !purchaseNumber) {
          setPurchaseNumber(data.nextPurchaseNumber);
        }
      } catch (err) {
        console.error('Failed to fetch next purchase number:', err);
      }
    };
    fetchNextNumber();
  }, [isEditMode]);

  // 3. Load Products for effective office
  useEffect(() => {
    const loadMasters = async () => {
      try {
        const params = effectiveOrgId ? { organizationId: effectiveOrgId } : {};
        const prodRes = await api.get('/products', { params });
        setProducts(prodRes.data || []);
      } catch (err) {
        console.error('Failed to load products:', err);
      }
    };

    if (effectiveOrgId || user?.role !== 'SUPER_ADMIN') {
      loadMasters();
    }
  }, [effectiveOrgId, user]);

  // 4. Load existing purchase if edit mode
  useEffect(() => {
    if (!id) return;

    const fetchPurchase = async () => {
      try {
        setLoading(true);
        const data = await getPurchaseById(id);

        setPurchaseNumber(data.purchaseNumber || '');
        setPurchaseDate(data.purchaseDate || new Date().toISOString().split('T')[0]);
        setSelectedOrgId(data.organizationId || '');
        setPartyName(data.vendorName || '');
        setRemarks(data.remarks || '');

        if (data.items && data.items.length > 0) {
          setItems(data.items.map(i => ({
            id: i.id,
            productId: i.productId ? String(i.productId) : '',
            productName: i.productNameSnapshot || '',
            quantity: i.quantity ? String(i.quantity) : '',
            carbonType: i.carbonType || 'Low Carbon',
            unit: i.unit || 'Ton',
            rate: i.rate ? String(i.rate) : ''
          })));
        }
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || 'Failed to load purchase record.');
      } finally {
        setLoading(false);
      }
    };

    fetchPurchase();
  }, [id]);

  // Line item change handlers
  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    // If selecting a product from dropdown, auto-fill product details
    if (field === 'productId') {
      const selected = products.find(p => String(p.id) === String(value));
      if (selected) {
        updated[index].productName = selected.name;
        updated[index].unit = selected.unit || 'Ton';
      }
    }

    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productId: '',
        productName: '',
        quantity: '',
        carbonType: 'Low Carbon',
        unit: 'Ton',
        rate: ''
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      setError('At least one product line is required.');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };


  // Validation
  const validateForm = () => {
    if (!purchaseDate) {
      setError('Date is required.');
      return false;
    }

    if (!partyName || !partyName.trim()) {
      setError('Party Name is required.');
      return false;
    }

    if (!items || items.length === 0) {
      setError('At least one valid product line must exist.');
      return false;
    }

    for (let i = 0; i < items.length; i++) {
      const line = items[i];
      if (!line.productId && !line.productName?.trim()) {
        setError(`Row #${i + 1}: Please select a Product from the Product Master.`);
        return false;
      }

      const q = parseFloat(line.quantity);
      if (isNaN(q) || q <= 0) {
        setError(`Row #${i + 1}: Quantity must be a valid positive number (> 0).`);
        return false;
      }

      if (!['Low Carbon', 'High Carbon'].includes(line.carbonType)) {
        setError(`Row #${i + 1}: Carbon Type must be either "Low Carbon" or "High Carbon".`);
        return false;
      }
    }

    return true;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!validateForm()) return;

    try {
      setSubmitting(true);

      const payload = {
        purchaseNumber: purchaseNumber.trim() || undefined,
        purchaseDate,
        partyName: partyName.trim(),
        vendorName: partyName.trim(),
        organizationId: effectiveOrgId ? parseInt(effectiveOrgId, 10) : undefined,
        remarks: remarks.trim() || undefined,
        items: items.map(line => ({
          productId: line.productId ? parseInt(line.productId, 10) : null,
          productNameSnapshot: line.productName || 'Unspecified Product',
          quantity: parseFloat(line.quantity),
          carbonType: line.carbonType,
          unit: 'Ton',
          rate: parseFloat(line.rate) || 0
        }))
      };

      if (isEditMode) {
        await updatePurchase(id, payload);
        setSuccessMsg('Purchase Order updated successfully.');
        setTimeout(() => navigate(`/purchases/${id}`), 1000);
      } else {
        const res = await createPurchase(payload);
        const createdNumber = res.purchase?.purchaseNumber || purchaseNumber;
        setSuccessMsg(`Purchase Order "${createdNumber}" placed successfully!`);
        setTimeout(() => navigate('/purchases'), 1200);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to place purchase order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
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
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                PART 1: PLACE ORDER
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">
              {isEditMode ? `Edit Purchase Order #${purchaseNumber}` : 'Place Purchase Order'}
            </h1>
            <p className="text-sm text-gray-500">
              Create a purchase order with multiple products and designated carbon types.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/purchases/receive"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Inbox className="w-4 h-4 text-gray-500" />
            Go to Order Received
          </Link>
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ORDER-LEVEL SECTION */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Order Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Order ID */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Order ID <span className="text-gray-400 font-normal">(Auto-generated or custom)</span>
              </label>
              <input
                type="text"
                value={purchaseNumber}
                onChange={(e) => setPurchaseNumber(e.target.value)}
                placeholder="e.g. PO-001 or PUR-YYYYMM-XXXX"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 font-mono"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Unique Order ID generated by the backend or specified.
              </p>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Office Selection (for Super Admin or CEO with multiple offices) */}
            {(user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Office / Branch <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Party Name (Manually entered by the user) */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Party Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                placeholder="Enter party / supplier name"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Enter the supplier or party name for this purchase order.
              </p>
            </div>

            {/* Remarks / Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Remarks / Instructions
              </label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional purchase order terms, delivery specifications, or notes..."
                className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* PRODUCT-LEVEL SECTION (MULTIPLE PRODUCTS) */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Products Ordered
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Add multiple product rows to this single purchase order. All quantities are in Tons.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>

          {/* Product Lines Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/50">
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-3 min-w-[240px]">Product (from Master)</th>
                  <th className="py-3 px-3 w-40">Quantity (Tons)</th>
                  <th className="py-3 px-3 w-48">Carbon Type</th>
                  <th className="py-3 px-3 w-36">Rate (Optional)</th>
                  <th className="py-3 px-3 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((line, index) => (
                  <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                    {/* Index */}
                    <td className="py-3 px-3 text-center text-xs font-semibold text-gray-400">
                      {index + 1}
                    </td>

                    {/* Product Master Dropdown */}
                    <td className="py-3 px-3">
                      <select
                        required
                        value={line.productId}
                        onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="">-- Select Product --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.size ? `(${p.size})` : ''}
                          </option>
                        ))}
                      </select>
                      {!line.productId && (
                        <input
                          type="text"
                          placeholder="Or enter custom product name"
                          value={line.productName}
                          onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                          className="w-full mt-1.5 px-3 py-1.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="py-3 px-3">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          required
                          value={line.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          placeholder="0.000"
                          className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg text-sm text-right font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-gray-500 pointer-events-none">
                          Tons
                        </span>
                      </div>
                    </td>

                    {/* Carbon Type */}
                    <td className="py-3 px-3">
                      <select
                        required
                        value={line.carbonType}
                        onChange={(e) => handleItemChange(index, 'carbonType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="Low Carbon">Low Carbon</option>
                        <option value="High Carbon">High Carbon</option>
                      </select>
                    </td>

                    {/* Rate */}
                    <td className="py-3 px-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.rate}
                        onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                        placeholder="₹ / Ton"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </td>

                    {/* Remove Action */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        disabled={items.length <= 1}
                        className={`p-1.5 rounded-lg text-gray-400 transition-colors ${
                          items.length <= 1 
                            ? 'opacity-30 cursor-not-allowed' 
                            : 'hover:text-red-600 hover:bg-red-50'
                        }`}
                        title={items.length <= 1 ? 'At least one product line required' : 'Remove product line'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Product Button */}
          <div className="pt-2 flex justify-start">
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/50 text-blue-600 rounded-lg text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Product Line
            </button>
          </div>

          {/* Info note */}
          <div className="bg-amber-50/60 border border-amber-200/60 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2 mt-4">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Inventory Notice:</strong> Creating a purchase order reserves quantities but does <strong>NOT</strong> increase inventory stock. Inventory stock will only be incremented when quantities are physically received via the <strong>Order Received</strong> interface.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Link
            to="/purchases"
            className="px-5 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {submitting ? 'Saving Order...' : isEditMode ? 'Update Purchase Order' : 'Save & Place Order'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PurchaseForm;
