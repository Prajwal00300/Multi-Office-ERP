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
        <span className="text-gray-500 text-sm">Preparing estimate slip...</span>
      </div>
    );
  }

  if (error || !estimate) {
    return (
      <div className="p-8 text-center text-red-600 font-bold">
        {error || 'Estimate not found.'}
      </div>
    );
  }

  const items = estimate.items || [];
  const minRows = 10;
  const emptyRowsCount = Math.max(0, minRows - items.length);
  const emptyRows = Array.from({ length: emptyRowsCount });

  const totalQty = parseFloat(estimate.totalQuantity || 0).toFixed(3);
  const subtotal = formatNumber(estimate.total || estimate.basic || 0);
  const othersVal = parseFloat(estimate.others || 0);
  const grandTotal = formatNumber(estimate.grandTotal || estimate.total || 0);

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-2 flex flex-col items-center font-sans">
      
      {/* Print Stylesheet for exact 140mm continuous slip paper */}
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
          to={`/estimates/${estimate.id}`}
          className="text-slate-600 hover:text-slate-900 text-xs font-semibold flex items-center"
        >
          <ArrowLeft size={14} className="mr-1" />
          Back
        </Link>
        <button
          onClick={handlePrint}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
        >
          <Printer size={14} />
          Print Estimate Slip
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CLIENT EXACT REPRODUCED SLIP: "Estimate (K)"
         ───────────────────────────────────────────────────────────── */}
      <div className="slip-container w-[138mm] max-w-full bg-white text-black p-2 border-2 border-black shadow-lg">
        
        {/* 1. TOP HEADER BOX: Rounded box with "Estimate (K)" */}
        <div className="border-2 border-black rounded-lg py-1 px-4 text-center mb-1 bg-white">
          <h1 className="text-xl md:text-2xl font-bold tracking-wide text-black uppercase">
            Estimate (K)
          </h1>
        </div>

        {/* 2. SUB-HEADER: Sold : Customer on Left | Inv No, Dt, Basic on Right */}
        <div className="border border-black flex mb-0 text-xs font-sans">
          {/* Left Column: Sold Customer */}
          <div className="w-[58%] p-1.5 border-r border-black flex flex-col justify-start">
            <div className="font-bold">
              <span>Sold : </span>
              <span className="uppercase font-extrabold">{estimate.Customer?.name || 'CASH / DIRECT'}</span>
            </div>
            {estimate.Customer?.city && (
              <div className="text-[11px] text-slate-700 pl-11">
                {estimate.Customer.city}
              </div>
            )}
            {estimate.Customer?.tin && (
              <div className="text-[11px] text-slate-700 pl-11 font-mono">
                TIN: {estimate.Customer.tin}
              </div>
            )}
          </div>

          {/* Right Column: Inv No., Dt., Basic */}
          <div className="w-[42%] flex flex-col divide-y divide-black text-xs font-mono">
            <div className="px-2 py-0.5 flex justify-between items-center">
              <span className="font-sans font-bold">Inv No.</span>
              <span className="font-bold text-sm">{estimate.estimateNumber}</span>
            </div>
            <div className="px-2 py-0.5 flex justify-between items-center">
              <span className="font-sans font-bold">Dt.</span>
              <span>{estimate.estimateDate}</span>
            </div>
            <div className="px-2 py-0.5 flex justify-between items-center">
              <span className="font-sans font-bold">Basic</span>
              <span className="font-bold">{estimate.basic || '-'}</span>
            </div>
          </div>
        </div>

        {/* 3. PRODUCT ITEMS GRID */}
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="border-b border-black text-[11px] font-bold text-black uppercase">
              <th className="border-r border-black py-1 px-1.5 text-left">Description Goods</th>
              <th className="border-r border-black py-1 px-1 w-10 text-center">Bdls</th>
              <th className="border-r border-black py-1 px-1.5 w-16 text-right">Quantity</th>
              <th className="border-r border-black py-1 px-1.5 w-16 text-right">Rate</th>
              <th className="py-1 px-1.5 w-24 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y-0 text-xs font-mono">
            {/* Populated Line Items */}
            {items.map((row, idx) => {
              const itemDesc = (row.productSpecificationsSnapshot || row.description || row.Product?.specifications || '').trim();
              return (
                <tr key={idx} className="leading-tight">
                  <td className="border-r border-black px-1.5 py-1 text-left font-sans text-xs">
                    <div className="font-bold text-black">{row.productNameSnapshot}</div>
                    {itemDesc && itemDesc !== row.productNameSnapshot && (
                      <div className="text-[11px] font-semibold text-black mt-0.5">
                        {itemDesc}
                      </div>
                    )}
                  </td>
                <td className="border-r border-black px-1 py-0.5 text-center text-xs">
                  {row.btls || '0'}
                </td>
                <td className="border-r border-black px-1.5 py-0.5 text-right font-bold text-xs">
                  {parseFloat(row.quantity || 0).toFixed(3)}
                </td>
                <td className="border-r border-black px-1.5 py-0.5 text-right text-xs">
                  {parseFloat(row.rate || row.negotiatedRate || 0).toFixed(0)}
                </td>
                <td className="px-1.5 py-0.5 text-right font-bold text-xs">
                  {formatNumber(row.amount)}
                </td>
              </tr>
            ); })}

            {/* Empty Spacer Rows maintaining clean vertical grid lines down the slip */}
            {emptyRows.map((_, idx) => (
              <tr key={`empty-${idx}`} className="h-4 leading-tight">
                <td className="border-r border-black px-1.5 py-0.5">&nbsp;</td>
                <td className="border-r border-black px-1 py-0.5">&nbsp;</td>
                <td className="border-r border-black px-1.5 py-0.5">&nbsp;</td>
                <td className="border-r border-black px-1.5 py-0.5">&nbsp;</td>
                <td className="px-1.5 py-0.5">&nbsp;</td>
              </tr>
            ))}

            {/* Total Row on the right side */}
            <tr className="border-t border-black">
              <td colSpan={3} className="border-r border-black"></td>
              <td className="border-r border-black px-1.5 py-0.5 font-sans font-bold text-left text-xs">
                Total
              </td>
              <td className="px-1.5 py-0.5 text-right font-mono font-bold text-xs">
                {subtotal}
              </td>
            </tr>

            {/* Others Row */}
            <tr className="border-t border-black">
              <td colSpan={3} className="border-r border-black"></td>
              <td className="border-r border-black px-1.5 py-0.5 font-sans font-bold text-left text-xs">
                Others
              </td>
              <td className="px-1.5 py-0.5 text-right font-mono text-xs">
                {othersVal > 0 ? formatNumber(othersVal) : ''}
              </td>
            </tr>
          </tbody>

          {/* 4. BOTTOM SUMMARY ROW: Total | Total Qty | Grand Total Amount */}
          <tfoot>
            <tr className="border-t-2 border-black bg-white font-bold text-xs">
              <td colSpan={2} className="border-r border-black px-2 py-1 font-sans text-left uppercase text-sm">
                Total
              </td>
              <td className="border-r border-black px-1.5 py-1 text-right font-mono font-bold text-xs">
                {totalQty}
              </td>
              <td className="border-r border-black px-1.5 py-1"></td>
              <td className="px-1.5 py-1 text-right font-mono font-extrabold text-xs">
                {grandTotal}
              </td>
            </tr>
          </tfoot>
        </table>

      </div>
    </div>
  );
};

export default EstimatePrint;
