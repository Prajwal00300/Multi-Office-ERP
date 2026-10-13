import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Lock, 
  Building, 
  User, 
  Calendar, 
  FileText, 
  AlertCircle, 
  CheckCircle,
  Hash,
  MapPin,
  Phone
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';

const DEFAULT_ITEM_ROW = {
  productId: '',
  productNameSnapshot: '',
  productCategorySnapshot: '',
  productSizeSnapshot: '',
  productSpecificationsSnapshot: '',
  btls: '',
  quantity: '',
  unit: 'Kg',
  negotiatedRate: '',
  amount: 0
};

const STANDARD_UNITS = ['Kg', 'Ton', 'Piece', 'Meter', 'Bundle', 'Length'];

const EstimateForm = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // If present, editing draft
  const isEditing = Boolean(id);
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [error, setError] = useState('');

  // Dropdown data
  const [organizations, setOrganizations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    organizationId: user?.organizationId || '',
    customerId: '',
    estimateDate: new Date().toISOString().split('T')[0],
    basic: '',
    others: 0,
    notes: ''
  });

  const [items, setItems] = useState([ { ...DEFAULT_ITEM_ROW } ]);

  // Selected customer details preview
  const selectedCustomer = customers.find(c => String(c.id) === String(formData.customerId));

  // 1. Fetch Organizations (if Super Admin)
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      const fetchOrgs = async () => {
        try {
          const res = await api.get('/organizations');
          setOrganizations(res.data || []);
          if (!formData.organizationId && res.data?.length > 0) {
            setFormData(prev => ({ ...prev, organizationId: res.data[0].id }));
          }
        } catch (err) {
          console.error('Failed to load organizations:', err);
        }
      };
      fetchOrgs();
    }
  }, [user]);

  // 2. Fetch Customers & Products whenever active organization changes
  const activeOrgId = user?.role === 'SUPER_ADMIN' ? formData.organizationId : user?.organizationId;

  useEffect(() => {
    if (!activeOrgId) return;

    const loadOrgDependencies = async () => {
      try {
        const [custRes, prodRes] = await Promise.all([
          api.get(`/customers?organizationId=${activeOrgId}`),
          api.get(`/products?organizationId=${activeOrgId}&status=ACTIVE`)
        ]);
        setCustomers(custRes.data || []);
        setProducts(prodRes.data || []);
      } catch (err) {
        console.error('Failed to load customers or products:', err);
      }
    };

    loadOrgDependencies();
  }, [activeOrgId]);

  // 3. If Editing, fetch existing estimate data
  useEffect(() => {
    if (!isEditing) return;

    const fetchExisting = async () => {
      try {
        setInitialLoading(true);
        const res = await api.get(`/estimates/${id}`);
        const est = res.data;

        if (est.status !== 'DRAFT') {
          setError(`Estimate ${est.estimateNumber} is already ${est.status} and locked against direct edits. Redirecting to details view...`);
          setTimeout(() => navigate(`/estimates/${id}`), 3000);
          return;
        }

        setFormData({
          organizationId: est.organizationId,
          customerId: est.customerId,
          estimateDate: est.estimateDate,
          basic: est.basic || '',
          others: est.others || 0,
          notes: est.notes || ''
        });

        if (est.items && est.items.length > 0) {
          setItems(est.items.map(it => ({
            productId: it.productId || '',
            productNameSnapshot: it.productNameSnapshot,
            productCategorySnapshot: it.productCategorySnapshot || '',
            productSizeSnapshot: it.productSizeSnapshot || '',
            productSpecificationsSnapshot: it.productSpecificationsSnapshot || '',
            btls: it.btls || '',
            quantity: it.quantity,
            unit: it.unit || 'Kg',
            negotiatedRate: it.negotiatedRate,
            amount: it.amount
          })));
        }
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || 'Failed to load estimate for editing.');
      } finally {
        setInitialLoading(false);
      }
    };

    fetchExisting();
  }, [id, isEditing, navigate]);

  // Handle Product Selection on a Row
  const handleProductSelect = (index, productId) => {
    const selectedProd = products.find(p => String(p.id) === String(productId));
    const newItems = [...items];

    if (selectedProd) {
      newItems[index] = {
        ...newItems[index],
        productId: selectedProd.id,
        productNameSnapshot: `${selectedProd.name} (${selectedProd.size})`,
        productCategorySnapshot: selectedProd.category,
        productSizeSnapshot: selectedProd.size,
        productSpecificationsSnapshot: selectedProd.specifications || '',
        unit: selectedProd.unit || 'Kg'
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        productId: '',
        productNameSnapshot: ''
      };
    }

    setItems(newItems);
  };

  // Handle Item Row Change & recalculate row amount
  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    // Recalculate preview amount for row
    if (field === 'quantity' || field === 'negotiatedRate') {
      const q = parseFloat(newItems[index].quantity) || 0;
      const r = parseFloat(newItems[index].negotiatedRate) || 0;
      newItems[index].amount = Math.round((q * r + Number.EPSILON) * 100) / 100;
    }

    setItems(newItems);
  };

  const handleAddRow = () => {
    setItems(prev => [...prev, { ...DEFAULT_ITEM_ROW }]);
  };

  const handleRemoveRow = (index) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Calculate live preview totals
  const totalQuantity = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const othersVal = parseFloat(formData.others) || 0;
  const grandTotal = Math.round((totalAmount + othersVal + Number.EPSILON) * 100) / 100;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  // Handle Form Submit
  const handleSubmit = async (submitStatus) => {
    // Basic validation
    if (user?.role === 'SUPER_ADMIN' && !formData.organizationId) {
      return setError('Please select an Organization.');
    }
    if (!formData.customerId) {
      return setError('Please select a Customer.');
    }

    // Validate Items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productNameSnapshot || !it.productNameSnapshot.trim()) {
        return setError(`Product Description Goods is required on item row ${i + 1}.`);
      }
      const q = parseFloat(it.quantity);
      if (isNaN(q) || q <= 0) {
        return setError(`Please enter a valid Quantity (> 0) on item row ${i + 1}.`);
      }
      const r = parseFloat(it.negotiatedRate);
      if (isNaN(r) || r < 0) {
        return setError(`Please enter a valid Negotiated Rate (>= 0) on item row ${i + 1}.`);
      }
    }

    if (submitStatus === 'GENERATED') {
      if (!window.confirm('Generating an estimate will lock it against ordinary edits. Do you wish to generate and lock this estimate now?')) {
        return;
      }
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        organizationId: activeOrgId,
        customerId: formData.customerId,
        estimateDate: formData.estimateDate,
        basic: formData.basic ? formData.basic.trim() : null,
        others: othersVal,
        notes: formData.notes ? formData.notes.trim() : null,
        status: submitStatus,
        items: items.map(it => ({
          productId: it.productId ? Number(it.productId) : null,
          productNameSnapshot: it.productNameSnapshot.trim(),
          productCategorySnapshot: it.productCategorySnapshot || null,
          productSizeSnapshot: it.productSizeSnapshot || null,
          productSpecificationsSnapshot: it.productSpecificationsSnapshot || null,
          btls: it.btls ? String(it.btls).trim() : null,
          quantity: parseFloat(it.quantity),
          unit: it.unit || 'Kg',
          negotiatedRate: parseFloat(it.negotiatedRate)
        }))
      };

      if (isEditing) {
        await api.put(`/estimates/${id}`, payload);
        if (submitStatus === 'GENERATED') {
          await api.post(`/estimates/${id}/generate`);
        }
        navigate(`/estimates/${id}`);
      } else {
        const res = await api.post('/estimates', payload);
        navigate(`/estimates/${res.data.estimate.id}`);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save estimate.');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
        <span className="text-gray-500 text-sm">Loading estimate data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <Link
            to="/estimates"
            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors shadow-xs"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {isEditing ? 'Edit Draft Estimate' : 'Create New Estimate (K)'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Enter negotiated prices and goods details matching the client estimate format.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => handleSubmit('DRAFT')}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center shadow-xs disabled:opacity-50"
          >
            <Save size={16} className="mr-1.5 text-gray-500" />
            {loading ? 'Saving...' : 'Save as Draft'}
          </button>

          <button
            type="button"
            onClick={() => handleSubmit('GENERATED')}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-xs disabled:opacity-50"
          >
            <Lock size={16} className="mr-1.5" />
            {loading ? 'Generating...' : 'Generate & Lock'}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center">
          <AlertCircle size={18} className="mr-2 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header Fields Section */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-600 border-b pb-2">
          Document Header Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Organization (Super Admin) */}
          {user?.role === 'SUPER_ADMIN' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Organization / Office <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.organizationId}
                onChange={(e) => setFormData({ ...formData, organizationId: e.target.value, customerId: '' })}
                disabled={isEditing}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Customer Selection */}
          <div className={user?.role === 'SUPER_ADMIN' ? 'md:col-span-1' : 'md:col-span-2'}>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Sold: Customer Name <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Select Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.city ? `(${c.city})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Estimate Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Dt. (Estimate Date) <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.estimateDate}
              onChange={(e) => setFormData({ ...formData, estimateDate: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Basic Header Field */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Basic (Header Label)
            </label>
            <input
              type="text"
              value={formData.basic}
              onChange={(e) => setFormData({ ...formData, basic: e.target.value })}
              placeholder="e.g. 52000, Ex-Mill, Direct"
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Selected Customer Details Preview */}
        {selectedCustomer && (
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 flex flex-wrap gap-4 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">
              Customer Details:
            </span>
            {selectedCustomer.city && (
              <span className="flex items-center">
                <MapPin size={13} className="mr-1 text-slate-400" />
                City: {selectedCustomer.city}
              </span>
            )}
            {selectedCustomer.phone && (
              <span className="flex items-center">
                <Phone size={13} className="mr-1 text-slate-400" />
                Phone: {selectedCustomer.phone}
              </span>
            )}
            {selectedCustomer.tin && (
              <span className="flex items-center">
                <Hash size={13} className="mr-1 text-slate-400" />
                TIN: {selectedCustomer.tin}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Product Items Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">
              Product Line Items
            </h3>
            <p className="text-xs text-gray-500">
              Matches client table: Description Goods | Btls | Quantity | Rate | Amount
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddRow}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center transition-colors"
          >
            <Plus size={14} className="mr-1" />
            Add Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100/70 text-gray-600 text-xs uppercase tracking-wider font-semibold border-b">
                <th className="px-4 py-3 w-10 text-center">#</th>
                <th className="px-4 py-3 min-w-[260px]">Description Goods</th>
                <th className="px-4 py-3 w-28">Btls</th>
                <th className="px-4 py-3 w-32">Quantity</th>
                <th className="px-4 py-3 w-24">Unit</th>
                <th className="px-4 py-3 w-36">Rate (₹)</th>
                <th className="px-4 py-3 w-36 text-right">Amount (₹)</th>
                <th className="px-4 py-3 w-14 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {items.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50/50">
                  {/* Row index */}
                  <td className="px-4 py-3 text-center text-xs text-gray-400 font-mono">
                    {index + 1}
                  </td>

                  {/* Description Goods */}
                  <td className="px-4 py-3">
                    <div className="space-y-1.5">
                      {/* Optional quick picker from Product Master */}
                      <select
                        value={row.productId || ''}
                        onChange={(e) => handleProductSelect(index, e.target.value)}
                        className="block w-full px-2.5 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700"
                      >
                        <option value="">-- Choose from Product Master --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} - {p.category} ({p.size})
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={row.productNameSnapshot}
                        onChange={(e) => handleItemChange(index, 'productNameSnapshot', e.target.value)}
                        placeholder="Description Goods (e.g. 12mm TMT Bar, 2 inch Pipe)"
                        className="block w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 font-medium"
                        required
                      />
                    </div>
                  </td>

                  {/* Btls */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.btls}
                      onChange={(e) => handleItemChange(index, 'btls', e.target.value)}
                      placeholder="Btls"
                      className="block w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-center"
                    />
                  </td>

                  {/* Quantity */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={row.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      placeholder="Qty"
                      className="block w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-right font-medium"
                      required
                    />
                  </td>

                  {/* Unit */}
                  <td className="px-4 py-3">
                    <select
                      value={row.unit}
                      onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                      className="block w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white text-gray-700"
                    >
                      {STANDARD_UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </td>

                  {/* Negotiated Rate */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={row.negotiatedRate}
                      onChange={(e) => handleItemChange(index, 'negotiatedRate', e.target.value)}
                      placeholder="Rate ₹"
                      className="block w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-right font-medium"
                      required
                    />
                  </td>

                  {/* Amount Preview */}
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">
                    {formatCurrency(row.amount)}
                  </td>

                  {/* Remove row */}
                  <td className="px-4 py-3 text-center">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(index)}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                        title="Remove row"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Notes & Client Notice */}
        <div className="md:col-span-7 bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-3">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Estimate Notes & Terms (Optional)
          </label>
          <textarea
            rows="3"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Special delivery instructions, gate pass instructions, or customer terms..."
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500"
          ></textarea>
          <p className="text-[11px] text-gray-400">
            * Rates are negotiated independently for each estimate. Authoritative financial calculations are verified and sealed upon generation.
          </p>
        </div>

        {/* Financial Totals Card */}
        <div className="md:col-span-5 bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 border-b pb-2">
            Document Summary Totals
          </h4>

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Total Quantity:</span>
            <span className="font-semibold text-gray-800 font-mono">
              {Math.round((totalQuantity + Number.EPSILON) * 1000) / 1000}
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Total (Subtotal):</span>
            <span className="font-semibold text-gray-800 font-mono">
              {formatCurrency(totalAmount)}
            </span>
          </div>

          <div className="flex justify-between items-center text-sm pt-1">
            <span className="text-gray-600">Others:</span>
            <div className="w-32">
              <input
                type="number"
                step="any"
                value={formData.others}
                onChange={(e) => setFormData({ ...formData, others: e.target.value })}
                placeholder="0.00"
                className="block w-full px-2 py-1 text-sm border border-gray-300 rounded text-right font-medium"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
            <span className="text-base font-bold text-gray-900">Grand Total:</span>
            <span className="text-lg font-extrabold text-blue-700 font-mono">
              {formatCurrency(grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstimateForm;
