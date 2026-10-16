import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, ShieldCheck } from 'lucide-react';
import { getGatePassById } from '../../services/gatePassService';

const GatePassPrint = () => {
  const { id } = useParams();
  const [gatePass, setGatePass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchGP = async () => {
      try {
        setLoading(true);
        const data = await getGatePassById(id);
        setGatePass(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load gate pass for printing.');
      } finally {
        setLoading(false);
      }
    };
    fetchGP();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
        <span className="text-gray-500 text-sm">Preparing printable gate pass...</span>
      </div>
    );
  }

  if (error || !gatePass) {
    return (
      <div className="p-8 text-center text-red-600">
        {error || 'Gate pass not found.'}
      </div>
    );
  }

  const docNumber = gatePass.transactionType === 'BILL' 
    ? (gatePass.bill?.billNumber || 'Bill') 
    : (gatePass.estimate?.estimateNumber || 'Estimate');
  const docDate = gatePass.transactionType === 'BILL' 
    ? gatePass.bill?.billDate 
    : gatePass.estimate?.estimateDate;

  const items = gatePass.bill?.items || gatePass.estimate?.items || [];

  return (
    <div className="py-6 px-4 max-w-4xl mx-auto space-y-6">
      {/* Screen-only Controls (Hidden when printed) */}
      <div className="print:hidden flex justify-between items-center bg-white p-4 rounded-xl shadow-xs border border-gray-200">
        <Link
          to={`/gate-passes/${gatePass.id}`}
          className="text-gray-600 hover:text-gray-900 text-sm font-medium flex items-center"
        >
          <ArrowLeft size={16} className="mr-1.5" />
          Back to Gate Pass Details
        </Link>
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center shadow-sm transition-colors"
        >
          <Printer size={16} className="mr-2" />
          Print / Save as PDF
        </button>
      </div>

      {/* Printable A4 Gate Pass Structure */}
      <div className="bg-white p-8 md:p-12 border-2 border-gray-900 rounded-sm print:border-2 print:border-black print:p-6 print:m-0 print:shadow-none text-gray-900 font-sans shadow-lg space-y-6">
        {/* DOCUMENT HEADER */}
        <div className="text-center pb-4 border-b-2 border-gray-900">
          <h1 className="text-2xl md:text-3xl font-black tracking-wider uppercase text-black">
            OFFICIAL VEHICLE GATE PASS
          </h1>
          {gatePass.organization && (
            <div className="mt-1">
              <p className="text-base font-bold text-gray-900 uppercase">
                {gatePass.organization.name}
              </p>
              {gatePass.organization.address && (
                <p className="text-xs text-gray-600">
                  {gatePass.organization.address}
                </p>
              )}
            </div>
          )}
        </div>

        {/* PASS NUMBER & DATE BAR */}
        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-300 text-xs">
          <div>
            <span className="text-gray-500 font-semibold uppercase tracking-wider block">Gate Pass Number:</span>
            <span className="text-xl font-black font-mono tracking-tight text-black">
              {gatePass.gatePassNumber}
            </span>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Status: <strong className="uppercase">{gatePass.status}</strong>
            </p>
          </div>
          <div className="text-right">
            <span className="text-gray-500 font-semibold uppercase tracking-wider block">Issue Date & Time:</span>
            <span className="text-sm font-bold text-gray-900">
              {gatePass.issuedAt 
                ? new Date(gatePass.issuedAt).toLocaleString() 
                : new Date(gatePass.createdAt).toLocaleString()}
            </span>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Validity Window: <strong>10 Minutes</strong>
            </p>
          </div>
        </div>

        {/* VEHICLE & CUSTOMER DETAILS */}
        <div className="grid grid-cols-2 gap-6 text-xs pb-4 border-b border-gray-300">
          {/* Left: Vehicle & Driver */}
          <div className="space-y-1.5">
            <h3 className="font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-1">
              Vehicle & Transport
            </h3>
            <div className="pt-1">
              <span className="text-gray-500">Vehicle Number:</span>{' '}
              <strong className="text-sm font-mono tracking-wider text-black">{gatePass.vehicleNumber}</strong>
            </div>
            <div>
              <span className="text-gray-500">Driver Name:</span>{' '}
              <strong>{gatePass.driverName || 'N/A'}</strong>
            </div>
            <div>
              <span className="text-gray-500">Driver Contact:</span>{' '}
              <span>{gatePass.driverPhone || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500">Destination:</span>{' '}
              <strong>{gatePass.destination || 'Direct Customer Delivery'}</strong>
            </div>
          </div>

          {/* Right: Customer & Reference Document */}
          <div className="space-y-1.5">
            <h3 className="font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-1">
              Consignee & Order Reference
            </h3>
            <div className="pt-1">
              <span className="text-gray-500">Customer:</span>{' '}
              <strong className="text-sm text-black">{gatePass.customer?.name || 'Customer'}</strong>
            </div>
            {gatePass.customer?.city && (
              <div>
                <span className="text-gray-500">City / Location:</span>{' '}
                <span>{gatePass.customer.city}</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Ref {gatePass.transactionType}:</span>{' '}
              <strong className="font-mono">{docNumber}</strong> {docDate && `(${docDate})`}
            </div>
            {gatePass.remarks && (
              <div>
                <span className="text-gray-500">Remarks:</span>{' '}
                <span>{gatePass.remarks}</span>
              </div>
            )}
          </div>
        </div>

        {/* WEIGHBRIDGE CERTIFICATE BOX */}
        {gatePass.weighingRecord && (
          <div className="border border-gray-400 p-4 rounded-sm space-y-3 bg-gray-50/50">
            <div className="flex justify-between items-center border-b border-gray-300 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-900">
                Weighbridge Weight Certificate ({gatePass.weighingRecord.weighingNumber})
              </span>
              <span className="text-[11px] font-semibold text-gray-600 bg-white px-2 py-0.5 border border-gray-300">
                Source: Manual Entry
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-white p-2 border border-gray-200">
                <span className="text-[10px] text-gray-500 block uppercase">Tare Weight</span>
                <span className="font-mono font-bold text-gray-900">
                  {parseFloat(gatePass.weighingRecord.tareWeight).toFixed(2)} {gatePass.weighingRecord.unit}
                </span>
              </div>
              <div className="bg-white p-2 border border-gray-200">
                <span className="text-[10px] text-gray-500 block uppercase">Gross Weight</span>
                <span className="font-mono font-bold text-gray-900">
                  {parseFloat(gatePass.weighingRecord.grossWeight).toFixed(2)} {gatePass.weighingRecord.unit}
                </span>
              </div>
              <div className="bg-white p-2 border-2 border-black">
                <span className="text-[10px] font-bold text-gray-900 block uppercase">Net Goods Weight</span>
                <span className="font-mono font-black text-sm text-black">
                  {parseFloat(gatePass.weighingRecord.netWeight).toFixed(2)} {gatePass.weighingRecord.unit}
                </span>
              </div>
              <div className="bg-white p-2 border border-gray-200">
                <span className="text-[10px] text-gray-500 block uppercase">Expected Weight</span>
                <span className="font-mono text-gray-700">
                  {gatePass.weighingRecord.expectedWeight !== null && gatePass.weighingRecord.expectedWeight !== undefined 
                    ? `${parseFloat(gatePass.weighingRecord.expectedWeight).toFixed(2)} ${gatePass.weighingRecord.unit}` 
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* GOODS SUMMARY TABLE */}
        {items.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-2">
              Loaded Goods Summary
            </h3>
            <table className="w-full text-left text-xs border border-gray-300">
              <thead className="bg-gray-100 text-gray-800 font-semibold border-b border-gray-300">
                <tr>
                  <th className="p-2 border-r border-gray-300">#</th>
                  <th className="p-2 border-r border-gray-300">Description of Goods</th>
                  <th className="p-2 border-r border-gray-300 text-right">Quantity</th>
                  <th className="p-2 border-r border-gray-300">Unit</th>
                  <th className="p-2">Size / Specs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-2 border-r border-gray-300">{idx + 1}</td>
                    <td className="p-2 border-r border-gray-300 font-medium">
                      {item.productNameSnapshot || 'Material'}
                    </td>
                    <td className="p-2 border-r border-gray-300 text-right font-mono">
                      {parseFloat(item.quantity).toFixed(2)}
                    </td>
                    <td className="p-2 border-r border-gray-300">{item.unit || 'Kg'}</td>
                    <td className="p-2 text-gray-600">
                      {[item.productSizeSnapshot, item.productSpecificationsSnapshot].filter(Boolean).join(' • ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* LEGAL SECURITY NOTICE */}
        <div className="p-3 bg-gray-50 border border-gray-300 rounded-sm text-[11px] text-gray-700 space-y-1">
          <p className="font-bold text-gray-900 uppercase">Dispatch Security Conditions:</p>
          <p>
            1. This gate pass is strictly valid for <strong>10 minutes</strong> from authorization. Vehicles exceeding this window must undergo mandatory re-weighing.
          </p>
          <p>
            2. Printing of this pass does NOT constitute exit confirmation. Physical gate crossing must be validated and signed by the on-duty Gate Security Officer.
          </p>
        </div>

        {/* SIGNATURE BLOCKS */}
        <div className="grid grid-cols-4 gap-4 pt-16 text-center text-xs">
          <div className="border-t border-gray-400 pt-2">
            <p className="font-semibold text-gray-900">Weighbridge Operator</p>
            <p className="text-[10px] text-gray-500">Scale Verification</p>
          </div>
          <div className="border-t border-gray-400 pt-2">
            <p className="font-semibold text-gray-900">Driver's Signature</p>
            <p className="text-[10px] text-gray-500">Material Received</p>
          </div>
          <div className="border-t border-gray-400 pt-2">
            <p className="font-semibold text-gray-900">Security / Gate Officer</p>
            <p className="text-[10px] text-gray-500">Physical Exit Check</p>
          </div>
          <div className="border-t border-gray-400 pt-2">
            <p className="font-semibold text-gray-900">Authorized Signatory</p>
            <p className="text-[10px] text-gray-500">For OfficeFlow ERP</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GatePassPrint;
