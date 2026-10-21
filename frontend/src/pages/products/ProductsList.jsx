import React, { useState, useEffect, useCallback, useContext } from 'react';
import { 
  Plus, 
  Search, 
  Package, 
  Building, 
  Filter, 
  Edit2, 
  Power, 
  Trash2,
  CheckCircle, 
  XCircle, 
  Layers, 
  Ruler, 
  FileText,
  AlertCircle
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';

const CATEGORIES = [
  'Reinforcing Steel Bar',
  'Pipe',
  'Other'
];


const ProductsList = () => {
  const { user } = useContext(AuthContext);

  const [products, setProducts] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedOrgId, setSelectedOrgId] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    unit: 'Ton', // By default in tons
    price: '',
    description: '',
    specifications: '',
    status: 'ACTIVE',
    organizationId: user?.organizationId || ''
  });

  // Fetch Organizations for Super Admin dropdown
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      const fetchOrgs = async () => {
        try {
          const res = await api.get('/organizations');
          setOrganizations(res.data || []);
        } catch (err) {
          console.error('Failed to load organizations:', err);
        }
      };
      fetchOrgs();
    }
  }, [user]);

  // Fetch Products
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (selectedCategory !== 'ALL') params.append('category', selectedCategory);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);

      if (user?.role === 'SUPER_ADMIN') {
        if (selectedOrgId) {
          params.append('organizationId', selectedOrgId);
        }
      } else if (user?.organizationId) {
        params.append('organizationId', user.organizationId);
      }

      const response = await api.get(`/products?${params.toString()}`);
      setProducts(response.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch products.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory, selectedStatus, selectedOrgId, user]);

  // Debounced search & filter trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 400);

    return () => clearTimeout(timer);
  }, [fetchProducts]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      unit: 'Ton', // By default in tons
      price: '',
      description: '',
      specifications: '',
      status: 'ACTIVE',
      organizationId: selectedOrgId || (organizations.length > 0 ? organizations[0].id : '') || user?.organizationId || ''
    });
    setModalError('');
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (product) => {
    setEditingProduct(product);

    let parsedSpecs = '';
    if (product.specifications) {
      try {
        const specs = JSON.parse(product.specifications);
        if (typeof specs === 'object' && specs !== null) {
          parsedSpecs = Object.entries(specs)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
        } else {
          parsedSpecs = String(specs);
        }
      } catch {
        parsedSpecs = product.specifications;
      }
    }

    setFormData({
      name: product.name || '',
      unit: product.unit || 'Ton',
      price: product.price !== undefined && product.price !== null ? String(product.price) : '',
      description: product.description || '',
      specifications: parsedSpecs,
      status: product.status || 'ACTIVE',
      organizationId: product.organizationId || ''
    });

    setModalError('');
    setShowModal(true);
  };

  // Toggle Active/Inactive Status
  const handleToggleStatus = async (product) => {
    const isActivating = product.status === 'INACTIVE';
    const actionText = isActivating ? 'activate' : 'deactivate';

    const confirmMessage = isActivating 
      ? `Are you sure you want to activate "${product.name}"?`
      : `Are you sure you want to deactivate "${product.name}"? Inactive products are preserved for historical estimates and billing records.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await api.patch(`/products/${product.id}/status`, {
        status: isActivating ? 'ACTIVE' : 'INACTIVE'
      });

      setProducts(prev => 
        prev.map(p => p.id === product.id ? response.data.product : p)
      );

      setSuccessMsg(`Product "${product.name}" successfully ${actionText}d.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || `Failed to ${actionText} product`);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (product) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete product "${product.name}"?\n\nThis will permanently delete this product from your catalog.\nNote: Products used in past bills, estimates, or purchases cannot be deleted to preserve financial audit history.`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/products/${product.id}`);
      setProducts(prev => prev.filter(p => p.id !== product.id));
      setSuccessMsg(`Product "${product.name}" deleted successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Delete product error:', err);
      const errMsg = err.response?.data?.error || 'Failed to delete product.';
      alert(errMsg);
      setError(errMsg);
      setTimeout(() => setError(''), 6000);
    } finally {
      setLoading(false);
    }
  };

  // Handle Submit Form
  const handleSubmitProduct = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.name.trim()) {
      return setModalError('Product name is required.');
    }

    if (!formData.unit || !formData.unit.trim()) {
      return setModalError('Unit of measurement is required.');
    }

    if (formData.price === '' || formData.price === null || isNaN(parseFloat(formData.price)) || parseFloat(formData.price) < 0) {
      return setModalError('Product price is required and must be a valid non-negative number.');
    }

    if (user?.role === 'SUPER_ADMIN' && !formData.organizationId) {
      return setModalError('Please select an Organization for this product.');
    }

    try {
      setModalLoading(true);
      setModalError('');

      // Payload with price and unit in tons (category & size handled with safe defaults by backend)
      const payload = {
        name: formData.name.trim(),
        unit: 'Ton',
        price: parseFloat(formData.price) || 0,
        description: formData.description?.trim() || null,
        specifications: formData.specifications?.trim() || null,
        status: formData.status,
        organizationId: formData.organizationId
      };

      if (editingProduct) {
        // Update product
        const res = await api.put(`/products/${editingProduct.id}`, payload);
        setProducts(prev => 
          prev.map(p => p.id === editingProduct.id ? res.data.product : p)
        );
        setSuccessMsg(`Product "${payload.name}" updated successfully.`);
      } else {
        // Create product
        const res = await api.post('/products', payload);
        setProducts(prev => [res.data.product, ...prev]);
        setSuccessMsg(`Product "${payload.name}" added successfully.`);
      }

      setTimeout(() => setSuccessMsg(''), 4000);
      setShowModal(false);
    } catch (err) {
      console.error(err);
      setModalError(err.response?.data?.error || 'Failed to save product.');
    } finally {
      setModalLoading(false);
    }
  };

  // Helper to format specifications in table
  const renderSpecs = (product) => {
    if (!product.specifications && !product.description) {
      return <span className="text-gray-400 text-xs">-</span>;
    }

    let parsed = null;
    if (product.specifications) {
      try {
        parsed = JSON.parse(product.specifications);
      } catch {
        parsed = { extra: product.specifications };
      }
    }

    return (
      <div className="space-y-1">
        {parsed && (
          <div className="flex flex-wrap gap-1">
            {parsed.grade && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                Grade: {parsed.grade}
              </span>
            )}
            {parsed.pressureRating && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-cyan-50 text-cyan-700 border border-cyan-200">
                Press: {parsed.pressureRating}
              </span>
            )}
            {parsed.length && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                Len: {parsed.length}
              </span>
            )}
            {parsed.extra && (
              <span className="text-xs text-gray-500 italic">
                {parsed.extra}
              </span>
            )}
          </div>
        )}
        {product.description && (
          <p className="text-xs text-gray-500 line-clamp-1" title={product.description}>
            {product.description}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Product Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            Maintain catalogue of reinforcing steel bars and pipes without fixed selling rates.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium flex items-center shadow-sm transition-all text-sm shrink-0"
        >
          <Plus size={18} className="mr-2" />
          Add Product
        </button>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center">
          <CheckCircle size={18} className="mr-2 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center">
          <AlertCircle size={18} className="mr-2 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Stock Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <Package size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Products</p>
            <p className="text-xl font-bold text-gray-900">{products.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">In Stock</p>
            <p className="text-xl font-bold text-emerald-700">
              {products.filter(p => parseFloat(p.currentStock || 0) > 0).length}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Zero / Out of Stock</p>
            <p className="text-xl font-bold text-amber-700">
              {products.filter(p => parseFloat(p.currentStock || 0) <= 0).length}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-teal-50 text-teal-600 rounded-lg">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Stock Left</p>
            <p className="text-xl font-bold text-teal-700">
              {products.reduce((acc, p) => acc + (parseFloat(p.currentStock || 0)), 0).toFixed(2)} Tons
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Search */}
        <div className={`relative ${user?.role === 'SUPER_ADMIN' ? 'md:col-span-5' : 'md:col-span-6'}`}>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="Search by name, size, category, or specs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Category Filter */}
        <div className="md:col-span-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Categories</option>
            <option value="Reinforcing Steel Bar">Steel Bars</option>
            <option value="Pipe">Pipes</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="md:col-span-2">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>

        {/* Super Admin Organization Filter */}
        {user?.role === 'SUPER_ADMIN' && (
          <div className="md:col-span-3">
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Organizations</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100 font-semibold">
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Size / Diameter</th>
                <th className="px-6 py-4">Unit</th>
                <th className="px-6 py-4 text-right">Stock Left</th>
                <th className="px-6 py-4">Price / Rate</th>
                <th className="px-6 py-4">Specifications & Details</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="text-sm font-medium">Loading catalogue...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="bg-blue-50 text-blue-600 p-3.5 rounded-full">
                        <Package className="h-7 w-7" />
                      </div>
                      <p className="text-gray-700 font-medium text-base">No products found.</p>
                      <p className="text-gray-400 text-sm max-w-sm">
                        {searchTerm || selectedCategory !== 'ALL' || selectedStatus !== 'ALL'
                          ? 'Try adjusting your search query or filter options.'
                          : 'Get started by cataloguing your first reinforcing steel bar or pipe.'}
                      </p>
                      <button
                        onClick={handleOpenCreate}
                        className="mt-2 text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center space-x-1"
                      >
                        <Plus size={16} />
                        <span>Add New Product</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr 
                    key={product.id} 
                    className={`hover:bg-gray-50/80 transition-colors ${product.status === 'INACTIVE' ? 'bg-gray-50/40 opacity-75' : ''}`}
                  >
                    {/* Product Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg shrink-0 ${
                          product.category === 'Reinforcing Steel Bar'
                            ? 'bg-amber-100 text-amber-700'
                            : product.category === 'Pipe'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          <Package size={18} />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-gray-900 block">
                            {product.name}
                          </span>
                          {product.Organization && user?.role === 'SUPER_ADMIN' && (
                            <span className="text-[11px] text-gray-500 flex items-center mt-0.5">
                              <Building size={11} className="mr-1 text-gray-400" />
                              {product.Organization.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category Badge */}
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        product.category === 'Reinforcing Steel Bar'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : product.category === 'Pipe'
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}>
                        {product.category}
                      </span>
                    </td>

                    {/* Size / Diameter */}
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">
                      <div className="flex items-center space-x-1">
                        <Ruler size={14} className="text-gray-400 shrink-0" />
                        <span>{product.size}</span>
                      </div>
                    </td>

                    {/* Unit */}
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-medium text-gray-700">
                        {product.unit}
                      </span>
                    </td>

                    {/* Stock Left */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`text-sm font-bold font-mono ${
                          parseFloat(product.currentStock || 0) > 0 
                            ? 'text-emerald-700' 
                            : 'text-amber-600'
                        }`}>
                          {parseFloat(product.currentStock || 0).toFixed(3)}
                        </span>
                        <span className="text-[11px] text-gray-400 font-medium">
                          {product.unit || 'Ton'}
                        </span>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="px-6 py-4 text-sm font-semibold font-mono text-slate-900 whitespace-nowrap">
                      ₹{parseFloat(product.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-[11px] text-gray-500 font-sans ml-1 font-normal">/ {product.unit || 'Ton'}</span>
                    </td>

                    {/* Specifications & Details */}
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                      {renderSpecs(product)}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-sm">
                      {product.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle size={12} className="mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                          <XCircle size={12} className="mr-1" />
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-sm font-medium text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEdit(product)}
                        className="text-blue-600 hover:text-blue-900 transition-colors p-1.5 rounded hover:bg-blue-50 inline-flex items-center"
                        title="Edit Product"
                      >
                        <Edit2 size={16} />
                      </button>

                      <button
                        onClick={() => handleToggleStatus(product)}
                        className={`transition-colors p-1.5 rounded inline-flex items-center ${
                          product.status === 'ACTIVE'
                            ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                            : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                        }`}
                        title={product.status === 'ACTIVE' ? 'Deactivate Product' : 'Activate Product'}
                      >
                        <Power size={16} />
                      </button>

                      <button
                        onClick={() => handleDeleteProduct(product)}
                        className="text-red-600 hover:text-red-800 transition-colors p-1.5 rounded hover:bg-red-50 inline-flex items-center"
                        title="Delete Product"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Default weight unit is Ton. Specify price per unit.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Error */}
            {modalError && (
              <div className="my-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center">
                <AlertCircle size={16} className="mr-2 text-red-500 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSubmitProduct} className="space-y-4 pt-4">
              {/* Organization (Super Admin Only) */}
              {user?.role === 'SUPER_ADMIN' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Organization / Office <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.organizationId}
                    onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                    disabled={!!editingProduct} // Maintain historical organization
                    required
                  >
                    <option value="">Select an Organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. TMT 500D Steel, MS Pipe 40mm, Steel Angle"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Price, Unit (Default: Ton), and Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Price / Rate (₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 font-bold text-xs pointer-events-none">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                      className="block w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">Per Ton</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Unit of Measurement
                  </label>
                  <div className="flex items-center px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm font-semibold text-gray-800">
                    <span>Ton</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">Quantity is standard in Tons</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              {/* Technical Specifications */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Technical Specifications (Optional)
                </label>
                <input
                  type="text"
                  value={formData.specifications}
                  onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                  placeholder="e.g. Fe 500D, IS 1786, Schedule 40, Galvanized"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Product Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Product Description / Notes (Optional)
                </label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Notes, manufacturing standards, or packaging details..."
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {modalLoading 
                    ? 'Saving...' 
                    : (editingProduct ? 'Save Changes' : 'Create Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsList;
