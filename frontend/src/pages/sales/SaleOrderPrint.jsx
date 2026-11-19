import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import api from '../../services/api';

const SaleOrderPrint = () => {
  const { id } = useParams();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSale = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/sale-orders/${id}`);
        setSale(res.data);
      } catch (err) {
        console.error(err);
        setError('Failed to load sale order for printing.');
      } finally {
        setLoading(false);
      }
    };

    fetchSale();
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
        <span className="text-gray-500 text-sm">Preparing sale order slip...</span>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="p-8 text-center text-red-600 font-bold">
        {error || 'Sale Order not found.'}
      </div>
    );
  }

  const items = sale.items || [];
  const minRows = 8;
  const emptyRowsCount = Math.max(0, minRows - items.length);
  const emptyRows = Array.from({ length: emptyRowsCount });

  const totalQty = parseFloat(sale.totalQuantity || 0).toFixed(3);
  const grandTotal = formatNumber(sale.totalAmount || 0);

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
          to={`/sales/${sale.id}`}
          className="text-slate-600 hover:text-slate-900 text-xs font-semibold flex items-center"
        >
          <ArrowLeft size={14} className="mr-1" />
          Back to Order
        </Link>
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
        >
          <Printer size={14} />
          Print Order Slip
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          140mm THERMAL SALE ORDER SLIP
         ───────────────────────────────────────────────────────────── */}
      <div className="slip-container w-[138mm] max-w-full bg-white text-black p-2 border-2 border-black shadow-lg">
        
        {/* 1. TOP HEADER BOX: Rounded box with "Sale Order" */}
        <div className="border-2 border-black rounded-lg py-1 px-4 text-center mb-1 bg-white">
          <h1 className="text-xl md:text-2xl font-bold tracking-wide text-black uppercase">
            Sale Order
          </h1>
        </div>

        {/* 2. SUB-HEADER: Customer / Buyer on Left | Serial No, Date on Right */}
        <div className="border border-black flex mb-0 text-xs font-sans">
          {/* Left Column: Customer Details */}
          <div className="w-[58%] p-1.5 border-r border-black flex flex-col justify-start">
            <div className="font-bold">
              <span>Customer : </span>
              <span className="uppercase font-extrabold">{sale.customerName || sale.Customer?.name || 'DIRECT CUSTOMER'}</span>
            </div>
            {sale.Customer?.city && (
              <div className="text-[11px] text-gray-800">
                <span>City: </span>{sale.Customer.city}
              </div>
            )}
            {sale.Customer?.tin && (
              <div className="text-[11px] text-gray-800">
                <span>TIN: </span>{sale.Customer.tin}
              </div>
            )}
            {sale.Organization?.name && (
              <div className="text-[11px] text-gray-800 mt-1">
                <span>Office: </span>{sale.Organization.name}
              </div>
            )}
          </div>

          {/* Right Column: Serial No, Date, Status */}
          <div className="w-[42%] text-[11px]">
            <div className="flex border-b border-black">
              <span className="w-16 px-1.5 py-0.5 font-bold border-r border-black">Order No</span>
              <span className="px-1.5 py-0.5 font-bold text-base">{cleanSerialNumber(sale.orderNumber)}</span>
            </div>
            <div className="flex border-b border-black">
              <span className="w-16 px-1.5 py-0.5 font-bold border-r border-black">Date</span>
              <span className="px-1.5 py-0.5">{sale.orderDate}</span>
            </div>
            <div className="flex">
              <span className="w-16 px-1.5 py-0.5 font-bold border-r border-black">Status</span>
              <span className="px-1.5 py-0.5 font-semibold text-emerald-800">{sale.status || 'Pending'}</span>
            </div>
          </div>
        </div>

        {/* 3. PRODUCT ITEMS TABLE */}
        <div className="border border-t-0 border-black mb-0 overflow-hidden">
          <table className="w-full border-collapse text-xs font-sans">
            <thead>
              <tr className="border-b border-black text-[11px] font-bold text-center bg-gray-50">
                <th className="border-r border-black py-0.5 px-1 w-7">Sr</th>
                <th className="border-r border-black py-0.5 px-1 text-left">Item Description</th>
                <th className="border-r border-black py-0.5 px-1 w-16 text-center">Carbon</th>
                <th className="border-r border-black py-0.5 px-1 w-16 text-right">Qty (T)</th>
                <th className="border-r border-black py-0.5 px-1 w-18 text-right">Price</th>
                <th className="py-0.5 px-1 w-22 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const qtyNum = parseFloat(it.quantity) || 0;
                const rateNum = parseFloat(it.rate) || 0;
                const amtNum = parseFloat(it.amount) || (qtyNum * rateNum);

                return (
                  <tr key={it.id || idx} className="border-b border-black/40 text-[11px] leading-tight">
                    <td className="border-r border-black text-center py-0.5 px-1">{idx + 1}</td>
                    <td className="border-r border-black py-0.5 px-1 font-semibold">
                      {it.productNameSnapshot}
                      {it.productSpecificationsSnapshot && (
                        <span className="block text-[10px] text-gray-600 font-normal">
                          {it.productSpecificationsSnapshot}
                        </span>
                      )}
                    </td>
                    <td className="border-r border-black text-center py-0.5 px-1">
                      {it.carbonType === 'High Carbon' ? 'HC' : 'LC'}
                    </td>
                    <td className="border-r border-black text-right py-0.5 px-1 font-mono">
                      {qtyNum.toFixed(3)}
                    </td>
                    <td className="border-r border-black text-right py-0.5 px-1 font-mono">
                      {formatNumber(rateNum)}
                    </td>
                    <td className="text-right py-0.5 px-1 font-mono font-semibold">
                      {formatNumber(amtNum)}
                    </td>
                  </tr>
                );
              })}

              {/* Pad with empty rows to preserve slip height */}
              {emptyRows.map((_, i) => (
                <tr key={`empty-${i}`} className="border-b border-black/30 text-[11px] h-5">
                  <td className="border-r border-black">&nbsp;</td>
                  <td className="border-r border-black">&nbsp;</td>
                  <td className="border-r border-black">&nbsp;</td>
                  <td className="border-r border-black">&nbsp;</td>
                  <td className="border-r border-black">&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. TOTALS SUMMARY BAR */}
        <div className="border border-t-0 border-black flex items-center justify-between px-2 py-1 bg-gray-50 text-xs font-bold font-sans">
          <div className="flex items-center gap-4">
            <span>Total Qty: <span className="font-mono text-sm">{totalQty} T</span></span>
          </div>
          <div>
            <span>Total Amount: <span className="font-mono text-sm">₹ {grandTotal}</span></span>
          </div>
        </div>

        {/* 5. REMARKS */}
        {sale.remarks && (
          <div className="border border-t-0 border-black p-1 text-[11px] text-gray-700 italic">
            <strong>Remarks:</strong> {sale.remarks}
          </div>
        )}

        {/* 6. SIGNATURE SECTION */}
        <div className="border border-t-0 border-black flex justify-between items-end p-2 pt-6 text-[11px] font-sans">
          <div className="text-center">
            <div className="w-32 border-t border-black mb-0.5"></div>
            <span>Customer Signature</span>
          </div>
          <div className="text-center">
            <div className="w-36 border-t border-black mb-0.5"></div>
            <span>Authorized Signatory</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SaleOrderPrint;