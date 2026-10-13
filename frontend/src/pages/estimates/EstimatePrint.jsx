import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import api from '../../services/api';

const EstimatePrint = () => {
  const { id } = useParams();
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEstimate = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/estimates/${id}`);
        setEstimate(res.data);
      } catch (err) {
        console.error(err);
        setError('Failed to load estimate for printing.');
      } finally {
        setLoading(false);
      }
    };

    fetchEstimate();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

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
        <span className="text-gray-500 text-sm">Preparing estimate slip...</span>
      </div>
    );
  }

  if (error || !estimate) {
    return (
      <div className="p-8 text-center text-red-600">
        {error || 'Estimate not found.'}
      </div>
    );
  }

  return (
    <div className="py-6 px-4 max-w-4xl mx-auto space-y-6">
      {/* Screen-only Controls (Hidden when printed) */}
      <div className="print:hidden flex justify-between items-center bg-white p-4 rounded-xl shadow-xs border border-gray-200">
        <Link
          to={`/estimates/${estimate.id}`}
          className="text-gray-600 hover:text-gray-900 text-sm font-medium flex items-center"
        >
          <ArrowLeft size={16} className="mr-1.5" />
          Back to Estimate View
        </Link>
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center shadow-sm transition-colors"
        >
          <Printer size={16} className="mr-2" />
          Print / Save as PDF
        </button>
      </div>

      {/* Actual Client Estimate Document Structure: "Estimate (K)" */}
      <div className="bg-white p-8 md:p-12 border-2 border-gray-800 rounded-sm print:border-2 print:border-black print:p-6 print:m-0 print:shadow-none text-gray-900 font-sans shadow-lg">
        {/* DOCUMENT TITLE */}
        <div className="text-center pb-4 border-b-2 border-gray-800">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-wider uppercase text-black">
            Estimate (K)
          </h1>
          {estimate.Organization && (
            <p className="text-sm font-semibold text-gray-700 mt-1 uppercase">
              {estimate.Organization.name}
            </p>
          )}
        </div>

        {/* HEADER INFORMATION SECTION */}
        <div className="grid grid-cols-2 gap-4 py-4 border-b-2 border-gray-800 text-sm font-medium">
          {/* Left Column: Sold Customer */}
          <div className="space-y-1.5">
            <div>
              <span className="font-bold text-black uppercase">Sold: </span>
              <span className="font-semibold text-gray-900">
                {estimate.Customer ? estimate.Customer.name : 'Unknown Customer'}
              </span>
            </div>
            {estimate.Customer?.address && (
              <div className="text-xs text-gray-600 pl-11">
                {estimate.Customer.address}
              </div>
            )}
            {estimate.Customer?.city && (
              <div className="text-xs text-gray-600 pl-11">
                City: {estimate.Customer.city}
              </div>
            )}
            {estimate.Customer?.tin && (
              <div className="text-xs text-gray-600 pl-11">
                TIN: {estimate.Customer.tin}
              </div>
            )}
          </div>

          {/* Right Column: Inv No., Dt., Basic */}
          <div className="space-y-1.5 text-right sm:text-left sm:pl-8">
            <div>
              <span className="font-bold text-black uppercase">Inv No.: </span>
              <span className="font-mono font-bold text-gray-900">
                {estimate.estimateNumber}
              </span>
            </div>
            <div>
              <span className="font-bold text-black uppercase">Dt.: </span>
              <span className="font-mono text-gray-800">
                {estimate.estimateDate}
              </span>
            </div>
            <div>
              <span className="font-bold text-black uppercase">Basic: </span>
              <span className="font-mono font-medium text-gray-800">
                {estimate.basic || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* CLIENT PRODUCT TABLE */}
        <div className="pt-2">
          <table className="w-full text-left border-collapse border border-gray-800">
            <thead>
              <tr className="border-b-2 border-gray-800 bg-gray-50 print:bg-transparent text-xs font-bold uppercase tracking-wider text-black">
                <th className="border-r border-gray-800 px-3 py-2.5 w-10 text-center">S.N.</th>
                <th className="border-r border-gray-800 px-4 py-2.5">Description Goods</th>
                <th className="border-r border-gray-800 px-3 py-2.5 w-24 text-center">Btls</th>
                <th className="border-r border-gray-800 px-4 py-2.5 w-28 text-right">Quantity</th>
                <th className="border-r border-gray-800 px-4 py-2.5 w-28 text-right">Rate</th>
                <th className="px-4 py-2.5 w-32 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-sm">
              {estimate.items && estimate.items.map((row, idx) => (
                <tr key={row.id || idx} className="border-b border-gray-800">
                  <td className="border-r border-gray-800 px-3 py-2 text-center text-xs font-mono">
                    {idx + 1}
                  </td>
                  <td className="border-r border-gray-800 px-4 py-2 font-medium">
                    {row.productNameSnapshot}
                  </td>
                  <td className="border-r border-gray-800 px-3 py-2 text-center font-mono text-xs">
                    {row.btls || '-'}
                  </td>
                  <td className="border-r border-gray-800 px-4 py-2 text-right font-mono font-medium">
                    {row.quantity} <span className="text-xs font-normal">{row.unit}</span>
                  </td>
                  <td className="border-r border-gray-800 px-4 py-2 text-right font-mono">
                    {formatCurrency(row.negotiatedRate)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-bold">
                    {formatCurrency(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CLIENT BOTTOM SUMMARY SECTION */}
        <div className="border-t-2 border-gray-800 mt-0 pt-4 grid grid-cols-2 gap-4">
          {/* Bottom Left: Total Quantity */}
          <div className="space-y-3">
            <div className="border border-gray-800 p-3 bg-gray-50 print:bg-transparent rounded-xs">
              <span className="font-bold text-black uppercase text-sm block">Total Quantity:</span>
              <span className="text-lg font-mono font-bold text-gray-900 mt-1 block">
                {estimate.totalQuantity}
              </span>
            </div>

            {estimate.notes && (
              <p className="text-xs text-gray-600 italic">
                Notes: {estimate.notes}
              </p>
            )}
          </div>

          {/* Bottom Right: Total, Others, and Final Balance */}
          <div className="border border-gray-800 p-3 bg-gray-50 print:bg-transparent rounded-xs space-y-2">
            <div className="flex justify-between items-center text-sm font-semibold">
              <span className="uppercase text-black">Total:</span>
              <span className="font-mono text-base font-bold">
                {formatCurrency(estimate.total)}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm font-semibold">
              <span className="uppercase text-black">Others:</span>
              <span className="font-mono text-sm">
                {formatCurrency(estimate.others)}
              </span>
            </div>

            <div className="border-t-2 border-gray-800 pt-2 flex justify-between items-center text-base font-extrabold text-black">
              <span className="uppercase">Grand Total:</span>
              <span className="font-mono text-lg text-black">
                {formatCurrency(estimate.grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Signature Lines */}
        <div className="pt-16 grid grid-cols-2 text-xs font-semibold uppercase tracking-wider text-gray-700">
          <div>
            <div className="w-48 border-t border-gray-800 pt-1 text-center">
              Customer Signature
            </div>
          </div>
          <div className="text-right flex justify-end">
            <div className="w-48 border-t border-gray-800 pt-1 text-center">
              Authorised Signatory
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstimatePrint;
