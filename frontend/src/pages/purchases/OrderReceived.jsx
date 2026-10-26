import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Construction, 
  ShoppingCart, 
  Clock, 
  ArrowRight,
  PackageCheck,
  FileCheck
} from 'lucide-react';

const OrderReceived = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 pt-4 px-4 sm:px-6">
      {/* Top Navigation / Breadcrumb Header */}
      <div className="flex items-center justify-between bg-white px-5 py-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            to="/purchases"
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to Purchases"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">Order Received</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                In Progress
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Purchases &bull; Goods Receipt &amp; Inventory Intake
            </p>
          </div>
        </div>

        <Link
          to="/purchase-order"
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
        >
          <ShoppingCart className="w-4 h-4" />
          Purchase Order
        </Link>
      </div>

      {/* Main "Still Building" Hero Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 sm:p-12 text-center">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs mb-6">
          <Construction className="w-10 h-10 stroke-[1.75]" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 uppercase tracking-wider mb-3">
          <Clock className="w-3.5 h-3.5" /> Module Under Construction
        </span>

        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
          Still Building
        </h2>

        <p className="mt-3 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
          The <strong>Order Received</strong> module is currently being built. Development on this section is temporarily on hold pending discussion with the client to finalize the receiving and inventory workflows.
        </p>

        {/* Planned Features Preview */}
        <div className="mt-8 max-w-xl mx-auto bg-slate-50 border border-slate-200 rounded-xl p-5 text-left text-sm space-y-3">
          <p className="font-semibold text-slate-800 flex items-center gap-2 text-xs uppercase tracking-wider">
            <PackageCheck className="w-4 h-4 text-emerald-600" /> Planned Workflow Capabilities
          </p>
          <ul className="space-y-2 text-slate-600 text-xs sm:text-sm">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0"></span>
              <span>Lookup purchase orders by sequential Serial Number or Party Name</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0"></span>
              <span>Record partial or complete goods delivery receipts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0"></span>
              <span>Automatic inventory stock increment upon receipt verification</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0"></span>
              <span>Goods Receipt Note (GRN) generation and print slip support</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/purchase-order"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-98"
          >
            Create Purchase Order
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            to="/purchases"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold transition-all shadow-xs"
          >
            Back to Purchases List
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OrderReceived;
