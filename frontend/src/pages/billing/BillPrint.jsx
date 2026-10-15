import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { getBillById } from '../../services/billingService';

const BillPrint = () => {
  const { id } = useParams();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBill = async () => {
      try {
        setLoading(true);
        const data = await getBillById(id);
        setBill(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load bill for printing.');
      } finally {
        setLoading(false);
      }
    };

    fetchBill();
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
        <span className="text-gray-500 text-sm">Preparing printable bill voucher...</span>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="p-8 text-center text-red-600">
        {error || 'Bill not found.'}
      </div>
    );
  }

  const subtotal = parseFloat(bill.productSubtotal) || 0;
  const gstPct = parseFloat(bill.gstPercentage) || 0;
  const gstAmt = parseFloat(bill.gstAmount) || 0;
  const transport = parseFloat(bill.transportCost) || 0;
  const finalAmt = parseFloat(bill.finalAmount) || 0;

  const totalQuantity = bill.items?.reduce((acc, curr) => acc + (parseFloat(curr.quantity) || 0), 0) || 0;

  return (
    <div className="py-6 px-4 max-w-4xl mx-auto space-y-6">
      {/* Screen-only Controls (Hidden when printed) */}
      <div className="print:hidden flex justify-between items-center bg-white p-4 rounded-xl shadow-xs border border-gray-200">
        <Link
          to={`/bills/${bill.id}`}
          className="text-gray-600 hover:text-gray-900 text-sm font-medium flex items-center"
        >
          <ArrowLeft size={16} className="mr-1.5" />
          Back to Bill View
        </Link>
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center shadow-sm transition-colors"
        >
          <Printer size={16} className="mr-2" />
          Print / Save as PDF
        </button>
      </div>

      {/* Sale Voucher Document Structure */}
      <div className="bg-white p-8 md:p-12 border-2 border-gray-900 rounded-sm print:border-2 print:border-black print:p-6 print:m-0 print:shadow-none text-gray-900 font-sans shadow-lg">
        {/* DOCUMENT HEADER */}
        <div className="text-center pb-4 border-b-2 border-gray-900">
          <h1 className="text-2xl md:text-3xl font-black tracking-wider uppercase text-black">
            SALE VOUCHER / BILL
          </h1>
          {bill.Organization && (
            <div className="mt-1">
              <p className="text-base font-bold text-gray-900 uppercase">
                {bill.Organization.name}
              </p>
              {bill.Organization.address && (
                <p className="text-xs text-gray-600">
                  {bill.Organization.address}
                </p>
              )}
              {bill.Organization.phone && (
                <p className="text-xs text-gray-600">
                  Phone: {bill.Organization.phone}
                </p>
              )}
            </div>
          )}
        </div>

        {/* HEADER INFORMATION SECTION */}
        <div className="grid grid-cols-2 gap-4 py-4 border-b-2 border-gray-900 text-sm font-medium">
          {/* Left Column: Buyer / Customer */}
          <div className="space-y-1">
            <div>
              <span className="font-bold text-black uppercase">Buyer / Sold To: </span>
              <span className="font-bold text-gray-900">
                {bill.Customer ? bill.Customer.name : 'Unknown Customer'}
              </span>
            </div>
            {bill.Customer?.address && (
              <div className="text-xs text-gray-700 pl-4">
                {bill.Customer.address}
              </div>
            )}
            {bill.Customer?.city && (
              <div className="text-xs text-gray-700 pl-4">
                City: {bill.Customer.city}
              </div>
            )}
            {bill.Customer?.tin && (
              <div className="text-xs text-gray-700 pl-4">
                TIN / GSTIN: {bill.Customer.tin}
              </div>
            )}
            {bill.Customer?.phone && (
              <div className="text-xs text-gray-700 pl-4">
                Phone: {bill.Customer.phone}
              </div>
            )}
          </div>

          {/* Right Column: Bill No., Date, Estimate Ref */}
          <div className="space-y-1.5 text-right sm:text-left sm:pl-8">
            <div>
              <span className="font-bold text-black uppercase">Bill No.: </span>
              <span className="font-mono font-bold text-gray-900">
                {bill.billNumber}
              </span>
            </div>
            <div>
              <span className="font-bold text-black uppercase">Date: </span>
              <span className="font-mono text-gray-800">
                {bill.billDate}
              </span>
            </div>
            {bill.Estimate && (
              <div>
                <span className="font-bold text-black uppercase">Ref Estimate: </span>
                <span className="font-mono text-indigo-800 font-semibold">
                  {bill.Estimate.estimateNumber}
                </span>
              </div>
            )}
            <div>
              <span className="font-bold text-black uppercase">Status: </span>
              <span className="font-mono text-xs uppercase px-2 py-0.5 rounded bg-gray-100 font-bold">
                {bill.status}
              </span>
            </div>
          </div>
        </div>

        {/* PRODUCT TABLE */}
        <div className="pt-2">
          <table className="w-full text-left border-collapse border border-gray-900">
            <thead>
              <tr className="border-b-2 border-gray-900 bg-gray-100 print:bg-transparent text-xs font-bold uppercase tracking-wider text-black">
                <th className="border-r border-gray-900 px-3 py-2 w-10 text-center">S.N.</th>
                <th className="border-r border-gray-900 px-4 py-2">Description Goods</th>
                <th className="border-r border-gray-900 px-3 py-2 w-20 text-center">Btls</th>
                <th className="border-r border-gray-900 px-4 py-2 w-24 text-right">Quantity</th>
                <th className="border-r border-gray-900 px-3 py-2 w-16 text-center">Unit</th>
                <th className="border-r border-gray-900 px-4 py-2 w-24 text-right">Rate</th>
                <th className="px-4 py-2 w-32 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900 text-sm">
              {bill.items && bill.items.map((row, idx) => (
                <tr key={row.id || idx} className="border-b border-gray-900">
                  <td className="border-r border-gray-900 px-3 py-2 text-center text-xs font-mono">
                    {idx + 1}
                  </td>
                  <td className="border-r border-gray-900 px-4 py-2 font-medium">
                    <div>{row.productNameSnapshot}</div>
                    {row.productSizeSnapshot && (
                      <span className="text-xs text-gray-600 mr-2">Size: {row.productSizeSnapshot}</span>
                    )}
                    {row.productCategorySnapshot && (
                      <span className="text-xs text-gray-500 mr-2">({row.productCategorySnapshot})</span>
                    )}
                    {row.productSpecificationsSnapshot && (
                      <span className="text-xs text-gray-500 italic block">{row.productSpecificationsSnapshot}</span>
                    )}
                  </td>
                  <td className="border-r border-gray-900 px-3 py-2 text-center font-mono">
                    {row.btls || '-'}
                  </td>
                  <td className="border-r border-gray-900 px-4 py-2 text-right font-mono font-medium">
                    {parseFloat(row.quantity).toFixed(3)}
                  </td>
                  <td className="border-r border-gray-900 px-3 py-2 text-center text-xs">
                    {row.unit || 'Kg'}
                  </td>
                  <td className="border-r border-gray-900 px-4 py-2 text-right font-mono">
                    {parseFloat(row.rate).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-bold">
                    {parseFloat(row.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FINANCIAL SUMMARY & TOTALS */}
        <div className="mt-4 border-2 border-gray-900 p-4 space-y-2 text-sm font-medium">
          <div className="flex justify-between border-b border-gray-300 pb-2">
            <span className="font-bold uppercase text-gray-800">Total Quantity:</span>
            <span className="font-mono font-bold text-gray-900">
              {totalQuantity.toFixed(3)}
            </span>
          </div>

          <div className="flex justify-between border-b border-gray-300 pb-2">
            <span className="font-bold uppercase text-gray-800">Product Subtotal:</span>
            <span className="font-mono font-bold text-gray-900">
              {formatCurrency(subtotal)}
            </span>
          </div>

          <div className="flex justify-between border-b border-gray-300 pb-2 text-xs">
            <span className="font-bold uppercase text-gray-700">
              GST ({gstPct}%):
            </span>
            <span className="font-mono font-bold text-gray-800">
              + {formatCurrency(gstAmt)}
            </span>
          </div>

          <div className="flex justify-between border-b border-gray-300 pb-2 text-xs">
            <span className="font-bold uppercase text-gray-700">
              Transportation Charges:
            </span>
            <span className="font-mono font-bold text-gray-800">
              + {formatCurrency(transport)}
            </span>
          </div>

          <div className="flex justify-between pt-1 text-base">
            <span className="font-black uppercase tracking-wider text-black">
              Net Payable (Final Bill Amount):
            </span>
            <span className="font-mono font-black text-xl text-black">
              {formatCurrency(finalAmt)}
            </span>
          </div>
        </div>

        {/* NOTES SECTION */}
        {bill.notes && (
          <div className="mt-4 p-3 border border-gray-800 text-xs">
            <span className="font-bold uppercase block text-gray-700 mb-0.5">Notes:</span>
            <p className="whitespace-pre-wrap text-gray-800">{bill.notes}</p>
          </div>
        )}

        {/* SIGNATURE SECTION */}
        <div className="grid grid-cols-3 gap-6 pt-16 mt-8 text-center text-xs font-bold uppercase border-t-2 border-gray-900">
          <div>
            <div className="border-t border-gray-900 pt-2 w-3/4 mx-auto">
              Customer / Receiver
            </div>
          </div>
          <div>
            <div className="border-t border-gray-900 pt-2 w-3/4 mx-auto">
              Prepared By: {bill.creator?.username || 'Authorized Staff'}
            </div>
          </div>
          <div>
            <div className="border-t border-gray-900 pt-2 w-3/4 mx-auto">
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillPrint;
