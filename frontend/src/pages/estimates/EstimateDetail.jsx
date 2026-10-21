import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Printer, 
  Edit3, 
  Building, 
  User, 
  Calendar, 
  MapPin, 
  Phone, 
  Hash, 
  AlertCircle 
} from 'lucide-react';
import api from '../../services/api';

const EstimateDetail = () => {
  const { id } = useParams();

  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch Estimate Details
  const fetchEstimate = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/estimates/${id}`);
      setEstimate(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to load estimate details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEstimate();
  }, [fetchEstimate]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  if (loading) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
        <span className="text-gray-500 text-sm">Loading estimate details...</span>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="p-8 text-center text-gray-500">
        Estimate not found.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <Link
            to="/estimates"
            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors shadow-xs"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="text-2xl font-bold font-mono text-gray-900">
              {estimate.estimateNumber}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Estimate (K) Document Record
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Print Slip */}
          <Link
            to={`/estimates/${estimate.id}/print`}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center shadow-xs transition-colors"
          >
            <Printer size={16} className="mr-1.5" />
            Print Estimate Slip
          </Link>

          {/* Edit Estimate */}
          <Link
            to={`/estimates/${estimate.id}/edit`}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center shadow-xs transition-colors"
          >
            <Edit3 size={16} className="mr-1.5" />
            Edit Estimate
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center">
          <AlertCircle size={18} className="mr-2 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header Info Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Info */}
        <div className="space-y-2 border-b md:border-b-0 md:border-r border-gray-100 pb-4 md:pb-0 md:pr-4">
          <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
            Customer Information
          </span>
          <h4 className="text-base font-bold text-gray-900">
            {estimate.Customer ? estimate.Customer.name : 'Unknown Customer'}
          </h4>
          {estimate.Customer?.address && (
            <p className="text-xs text-gray-500 flex items-center">
              <MapPin size={13} className="mr-1 text-gray-400 shrink-0" />
              {estimate.Customer.address}, {estimate.Customer.city}
            </p>
          )}
          {estimate.Customer?.phone && (
            <p className="text-xs text-gray-500 flex items-center">
              <Phone size={13} className="mr-1 text-gray-400 shrink-0" />
              Phone: {estimate.Customer.phone}
            </p>
          )}
          {estimate.Customer?.tin && (
            <p className="text-xs text-gray-500 flex items-center">
              <Hash size={13} className="mr-1 text-gray-400 shrink-0" />
              TIN: {estimate.Customer.tin}
            </p>
          )}
        </div>

        {/* Office & Details */}
        <div className="space-y-2 border-b md:border-b-0 md:border-r border-gray-100 pb-4 md:pb-0 md:pr-4">
          <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
            Issuing Office & Date
          </span>
          <h4 className="text-base font-bold text-gray-900 flex items-center">
            <Building size={16} className="mr-1.5 text-blue-600" />
            {estimate.Organization ? estimate.Organization.name : 'Organization'}
          </h4>
          <p className="text-xs text-gray-500 flex items-center">
            <Calendar size={13} className="mr-1 text-gray-400 shrink-0" />
            Dt.: {estimate.estimateDate}
          </p>
          <p className="text-xs text-gray-500 flex items-center">
            <User size={13} className="mr-1 text-gray-400 shrink-0" />
            Created By: {estimate.creator ? estimate.creator.username : 'User'}
          </p>
        </div>

        {/* Basic Header Value */}
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
            Header Label
          </span>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-xs text-gray-500 block">Basic:</span>
            <span className="text-sm font-semibold font-mono text-gray-800">
              {estimate.basic || 'Not Specified'}
            </span>
          </div>
          {estimate.notes && (
            <p className="text-xs text-gray-500 italic mt-2">
              Notes: {estimate.notes}
            </p>
          )}
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">
            Product Goods List (Estimate K)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100/70 text-gray-600 text-xs uppercase tracking-wider font-semibold border-b">
                <th className="px-5 py-3 w-12 text-center">#</th>
                <th className="px-5 py-3">Description Goods</th>
                <th className="px-5 py-3 w-32">Btls</th>
                <th className="px-5 py-3 w-32">Quantity</th>
                <th className="px-5 py-3 w-28">Unit</th>
                <th className="px-5 py-3 w-36">Rate</th>
                <th className="px-5 py-3 w-40 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {estimate.items && estimate.items.map((item, index) => (
                <tr key={item.id || index} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3.5 text-center text-xs text-gray-400 font-mono">
                    {index + 1}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    {item.productNameSnapshot}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 font-mono">
                    {item.btls || '-'}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-gray-800 font-mono">
                    {item.quantity}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-medium">
                      {item.unit}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-700 font-mono font-medium">
                    {formatCurrency(item.negotiatedRate)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-gray-900 font-mono">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="p-5 bg-gray-50/80 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-xs text-gray-500">
            <span>Client document format: </span>
            <span className="font-semibold text-gray-700">Estimate (K)</span>
          </div>

          <div className="w-full md:w-80 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Quantity:</span>
              <span className="font-semibold text-gray-800 font-mono">
                {estimate.totalQuantity}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total:</span>
              <span className="font-semibold text-gray-800 font-mono">
                {formatCurrency(estimate.total)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Others:</span>
              <span className="font-semibold text-gray-800 font-mono">
                {formatCurrency(estimate.others)}
              </span>
            </div>

            <div className="border-t border-gray-200 pt-2 flex justify-between text-base font-bold">
              <span className="text-gray-900">Grand Total:</span>
              <span className="text-blue-700 font-mono font-extrabold text-lg">
                {formatCurrency(estimate.grandTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default EstimateDetail;
