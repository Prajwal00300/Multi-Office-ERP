import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Plus, Search, Building, Phone, MapPin, Hash, User, Edit2, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';

const CustomersList = () => {
  const { user } = useContext(AuthContext);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    tin: '',
    organizationId: user?.organizationId || '' 
  });

  const fetchCustomers = useCallback(async (searchQuery = '') => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (user?.role === 'SUPER_ADMIN' && user?.organizationId) {
         params.append('organizationId', user.organizationId);
      } else if (user?.role === 'SUPER_ADMIN' && formData.organizationId) {
         params.append('organizationId', formData.organizationId);
      }

      const response = await api.get(`/customers?${params.toString()}`);
      setCustomers(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch customers.');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [user, formData.organizationId]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCustomers(searchTerm);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, fetchCustomers]);

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      phone: '',
      address: '',
      city: '',
      tin: '',
      organizationId: formData.organizationId
    });
    setModalError('');
    setShowModal(true);
  };

  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      tin: customer.tin || '',
      organizationId: customer.organizationId
    });
    setModalError('');
    setShowModal(true);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the customer "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/customers/${id}`);
      setCustomers(customers.filter(c => c.id !== id));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to delete customer');
    }
  };

  const handleSubmitCustomer = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.name.trim()) {
      return setModalError('Customer name is required');
    }

    try {
      setModalLoading(true);
      setModalError('');
      
      const payload = { ...formData };
      
      if (editingCustomer) {
        // Update existing
        const response = await api.put(`/customers/${editingCustomer.id}`, payload);
        setCustomers(customers.map(c => c.id === editingCustomer.id ? response.data.customer : c));
      } else {
        // Create new
        const response = await api.post('/customers', payload);
        setCustomers([response.data.customer, ...customers]);
      }
      
      setShowModal(false);
    } catch (err) {
      console.error(err);
      setModalError(err.response?.data?.error || 'Failed to save customer.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setModalError('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <h2 className="text-2xl font-bold text-gray-800">Customer Management</h2>
        <button
          onClick={handleOpenCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium flex items-center transition-colors"
        >
          <Plus size={18} className="mr-2" />
          Add Customer
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow"
            placeholder="Search by name, city, phone, or TIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {user?.role === 'SUPER_ADMIN' && (
           <input 
              type="number"
              placeholder="Org ID (Super Admin)"
              className="block w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-md sm:text-sm focus:ring-1 focus:ring-blue-500"
              value={formData.organizationId}
              onChange={(e) => setFormData({...formData, organizationId: e.target.value})}
              title="Super Admins must specify an Organization ID context"
           />
        )}
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-medium">Customer Name</th>
                <th className="px-6 py-4 font-medium">City</th>
                <th className="px-6 py-4 font-medium">Phone</th>
                <th className="px-6 py-4 font-medium">TIN</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                      Searching customers...
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="bg-gray-100 p-3 rounded-full">
                        <Search className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-lg">No customer found.</p>
                      <button
                        onClick={handleOpenCreate}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm mt-2"
                      >
                        + Add New Customer
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="bg-blue-100 p-2 rounded-md mr-3 text-blue-600">
                          <User size={16} />
                        </div>
                        <span className="text-sm font-semibold text-gray-800">{customer.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {customer.city ? (
                        <div className="flex items-center">
                          <MapPin size={14} className="mr-1 text-gray-400" />
                          {customer.city}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {customer.phone ? (
                        <div className="flex items-center">
                          <Phone size={14} className="mr-1 text-gray-400" />
                          {customer.phone}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {customer.tin ? (
                        <div className="flex items-center">
                          <Hash size={14} className="mr-1 text-gray-400" />
                          {customer.tin}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-right">
                      <button 
                        onClick={() => handleOpenEdit(customer)}
                        className="text-blue-600 hover:text-blue-900 mr-4 transition-colors"
                        title="Edit Customer"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(customer.id, customer.name)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title="Delete Customer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-gray-800">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button onClick={handleModalClose} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            
            {modalError && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">{modalError}</div>}
            
            <form onSubmit={handleSubmitCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="e.g. ABC Construction"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Optional"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPin className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Complete Address</label>
                <div className="relative">
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <Building className="h-4 w-4 text-gray-400" />
                  </div>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    rows="2"
                    className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Optional"
                  ></textarea>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TIN / Tax ID</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Hash className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.tin}
                    onChange={(e) => setFormData({...formData, tin: e.target.value})}
                    className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Optional"
                  />
                </div>
              </div>
              
              <div className="pt-5 flex justify-end space-x-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {modalLoading ? 'Saving...' : (editingCustomer ? 'Save Changes' : 'Save Customer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersList;
