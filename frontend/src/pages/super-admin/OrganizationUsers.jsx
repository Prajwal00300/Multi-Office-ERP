import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Key } from 'lucide-react';
import api from '../../services/api';

const OrganizationUsers = () => {
  const { id: orgId } = useParams();
  const [users, setUsers] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', role: 'ADMIN' });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  const roles = [
    { value: 'ADMIN', label: 'Admin' },
    { value: 'WEIGHBRIDGE_CONTROLLER', label: 'Weighbridge Controller' },
    { value: 'OPERATIONS_BILLING', label: 'Operations & Billing' },
    { value: 'PAYMENT_COLLECTOR', label: 'Payment Collector' },
    { value: 'USER', label: 'Standard User' }
  ];

  useEffect(() => {
    fetchData();
  }, [orgId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [orgRes, usersRes] = await Promise.all([
        api.get(`/organizations/${orgId}`),
        api.get(`/users/organization/${orgId}`)
      ]);
      setOrganization(orgRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      setError('Failed to load organization or users.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId, username) => {
    if (window.confirm(`Are you sure you want to delete user "${username}"?`)) {
      try {
        await api.delete(`/users/${userId}`);
        setUsers(users.filter(u => u.id !== userId));
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete user');
        console.error(err);
      }
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.password || !formData.role) {
      return setModalError('All fields are required');
    }

    try {
      setModalLoading(true);
      const res = await api.post('/users', {
        ...formData,
        organizationId: orgId
      });
      setUsers([...users, res.data.user]);
      setShowModal(false);
      setFormData({ username: '', password: '', role: 'ADMIN' });
      setModalError('');
    } catch (err) {
      setModalError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link 
          to="/super-admin/organizations" 
          className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
        >
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">
          Users: {organization ? organization.name : 'Loading...'}
        </h2>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}

      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <p className="text-sm text-gray-500">Manage access and credentials for this organization.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium flex items-center transition-colors"
        >
          <Plus size={18} className="mr-2" />
          Assign User
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-medium">ID</th>
                <th className="px-6 py-4 font-medium">Username</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Created At</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                      Loading users...
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    No users assigned to this organization.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500">#{user.id}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-800 flex items-center">
                      <Key size={14} className="mr-2 text-gray-400" />
                      {user.username}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button 
                        onClick={() => handleDelete(user.id, user.username)}
                        className="text-red-600 hover:text-red-900 inline-flex focus:outline-none"
                        title="Delete User"
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

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Assign New User</h3>
            
            {modalError && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">{modalError}</div>}
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. org1_admin"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter a secure password"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role / Dashboard Access</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {roles.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
                >
                  {modalLoading ? 'Creating...' : 'Create Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationUsers;
