import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import api from '../../services/api';

const PurchasePrint = () => {
  const { id } = useParams();
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPurchase = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/purchases/${id}`);
        setPurchase(res.data);
      } catch (err) {
        console.error(err);
        setError('Failed to load purchase order for printing.');
      } finally {
        setLoading(false);
      }
    };

    fetchPurchase();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const cleanSerialNumber = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    if (/^[0-9]+$/.test(str)) {
      return String(parseInt(str, 10));
    }
    const match = str.match(/\d+$/);
    if (match) {
      return String(parseInt(match[0], 10));
    }
    return str;
  };

  const formatNumber = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  if (loading) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
        <span className="text-gray-500 text-sm">Preparing purchase order slip...</span>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="p-8 text-center text-red-600 font-bold">
        {error || 'Purchase Order not found.'}
      </div>
    );
  }

  const items = purchase.items || [];
  const minRows = 8;
  const emptyRowsCount = Math.max(0, minRows - items.length);
  const emptyRows = Array.from({ length: emptyRowsCount });

  const totalQty = parseFloat(purchase.totalQuantity || purchase.totalOrderedQuantity || 0).toFixed(3);
  const grandTotal = formatNumber(purchase.totalAmount || 0);

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-2 flex flex-col items-center font-sans">
      
      {/* Print Stylesheet */}
      <style>{`
        @page {
          size: 140mm auto;
          margin: 4mm 5mm 4mm 5mm;
        }
        @media print {
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .slip-container {
            box-shadow: none !important;
            border: 1px solid black !important;
            margin: 0 auto !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 140mm !important;
          }
        }
      `}</style>

      {/* Screen Controls Header (Hidden while printing) */}
      <div className="no-print w-full max-w-[140mm] mb-4 flex items-center justify-between bg-white px-4 py-2.5 rounded-lg border border-slate-300 shadow-xs">
        <Link
          to={`/purchase-order?purchaseId=${purchase.id}`}
          className="text-slate-600 hover:text-slate-900 text-xs font-semibold flex items-center"
        >
          <ArrowLeft size={14} className="mr-1" />
          Back to Purchase Order
        </Link>
        <button
          onClick={handlePrint}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
        >
          <Printer size={14} />
          Print Purchase Order Slip
        </button>
      </div>

      {/* Purchase Order Slip Container */}
      <div className="slip-container w-[138mm] max-w-full bg-white text-black p-2 border-2 border-black shadow-lg">
        
        {/* TOP HEADER BOX */}
        <div className="border-2 border-black rounded-lg py-1 px-4 text-center mb-1 bg-white">
          <h1 className="text-xl md:text-2xl font-bold tracking-wide text-black uppercase">
            Purchase Order
          </h1>
          {purchase.Organization && (
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {purchase.Organization.name}
            </div>
          )}
        </div>

        {/* SUB-HEADER: Supplier/Party on Left | Order No, Date on Right */}
        <div className="border border-black flex mb-0 text-xs font-sans">
          {/* Left Column: Vendor / Party */}
          <div className="w-[60%] p-1.5 border-r border-black flex flex-col justify-start">
            <div className="font-bold">
              <span>Party : </span>
              <span className="uppercase font-extrabold">{purchase.vendorName || purchase.partyName || 'DIRECT SUPPLIER'}</span>
            </div>
            {purchase.remarks && (
              <div className="text-[11px] text-slate-700 pt-1">
                Remark: {purchase.remarks}
              </div>
            )}
          </div>

          {/* Right Column: Order No., Date */}
          <div className="w-[40%] flex flex-col divide-y divide-black text-xs font-mono">
            <div className="px-2 py-0.5 flex justify-between items-center">
              <span className="font-sans font-bold">Serial No.</span>
              <span className="font-bold text-sm">{cleanSerialNumber(purchase.purchaseNumber)}</span>
            </div>
            <div className="px-2 py-0.5 flex justify-between items-center">
              <span className="font-sans font-bold">Date</span>
              <span>{purchase.purchaseDate}</span>
            </div>
            <div className="px-2 py-0.5 flex justify-between items-center">
              <span className="font-sans font-bold">Status</span>
              <span className="font-bold uppercase text-[11px]">{purchase.status || 'Pending'}</span>
            </div>
          </div>
        </div>

        {/* PRODUCT ITEMS GRID */}
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="border-b border-black text-[11px] font-bold text-black uppercase bg-slate-50">
              <th className="border-r border-black py-1 px-1.5 text-left">Item Description</th>
              <th className="border-r border-black py-1 px-1.5 w-20 text-right">Qty</th>
              <th className="border-r border-black py-1 px-1.5 w-20 text-right">Price</th>
              <th className="py-1 px-1.5 w-24 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y-0 text-xs font-mono">
            {items.map((row, idx) => {
              const name = (row.productNameSnapshot || row.productName || row.Product?.name || '').trim();
              const desc = (row.productSpecificationsSnapshot || row.specifications || row.Product?.specifications || '').trim();
              const qty = parseFloat(row.quantity || 0);
              const rate = parseFloat(row.rate || row.price || 0);
              const amt = parseFloat(row.amount || (qty * rate) || 0);

              return (
                <tr key={row.id || idx} className="h-5">
                  <td className="border-r border-black py-0.5 px-1.5 truncate">
                    <span className="font-bold">{name}</span>
                    {desc && <span className="text-[10px] text-slate-600 block">{desc}</span>}
                  </td>
                  <td className="border-r border-black py-0.5 px-1.5 text-right">
                    {qty.toFixed(3)}
                  </td>
                  <td className="border-r border-black py-0.5 px-1.5 text-right">
                    {formatNumber(rate)}
                  </td>
                  <td className="py-0.5 px-1.5 text-right font-bold">
                    {formatNumber(amt)}
                  </td>
                </tr>
              );
            })}

            {/* Fill minimum blank visual rows */}
            {emptyRows.map((_, idx) => (
              <tr key={`empty-${idx}`} className="h-5">
                <td className="border-r border-black py-0.5 px-1.5">&nbsp;</td>
                <td className="border-r border-black py-0.5 px-1.5">&nbsp;</td>
                <td className="border-r border-black py-0.5 px-1.5">&nbsp;</td>
                <td className="py-0.5 px-1.5">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTALS BAR */}
        <div className="border border-t-0 border-black flex items-center justify-between px-2 py-1 bg-slate-50 text-xs font-bold font-mono">
          <div className="flex items-center space-x-2">
            <span>Total Qty:</span>
            <span className="text-black font-extrabold">{totalQty}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="uppercase font-sans">Grand Total:</span>
            <span className="text-sm font-extrabold text-black font-mono">₹ {grandTotal}</span>
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-6 pt-2 flex justify-between items-end text-[10px] text-slate-700">
          <div>
            <span>Prepared By: </span>
            <span className="font-bold">{purchase.creator?.username || 'Admin'}</span>
          </div>
          <div className="border-t border-black pt-1 w-32 text-center font-bold">
            Authorized Signatory
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchasePrint;
