import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, Users } from 'lucide-react';
import api from '../../services/api';

const OrganizationsList = () => {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/organizations');
      setOrganizations(response.data);
    } catch (err) {
      setError('Failed to load organizations.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete the organization "${name}"? This action cannot be undone.`)) {
      try {
        await api.delete(`/organizations/${id}`);
        setOrganizations(organizations.filter(org => org.id !== id));
      } catch (err) {
        alert('Failed to delete organization');
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Organizations</h2>
        <Link
          to="/super-admin/organizations/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium flex items-center transition-colors"
        >
          <Plus size={18} className="mr-2" />
          Add Organization
        </Link>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-medium">ID</th>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Address</th>
                <th className="px-6 py-4 font-medium">Phone</th>

                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : organizations.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    No organizations found. Click "Add Organization" to create one.
                  </td>
                </tr>
              ) : (
                organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500">#{org.id}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-800">{org.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={org.address}>{org.address}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{org.phone}</td>

                    <td className="px-6 py-4 text-right space-x-3">
                      <Link
                        to={`/super-admin/organizations/${org.id}/users`}
                        className="text-indigo-600 hover:text-indigo-900 inline-flex"
                        title="Manage Users"
                      >
                        <Users size={18} />
                      </Link>
                      <Link
                        to={`/super-admin/organizations/${org.id}/edit`}
                        className="text-blue-600 hover:text-blue-900 inline-flex"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </Link>
                      <button
                        onClick={() => handleDelete(org.id, org.name)}
                        className="text-red-600 hover:text-red-900 inline-flex focus:outline-none"
                        title="Delete"
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
    </div>
  );
};

export default OrganizationsList;
