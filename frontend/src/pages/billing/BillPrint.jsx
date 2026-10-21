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
        <span className="text-gray-500 text-sm">Preparing printable bill slip...</span>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="p-8 text-center text-red-600 font-bold">
        {error || 'Bill not found.'}
      </div>
    );
  }

  const items = bill.items || [];
  const minRows = 10;
  const emptyRowsCount = Math.max(0, minRows - items.length);
  const emptyRows = Array.from({ length: emptyRowsCount });

  const totalQuantity = items.reduce((acc, curr) => acc + (parseFloat(curr.quantity) || 0), 0);
  const subtotal = formatNumber(bill.productSubtotal || 0);
  const gstPct = parseFloat(bill.gstPercentage || 0);
  const gstAmt = formatNumber(bill.gstAmount || 0);
  const transport = parseFloat(bill.transportCost || 0);
  const finalAmt = formatNumber(bill.finalAmount || 0);

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
          to={`/bills/${bill.id}`}
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
          Print Bill Slip
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CLIENT EXACT REPRODUCED SLIP: "Sale Voucher"
         ───────────────────────────────────────────────────────────── */}
      <div className="slip-container w-[138mm] max-w-full bg-white text-black p-2 border-2 border-black shadow-lg">
        
        {/* 1. TOP HEADER BOX: Rounded box with "Sale Voucher" */}
        <div className="border-2 border-black rounded-lg py-1 px-4 text-center mb-1 bg-white">
          <h1 className="text-xl md:text-2xl font-bold tracking-wide text-black uppercase">
            Sale Voucher
          </h1>
        </div>

        {/* 2. SUB-HEADER: Sold : Customer on Left | B.No., Dt., TIN/GSTIN on Right */}
        <div className="border border-black flex mb-0 text-xs font-sans">
          {/* Left Column: Sold Customer */}
          <div className="w-[58%] p-1.5 border-r border-black flex flex-col justify-start">
            <div className="font-bold">
              <span>Sold : </span>
              <span className="uppercase font-extrabold">{bill.Customer?.name || 'CASH / DIRECT'}</span>
            </div>
            {bill.Customer?.city && (
              <div className="text-[11px] text-slate-700 pl-11">
                {bill.Customer.city}
              </div>
            )}
            {bill.Customer?.tin && (
              <div className="text-[11px] text-slate-700 pl-11 font-mono">
                TIN: {bill.Customer.tin}
              </div>
            )}
          </div>

          {/* Right Column: B.No., Dt., Ref Est */}
          <div className="w-[42%] flex flex-col divide-y divide-black text-xs font-mono">
            <div className="px-2 py-0.5 flex justify-between items-center">
              <span className="font-sans font-bold">B.No.</span>
              <span className="font-bold text-sm">{bill.billNumber}</span>
            </div>
            <div className="px-2 py-0.5 flex justify-between items-center">
              <span className="font-sans font-bold">Dt.</span>
              <span>{bill.billDate}</span>
            </div>
            <div className="px-2 py-0.5 flex justify-between items-center">
              <span className="font-sans font-bold">Ref Est</span>
              <span className="font-bold">{bill.Estimate?.estimateNumber || '-'}</span>
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
                  {parseFloat(row.rate || 0).toFixed(0)}
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

            {/* Subtotal Row */}
            <tr className="border-t border-black">
              <td colSpan={3} className="border-r border-black"></td>
              <td className="border-r border-black px-1.5 py-0.5 font-sans font-bold text-left text-xs">
                Total
              </td>
              <td className="px-1.5 py-0.5 text-right font-mono font-bold text-xs">
                {subtotal}
              </td>
            </tr>

            {/* GST Row */}
            {gstPct > 0 && (
              <tr className="border-t border-black">
                <td colSpan={3} className="border-r border-black"></td>
                <td className="border-r border-black px-1.5 py-0.5 font-sans font-semibold text-left text-[11px]">
                  GST {gstPct}%
                </td>
                <td className="px-1.5 py-0.5 text-right font-mono text-xs">
                  {gstAmt}
                </td>
              </tr>
            )}

            {/* Transport Charges Row */}
            {transport > 0 && (
              <tr className="border-t border-black">
                <td colSpan={3} className="border-r border-black"></td>
                <td className="border-r border-black px-1.5 py-0.5 font-sans font-semibold text-left text-[11px]">
                  Transport
                </td>
                <td className="px-1.5 py-0.5 text-right font-mono text-xs">
                  {formatNumber(transport)}
                </td>
              </tr>
            )}
          </tbody>

          {/* 4. BOTTOM SUMMARY ROW: Total | Total Qty | Grand Total Bill Amount */}
          <tfoot>
            <tr className="border-t-2 border-black bg-white font-bold text-xs">
              <td colSpan={2} className="border-r border-black px-2 py-1 font-sans text-left uppercase text-sm">
                Total
              </td>
              <td className="border-r border-black px-1.5 py-1 text-right font-mono font-bold text-xs">
                {totalQuantity.toFixed(3)}
              </td>
              <td className="border-r border-black px-1.5 py-1"></td>
              <td className="px-1.5 py-1 text-right font-mono font-extrabold text-xs">
                {finalAmt}
              </td>
            </tr>
          </tfoot>
        </table>

      </div>
    </div>
  );
};

export default BillPrint;
