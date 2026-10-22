import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, Ticket, User, Truck, Scale } from 'lucide-react';
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

  const customerName = gatePass.Customer?.name || gatePass.customer?.name || 'Customer';
  const vehicleNo = gatePass.vehicleNumber || '—';
  const grossWt = parseFloat(gatePass.grossWeight || 0).toFixed(3);
  const unit = gatePass.weightUnit || 'Ton';

  return (
    <div className="py-6 px-4 max-w-3xl mx-auto space-y-6">
      {/* Screen-only Controls (Hidden when printed) */}
      <div className="print:hidden flex justify-between items-center bg-white p-4 rounded-xl shadow-xs border border-gray-200">
        <Link
          to={`/gate-passes/${gatePass.id}`}
          className="text-gray-600 hover:text-gray-900 text-sm font-medium flex items-center"
        >
          <ArrowLeft size={16} className="mr-1.5" />
          Back to Gate Pass
        </Link>
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center shadow-sm transition-colors"
        >
          <Printer size={16} className="mr-2" />
          Print Slip
        </button>
      </div>

      {/* Printable A4 Gate Pass Slip */}
      <div className="bg-white p-8 md:p-10 border-2 border-gray-900 rounded-sm print:border-2 print:border-black print:p-6 print:m-0 print:shadow-none text-gray-900 font-sans shadow-lg space-y-6">
        {/* DOCUMENT HEADER */}
        <div className="text-center pb-4 border-b-2 border-gray-900">
          <h1 className="text-2xl md:text-3xl font-black tracking-wider uppercase text-black">
            OFFICIAL VEHICLE GATE PASS
          </h1>
          {(gatePass.Organization || gatePass.organization) && (
            <div className="mt-1">
              <p className="text-sm font-bold text-gray-800 uppercase">
                {gatePass.Organization?.name || gatePass.organization?.name}
              </p>
              {(gatePass.Organization?.address || gatePass.organization?.address) && (
                <p className="text-xs text-gray-600">
                  {gatePass.Organization?.address || gatePass.organization?.address}
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
            <span className="text-gray-500 font-semibold uppercase tracking-wider block">Issue Date &amp; Time:</span>
            <span className="text-sm font-bold text-gray-900">
              {new Date(gatePass.issuedAt || gatePass.createdAt).toLocaleString()}
            </span>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Validity: <strong>10-Minute Weighbridge Verification Rule</strong>
            </p>
          </div>
        </div>

        {/* EXACTLY THREE BUSINESS DETAILS */}
        <div className="py-2 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 border-b border-gray-200 pb-1">
            Dispatch Particulars
          </h3>

          <div className="grid grid-cols-3 gap-4">
            {/* Detail 1: Customer Name */}
            <div className="p-4 bg-gray-50 border border-gray-300 rounded-sm">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Customer Name
              </span>
              <p className="text-sm font-bold text-black break-words">
                {customerName}
              </p>
              {gatePass.Customer?.city && (
                <p className="text-xs text-gray-600 mt-0.5">{gatePass.Customer.city}</p>
              )}
            </div>

            {/* Detail 2: Vehicle Number */}
            <div className="p-4 bg-gray-50 border border-gray-300 rounded-sm">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Vehicle Number
              </span>
              <p className="text-sm font-mono font-bold text-black uppercase tracking-wider">
                {vehicleNo}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">Registration Number</p>
            </div>

            {/* Detail 3: Gross Weight */}
            <div className="p-4 bg-gray-50 border-2 border-black rounded-sm">
              <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider block mb-1">
                Gross Weight
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-mono font-black text-black">
                  {grossWt}
                </span>
                <span className="text-xs font-bold text-gray-700 uppercase">
                  {unit}
                </span>
              </div>
              <p className="text-[10px] text-gray-600 mt-0.5">Vehicle + Goods</p>
            </div>
          </div>
        </div>

        {/* SECURITY CONDITIONS */}
        <div className="p-3 bg-gray-50 border border-gray-300 rounded-sm text-[11px] text-gray-700 space-y-1">
          <p className="font-bold text-gray-900 uppercase">Exit Verification Notice:</p>
          <p>
            1. This Gate Pass is saved and authorized under the strict 10-minute Weighbridge verification policy.
          </p>
          <p>
            2. Gate Security must visually verify the vehicle registration plate and gross weight before allowing the vehicle to cross the exit gate.
          </p>
        </div>

        {/* SIGNATURE BLOCKS */}
        <div className="grid grid-cols-3 gap-6 pt-16 text-center text-xs">
          <div className="border-t border-gray-400 pt-2">
            <p className="font-semibold text-gray-900">Weighbridge Operator</p>
            <p className="text-[10px] text-gray-500">Verified &amp; Issued</p>
          </div>
          <div className="border-t border-gray-400 pt-2">
            <p className="font-semibold text-gray-900">Driver's Signature</p>
            <p className="text-[10px] text-gray-500">Vehicle in Charge</p>
          </div>
          <div className="border-t border-gray-400 pt-2">
            <p className="font-semibold text-gray-900">Gate Security Officer</p>
            <p className="text-[10px] text-gray-500">Exit Authorization</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GatePassPrint;
