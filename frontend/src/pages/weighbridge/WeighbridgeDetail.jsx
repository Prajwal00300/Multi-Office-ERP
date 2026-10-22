import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Scale, 
  ArrowLeft, 
  Truck, 
  User, 
  Calendar, 
  Building2, 
  Printer, 
  Calculator,
  Clock,
  CheckCircle2,
  Ticket
} from 'lucide-react';
import { getWeighingRecordById } from '../../services/weighbridgeService';

const WeighbridgeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRecord = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getWeighingRecordById(id);
      setRecord(data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to load weighing record details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mb-3"></div>
        <p className="font-medium text-sm">Loading weighing slip...</p>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-4">
        <Link
          to="/weighbridge"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft size={16} className="mr-1.5" /> Back to Weighbridge List
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 p-5 rounded-xl text-sm">
          {error || 'Weighing record not found.'}
        </div>
      </div>
    );
  }

  const fWeight = parseFloat(record.firstWeight || record.tareWeight || 0).toFixed(3);
  const gWeight = parseFloat(record.grossWeight || 0).toFixed(3);
  const tWeight = parseFloat(record.taleWeight || record.netWeight || 0).toFixed(3);
  const unit = record.weightUnit || 'Ton';

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Navigation & Print Actions */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          to="/weighbridge"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={16} className="mr-1.5" /> Back to Weighbridge List
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to={`/gate-passes/new?weighingRecordId=${record.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Ticket size={14} />
            <span>Create Gate Pass</span>
          </Link>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Printer size={14} />
            <span>Print Slip</span>
          </button>
        </div>
      </div>

      {/* Slip Card (Printable) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
        {/* Slip Header */}
        <div className="bg-slate-900 px-6 py-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Scale size={20} className="text-blue-400" />
              <h2 className="text-lg font-bold tracking-wide">WEIGHBRIDGE SLIP</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Office: {record.Organization?.name || 'Authorized Office Branch'}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-400 block uppercase font-mono">Slip Number</span>
            <span className="text-base font-bold font-mono text-blue-400">{record.weighingNumber}</span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-100 text-xs">
            {/* Customer Details */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1">
              <span className="font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1.5">
                <User size={13} className="text-blue-600" /> Customer Information
              </span>
              <p className="text-sm font-bold text-slate-900 mt-1">
                {record.Customer?.name || 'Customer Name'}
              </p>
              {record.Customer?.phone && (
                <p className="text-slate-600">Ph: {record.Customer.phone}</p>
              )}
              {record.Customer?.city && (
                <p className="text-slate-600">City: {record.Customer.city}</p>
              )}
              {record.Customer?.address && (
                <p className="text-slate-500 text-[11px]">{record.Customer.address}</p>
              )}
            </div>

            {/* Vehicle & Date Info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1">
              <span className="font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1.5">
                <Truck size={13} className="text-blue-600" /> Vehicle &amp; Timing
              </span>
              <p className="text-sm font-bold text-slate-900 mt-1 uppercase tracking-wide">
                {record.vehicleDetails || '—'}
              </p>
              <p className="text-slate-600 flex items-center gap-1 mt-1">
                <Calendar size={12} className="text-slate-400" />
                <span>Date: {new Date(record.weighedAt || record.createdAt).toLocaleDateString()}</span>
              </p>
              <p className="text-slate-600 flex items-center gap-1">
                <Clock size={12} className="text-slate-400" />
                <span>Time: {new Date(record.weighedAt || record.createdAt).toLocaleTimeString()}</span>
              </p>
            </div>
          </div>

          {/* Weights Breakdown Card */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
              <Calculator size={15} className="text-blue-600" /> Weighing Results
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* First Weight */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <span className="text-xs font-semibold text-slate-500 block">First Weight</span>
                <span className="text-[11px] text-slate-400 block mb-2">(Empty Vehicle)</span>
                <span className="text-2xl font-bold font-mono text-slate-800">
                  {fWeight}
                </span>
                <span className="text-xs font-semibold text-slate-400 ml-1.5 uppercase">{unit}</span>
              </div>

              {/* Gross Weight */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <span className="text-xs font-semibold text-slate-500 block">Gross Weight</span>
                <span className="text-[11px] text-slate-400 block mb-2">(Vehicle + Goods)</span>
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {gWeight}
                </span>
                <span className="text-xs font-semibold text-slate-400 ml-1.5 uppercase">{unit}</span>
              </div>

              {/* Tale Weight (Highlight) */}
              <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50">
                <span className="text-xs font-bold text-emerald-800 block">Tale Weight</span>
                <span className="text-[11px] text-emerald-600 font-medium block mb-2">(Net Goods Weight)</span>
                <span className="text-2xl font-bold font-mono text-emerald-900">
                  {tWeight}
                </span>
                <span className="text-xs font-bold text-emerald-700 ml-1.5 uppercase">{unit}</span>
              </div>
            </div>
          </div>

          {/* Footer note & Signatures */}
          <div className="pt-6 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
            <div>
              <p>Operator: <span className="font-semibold text-slate-700">{record.recorder?.fullName || record.recorder?.username || 'Weighbridge Operator'}</span></p>
              <p className="text-[11px] text-slate-400 mt-0.5">Recorded electronically in OfficeFlow ERP</p>
            </div>
            <div className="text-left sm:text-right space-y-8">
              <div className="w-48 border-b border-slate-300"></div>
              <p className="text-[11px] font-medium text-slate-600">Authorized Signatory / Weighmaster</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeighbridgeDetail;
