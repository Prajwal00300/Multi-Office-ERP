import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../../services/api';

const OrganizationForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditMode);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEditMode) {
      fetchOrganization();
    }
  }, [id]);

  const fetchOrganization = async () => {
    try {
      setFetching(true);
      const response = await api.get(`/organizations/${id}`);
      setFormData({
        name: response.data.name || '',
        address: response.data.address || '',
        phone: response.data.phone || ''
      });
    } catch (err) {
      setError('Failed to fetch organization details.');
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name.trim() || !formData.address.trim() || !formData.phone.trim()) {
      return setError('Name, address, and phone are required fields.');
    }

    setLoading(true);
    try {
      if (isEditMode) {
        await api.put(`/organizations/${id}`, formData);
      } else {
        await api.post('/organizations', formData);
      }
      navigate('/super-admin/organizations');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save organization.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4 mb-6">
        <Link 
          to="/super-admin/organizations" 
          className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
        >
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">
          {isEditMode ? 'Edit Organization' : 'Add New Organization'}
        </h2>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
              placeholder="e.g. ABC Delhi"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
              placeholder="e.g. +91 9876543210"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Complete Address <span className="text-red-500">*</span></label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              disabled={loading}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
              placeholder="Enter full address including city, state, and pincode"
            ></textarea>
          </div>



          <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100">
            <Link
              to="/super-admin/organizations"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : isEditMode ? 'Update Organization' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrganizationForm;
