import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Edit2, 
  Users, 
  Phone, 
  MapPin 
} from 'lucide-react';
import ceoService from '../../services/ceoService';

const CeoOffices = () => {
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentOfficeId, setCurrentOfficeId] = useState(null);
  const [modalData, setModalData] = useState({
    name: '',
    address: '',
    phone: '',
    status: 'ACTIVE'
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchOffices = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await ceoService.getOffices();
      setOffices(data || []);
    } catch (err) {
      console.error('Failed to load CEO offices:', err);
      setError(err.response?.data?.error || 'Failed to load offices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffices();
  }, []);

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setCurrentOfficeId(null);
    setModalData({ name: '', address: '', phone: '', status: 'ACTIVE' });
    setModalError('');
    setShowModal(true);
  };

  const handleOpenEditModal = (office) => {
    setIsEditing(true);
    setCurrentOfficeId(office.id);
    setModalData({
      name: office.name,
      address: office.address || '',
      phone: office.phone || '',
      status: office.status || 'ACTIVE'
    });
    setModalError('');
    setShowModal(true);
  };

  const handleSaveOffice = async (e) => {
    e.preventDefault();
    setModalError('');
    if (!modalData.name || !modalData.name.trim()) {
      setModalError('Office name is required.');
      return;
    }

    try {
      setSubmitting(true);
      if (isEditing) {
        await ceoService.updateOffice(currentOfficeId, modalData);
      } else {
        await ceoService.createOffice(modalData);
      }
      setShowModal(false);
      await fetchOffices();
    } catch (err) {
      console.error(err);
      setModalError(err.response?.data?.error || 'Failed to save office.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await ceoService.updateOfficeStatus(id, newStatus);
      setOffices(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update office status.');
    }
  };

  const filteredOffices = offices.filter(o => {
    const matchesSearch = 
      (o.name && o.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.address && o.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.phone && o.phone.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || (o.status || 'ACTIVE') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Branch Offices</h2>
          <p className="text-sm text-gray-500 mt-1">
            Create and oversee branch offices owned by your CEO executive account.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center shadow-sm transition-colors"
        >
          <Plus size={16} className="mr-1.5" />
          Add New Branch Office
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Branches: {offices.length}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search offices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-60"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-3.5 font-medium">Branch ID / Name</th>
                <th className="px-6 py-3.5 font-medium">Address</th>
                <th className="px-6 py-3.5 font-medium">Contact Phone</th>
                <th className="px-6 py-3.5 font-medium text-center">Employees</th>
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
                      Loading branch offices...
                    </div>
                  </td>
                </tr>
              ) : filteredOffices.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No offices found. Click "Add New Branch Office" to establish an office.
                  </td>
                </tr>
              ) : (
                filteredOffices.map((office) => (
                  <tr key={office.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{office.name}</div>
                      <div className="text-xs text-gray-500 font-mono">Office #{office.id}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 max-w-xs truncate">
                      {office.address ? (
                        <span className="flex items-center">
                          <MapPin size={12} className="mr-1 text-gray-400 shrink-0" />
                          {office.address}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      {office.phone ? (
                        <span className="flex items-center">
                          <Phone size={12} className="mr-1 text-gray-400 shrink-0" />
                          {office.phone}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold">
                      <Link
                        to={`/ceo/employees?officeId=${office.id}`}
                        className="inline-block px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-mono font-medium transition-colors"
                        title="View employees in this office"
                      >
                        {office.employeeCount || 0} Staff
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(office.id, office.status || 'ACTIVE')}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                          (office.status || 'ACTIVE') === 'ACTIVE'
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                        title="Click to toggle status"
                      >
                        {(office.status || 'ACTIVE') === 'ACTIVE' ? (
                          <>
                            <CheckCircle2 size={12} className="mr-1 text-green-600" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle size={12} className="mr-1 text-red-600" /> Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(office)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors"
                        title="Edit Office Details"
                      >
                        <Edit2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Office Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 text-sm">
                {isEditing ? 'Edit Branch Office' : 'Add New Branch Office'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveOffice} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Office / Branch Name *
                </label>
                <input
                  type="text"
                  required
                  value={modalData.name}
                  onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
                  placeholder="e.g. North Zone Depot / Office B"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Office Address
                </label>
                <textarea
                  rows={2}
                  value={modalData.address}
                  onChange={(e) => setModalData({ ...modalData, address: e.target.value })}
                  placeholder="e.g. Plot 12, Industrial Area, Sector 4"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  value={modalData.phone}
                  onChange={(e) => setModalData({ ...modalData, phone: e.target.value })}
                  placeholder="+91 98765 00000"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : isEditing ? 'Update Office' : 'Create Office'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CeoOffices;
