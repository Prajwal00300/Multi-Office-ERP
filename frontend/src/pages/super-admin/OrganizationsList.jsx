import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  UserCheck, 
  Phone, 
  MapPin, 
  Search,
  ExternalLink 
} from 'lucide-react';
import superAdminService from '../../services/superAdminService';

const OrganizationsList = () => {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await superAdminService.getOrganizations();
      setOrganizations(data || []);
    } catch (err) {
      console.error('Failed to load organizations:', err);
      setError(err.response?.data?.error || 'Failed to load offices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete office "${name}"? This action cannot be undone.`)) {
      try {
        await superAdminService.deleteOrganization(id);
        setOrganizations(prev => prev.filter(org => org.id !== id));
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete office.');
        console.error(err);
      }
    }
  };

  const filteredOrgs = organizations.filter(org => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = org.name && org.name.toLowerCase().includes(q);
    const addressMatch = org.address && org.address.toLowerCase().includes(q);
    const phoneMatch = org.phone && org.phone.toLowerCase().includes(q);
    const ceoMatch = org.ceo && (
      (org.ceo.fullName && org.ceo.fullName.toLowerCase().includes(q)) ||
      (org.ceo.username && org.ceo.username.toLowerCase().includes(q))
    );
    return nameMatch || addressMatch || phoneMatch || ceoMatch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="text-blue-600" size={26} />
            Managed Offices
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Hierarchy: Super Admin &rarr; Office &rarr; CEO &rarr; Office Employees
          </p>
        </div>
        <Link
          to="/super-admin/organizations/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm transition-colors"
        >
          <Plus size={18} className="mr-1.5" />
          Create Office
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Total Offices: {organizations.length}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Search offices or CEOs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-3.5 font-medium">Office ID / Name</th>
                <th className="px-6 py-3.5 font-medium">Designated CEO (1:1)</th>
                <th className="px-6 py-3.5 font-medium">Contact / Address</th>
                <th className="px-6 py-3.5 font-medium text-center">Staff</th>
                <th className="px-6 py-3.5 font-medium">Status</th>
                <th className="px-6 py-3.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                      Loading offices...
                    </div>
                  </td>
                </tr>
              ) : filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500 text-xs">
                    No offices found. Click "Create Office" to create an office and assign a CEO.
                  </td>
                </tr>
              ) : (
                filteredOrgs.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{org.name}</div>
                      <div className="text-xs text-gray-500 font-mono">Office #{org.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      {org.ceo ? (
                        <div>
                          <Link 
                            to={`/super-admin/ceos/${org.ceo.id}`}
                            className="font-medium text-blue-600 hover:underline flex items-center gap-1 text-xs"
                          >
                            <UserCheck size={14} className="text-blue-500 shrink-0" />
                            {org.ceo.fullName || org.ceo.username}
                          </Link>
                          <div className="text-[11px] text-gray-500">
                            @{org.ceo.username} {org.ceo.phone ? `• ${org.ceo.phone}` : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-medium">
                          No CEO Assigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 max-w-xs">
                      {org.phone && (
                        <div className="flex items-center text-gray-700 mb-0.5 font-mono">
                          <Phone size={12} className="mr-1.5 text-gray-400 shrink-0" />
                          {org.phone}
                        </div>
                      )}
                      {org.address && (
                        <div className="flex items-center text-gray-500 truncate" title={org.address}>
                          <MapPin size={12} className="mr-1.5 text-gray-400 shrink-0" />
                          <span className="truncate">{org.address}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold">
                      <Link
                        to={`/super-admin/organizations/${org.id}/users`}
                        className="inline-block px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-mono font-medium transition-colors"
                        title="Manage office staff"
                      >
                        {org.employeeCount || 0} Staff
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        org.status === 'INACTIVE' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {org.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link
                        to={`/super-admin/organizations/${org.id}/users`}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded inline-flex transition-colors"
                        title="Manage Users"
                      >
                        <Users size={16} />
                      </Link>
                      <Link
                        to={`/super-admin/organizations/${org.id}/edit`}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded inline-flex transition-colors"
                        title="Edit Office & CEO"
                      >
                        <Edit size={16} />
                      </Link>
                      <button
                        onClick={() => handleDelete(org.id, org.name)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded inline-flex transition-colors focus:outline-none"
                        title="Delete Office"
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
    </div>
  );
};

export default OrganizationsList;
