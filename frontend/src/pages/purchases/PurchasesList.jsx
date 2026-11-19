import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  ShoppingCart, 
  Eye, 
  Edit3, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Send, 
  ShieldAlert, 
  Building, 
  Calendar, 
  DollarSign, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Calculator,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Inbox,
  Package,
  Layers,
  ArrowRight,
  Printer
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { getPurchases, getInHandOrderSummary } from '../../services/purchaseService';

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

const PurchasesList = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [purchases, setPurchases] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');

  // Fetch Organizations for Super Admin / CEO
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        if (user?.role === 'SUPER_ADMIN') {
          const res = await api.get('/organizations');
          setOrganizations(res.data || []);
        } else if (user?.role === 'CEO') {
          const res = await api.get('/ceo/offices');
          setOrganizations(res.data || []);
        }
      } catch (err) {
        console.error('Failed to load organizations:', err);
      }
    };
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') {
      fetchOrgs();
    }
  }, [user]);

  // Fetch Purchases
  const fetchPurchasesData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      if (user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') {
        if (selectedOrgId) params.organizationId = selectedOrgId;
      } else if (user?.organizationId) {
        params.organizationId = user.organizationId;
      }

      const data = await getPurchases(params);
      setPurchases(data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch purchase records.');
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, startDate, endDate, selectedOrgId, user]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPurchasesData();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [fetchPurchasesData]);

  // In Hand Order State: Purchase Total Order Pending + In House Stock - Sales Total Order Pending = In Hand Order
  const [inHandSummary, setInHandSummary] = useState({
    purchaseTotalOrderPending: 0,
    inHouseStock: 0,
    salesTotalOrderPending: 0,
    inHandOrder: 0,
    productBreakdown: []
  });
  const [inHandLoading, setInHandLoading] = useState(false);
  const [showProductBreakdown, setShowProductBreakdown] = useState(false);
  const [productBreakdownSearch, setProductBreakdownSearch] = useState('');

  const fetchInHandData = useCallback(async () => {
    try {
      setInHandLoading(true);
      const params = {};
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') {
        if (selectedOrgId) params.organizationId = selectedOrgId;
      } else if (user?.organizationId) {
        params.organizationId = user.organizationId;
      }
      const data = await getInHandOrderSummary(params);
      if (data) {
        setInHandSummary(data);
      }
    } catch (err) {
      console.error('Failed to fetch In Hand Order summary:', err);
    } finally {
      setInHandLoading(false);
    }
  }, [selectedOrgId, user]);

  useEffect(() => {
    fetchInHandData();
  }, [fetchInHandData]);

  const filteredProductBreakdown = useMemo(() => {
    const list = inHandSummary.productBreakdown || [];
    if (!productBreakdownSearch.trim()) return list;
    const q = productBreakdownSearch.toLowerCase().trim();
    return list.filter(p => (p.productName || '').toLowerCase().includes(q));
  }, [inHandSummary.productBreakdown, productBreakdownSearch]);

  // Status Badge Component
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Fully Received':
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Fully Received
          </span>
        );
      case 'Partially Received':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Clock className="w-3.5 h-3.5" />
            Partially Received
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            Cancelled
          </span>
        );
      case 'Pending':
      case 'DRAFT':
      case 'PENDING_APPROVAL':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
    }
  };

  // Quick Stats
  const totalCount = purchases.length;
  const pendingCount = purchases.filter(p => p.status === 'Pending' || p.status === 'DRAFT' || p.status === 'PENDING_APPROVAL').length;
  const partialCount = purchases.filter(p => p.status === 'Partially Received').length;
  const fullyReceivedCount = purchases.filter(p => p.status === 'Fully Received' || p.status === 'APPROVED').length;
  const totalOrderedTons = purchases.reduce((acc, curr) => acc + (parseFloat(curr.totalOrderedQuantity) || parseFloat(curr.totalQuantity) || 0), 0);
  const totalPurchaseValue = purchases.reduce((acc, curr) => {
    const amt = parseFloat(curr.totalAmount);
    if (!isNaN(amt) && amt > 0) return acc + amt;
    const itemsSum = (curr.items || []).reduce((s, it) => s + (parseFloat(it.quantity || 0) * parseFloat(it.rate || 0)), 0);
    return acc + itemsSum;
  }, 0);
  const overallAveragePrice = totalOrderedTons > 0 ? (totalPurchaseValue / totalOrderedTons) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Management</h1>
            <p className="text-sm text-gray-500">
              Place multi-product purchase orders and record incoming goods receipts into inventory.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Receive via Purchase Estimate Voucher Button */}
          <Link
            to="/purchase-estimate"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            <Inbox className="w-4 h-4" />
            Purchase Estimate Voucher
          </Link>

          {/* Purchase Order Button */}
          <Link
            to="/purchase-order"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Purchase Order
          </Link>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-3 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Orders</p>
            <p className="text-xl font-bold text-gray-900">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Pending</p>
            <p className="text-xl font-bold text-amber-700">{pendingCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Partially Received</p>
            <p className="text-xl font-bold text-indigo-700">{partialCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fully Received</p>
            <p className="text-xl font-bold text-emerald-700">{fullyReceivedCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-slate-50 text-slate-700 rounded-lg">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Ordered</p>
            <p className="text-lg font-bold text-slate-800">
              {totalOrderedTons.toFixed(2)} Tons
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Average Price</p>
            <p className="text-lg font-bold text-emerald-700">
              ₹{overallAveragePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          IN HAND ORDER CALCULATION SECTION
          Formula: Purchase Total Order Pending + In House Stock - Sales Total Order Pending = In Hand Order
         ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                In Hand Order
                <span className="text-xs font-normal text-gray-500">
                  (Live Inventory & Order Balance)
                </span>
              </h2>
              <p className="text-xs text-gray-500 font-mono">
                Purchase Total Order Pending + In House Stock − Sales Total Order Pending = In Hand Order
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={fetchInHandData}
              disabled={inHandLoading}
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              title="Refresh In Hand Order Balance"
            >
              <RefreshCw className={`w-4 h-4 ${inHandLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setShowProductBreakdown(!showProductBreakdown)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
            >
              {showProductBreakdown ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Hide Breakdown
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  View Product Breakdown ({(inHandSummary.productBreakdown || []).length})
                </>
              )}
            </button>
          </div>
        </div>

        {/* The Equation: Box + Box - Box = Box */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Box 1: Purchase Total Order Pending */}
          <div className="flex-1 bg-amber-50/80 border-2 border-amber-300 rounded-xl p-4 flex flex-col justify-between shadow-sm min-w-[210px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                Purchase Total Order Pending
              </span>
              <ShoppingCart className="w-4 h-4 text-amber-600 shrink-0" />
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-950 font-mono">
                {Number(inHandSummary.purchaseTotalOrderPending || 0).toFixed(3)}
              </span>
              <span className="text-xs font-semibold text-amber-700">Tons</span>
            </div>
            <p className="text-[11px] text-amber-700/80 mt-1">Pending to receive from suppliers</p>
          </div>

          {/* Plus Sign */}
          <div className="flex items-center justify-center shrink-0 py-1 lg:py-0">
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-xl font-black text-slate-700 shadow-inner select-none">
              +
            </div>
          </div>

          {/* Box 2: In House Stock */}
          <div className="flex-1 bg-blue-50/80 border-2 border-blue-300 rounded-xl p-4 flex flex-col justify-between shadow-sm min-w-[210px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                In House Stock
              </span>
              <Package className="w-4 h-4 text-blue-600 shrink-0" />
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-blue-950 font-mono">
                {Number(inHandSummary.inHouseStock || 0).toFixed(3)}
              </span>
              <span className="text-xs font-semibold text-blue-700">Tons</span>
            </div>
            <p className="text-[11px] text-blue-700/80 mt-1">Current physical stock in warehouse</p>
          </div>

          {/* Minus Sign */}
          <div className="flex items-center justify-center shrink-0 py-1 lg:py-0">
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-xl font-black text-slate-700 shadow-inner select-none">
              −
            </div>
          </div>

          {/* Box 3: Sales Total Order Pending */}
          <div className="flex-1 bg-rose-50/80 border-2 border-rose-300 rounded-xl p-4 flex flex-col justify-between shadow-sm min-w-[210px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider">
                Sales Total Order Pending
              </span>
              <TrendingDown className="w-4 h-4 text-rose-600 shrink-0" />
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-rose-950 font-mono">
                {Number(inHandSummary.salesTotalOrderPending || 0).toFixed(3)}
              </span>
              <span className="text-xs font-semibold text-rose-700">Tons</span>
            </div>
            <p className="text-[11px] text-rose-700/80 mt-1">Committed to customers awaiting delivery</p>
          </div>

          {/* Equals Sign */}
          <div className="flex items-center justify-center shrink-0 py-1 lg:py-0">
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-xl font-black text-emerald-700 shadow-inner select-none">
              =
            </div>
          </div>

          {/* Box 4: In Hand Order (Highlighted Result Box) */}
          <div className={`flex-1 border-2 rounded-xl p-4 flex flex-col justify-between shadow-md min-w-[210px] ${
            Number(inHandSummary.inHandOrder || 0) >= 0 
              ? 'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-600 text-white' 
              : 'bg-gradient-to-br from-red-600 to-rose-700 border-red-600 text-white'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-emerald-100 uppercase tracking-wider">
                In Hand Order
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white backdrop-blur-xs">
                {Number(inHandSummary.inHandOrder || 0) >= 0 ? 'Surplus Balance' : 'Deficit / Shortfall'}
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-white font-mono">
                {Number(inHandSummary.inHandOrder || 0).toFixed(3)}
              </span>
              <span className="text-xs font-semibold text-emerald-100">Tons</span>
            </div>
            <p className="text-[11px] text-white/80 mt-1">Net uncommitted order balance</p>
          </div>

        </div>

        {/* Expandable Product-wise Breakdown */}
        {showProductBreakdown && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Product-wise In Hand Order Breakdown
              </h3>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter products..."
                  value={productBreakdownSearch}
                  onChange={(e) => setProductBreakdownSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full border-collapse text-xs text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold uppercase text-[11px]">
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3 text-right text-amber-800 bg-amber-50/50">Purchase Pending</th>
                    <th className="py-2.5 px-2 text-center text-gray-400">+</th>
                    <th className="py-2.5 px-3 text-right text-blue-800 bg-blue-50/50">In House Stock</th>
                    <th className="py-2.5 px-2 text-center text-gray-400">−</th>
                    <th className="py-2.5 px-3 text-right text-rose-800 bg-rose-50/50">Sales Pending</th>
                    <th className="py-2.5 px-2 text-center text-gray-400">=</th>
                    <th className="py-2.5 px-3 text-right font-bold text-gray-900 bg-emerald-50/60">In Hand Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono">
                  {filteredProductBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-gray-400 font-sans italic">
                        No product data found
                      </td>
                    </tr>
                  ) : (
                    filteredProductBreakdown.map((prod, pIdx) => {
                      const isInHandPositive = Number(prod.inHandOrder) >= 0;
                      return (
                        <tr key={prod.productId || pIdx} className="hover:bg-gray-50/80">
                          <td className="py-2 px-3 font-sans font-medium text-gray-900">
                            {prod.productName}
                          </td>
                          <td className="py-2 px-3 text-right text-amber-900 bg-amber-50/20">
                            {Number(prod.purchasePending || 0).toFixed(3)} T
                          </td>
                          <td className="py-2 px-2 text-center text-gray-400 font-sans">+</td>
                          <td className="py-2 px-3 text-right text-blue-900 bg-blue-50/20">
                            {Number(prod.inHouseStock || 0).toFixed(3)} T
                          </td>
                          <td className="py-2 px-2 text-center text-gray-400 font-sans">−</td>
                          <td className="py-2 px-3 text-right text-rose-900 bg-rose-50/20">
                            {Number(prod.salesPending || 0).toFixed(3)} T
                          </td>
                          <td className="py-2 px-2 text-center text-gray-400 font-sans">=</td>
                          <td className={`py-2 px-3 text-right font-bold bg-emerald-50/30 ${
                            isInHandPositive ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {Number(prod.inHandOrder || 0).toFixed(3)} T
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2 border-gray-300 font-mono font-bold text-gray-900 text-xs">
                  <tr>
                    <td className="py-2.5 px-3 font-sans">Total Balance</td>
                    <td className="py-2.5 px-3 text-right text-amber-900">
                      {Number(inHandSummary.purchaseTotalOrderPending || 0).toFixed(3)} T
                    </td>
                    <td className="py-2.5 px-2 text-center font-sans">+</td>
                    <td className="py-2.5 px-3 text-right text-blue-900">
                      {Number(inHandSummary.inHouseStock || 0).toFixed(3)} T
                    </td>
                    <td className="py-2.5 px-2 text-center font-sans">−</td>
                    <td className="py-2.5 px-3 text-right text-rose-900">
                      {Number(inHandSummary.salesTotalOrderPending || 0).toFixed(3)} T
                    </td>
                    <td className="py-2.5 px-2 text-center font-sans">=</td>
                    <td className="py-2.5 px-3 text-right text-emerald-800 font-black">
                      {Number(inHandSummary.inHandOrder || 0).toFixed(3)} T
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Order ID, Party Name, Product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Partially Received">Partially Received</option>
              <option value="Fully Received">Fully Received</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Org Filter (Super Admin or CEO) */}
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') && (
            <div>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Offices</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range Start */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Start Date"
            />
          </div>

          {/* Date Range End */}
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="End Date"
            />
          </div>
        </div>

        {(searchTerm || statusFilter !== 'ALL' || startDate || endDate || selectedOrgId) && (
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setStartDate('');
                setEndDate('');
                setSelectedOrgId('');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-gray-500">Loading purchase orders...</p>
          </div>
        ) : purchases.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No purchase orders found</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'ALL' || startDate || endDate
                ? 'No orders match your current filters. Try resetting search parameters.'
                : 'Place your first purchase order to track products, carbon types, and goods receipts.'}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link
                to="/purchase-order"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Purchase Order
              </Link>
              <Link
                to="/purchase-estimate"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Inbox className="w-4 h-4" />
                Purchase Estimate Voucher
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Serial No. & Date</th>
                  <th className="py-3.5 px-4">Party / Supplier</th>
                  <th className="py-3.5 px-4 min-w-[220px]">Products & Carbon Types</th>
                  <th className="py-3.5 px-4 text-right">Ordered</th>
                  <th className="py-3.5 px-4 text-right">Received</th>
                  <th className="py-3.5 px-4 text-right">Pending</th>
                  <th className="py-3.5 px-4 text-right">Avg. Price</th>
                  {user?.role === 'SUPER_ADMIN' && <th className="py-3.5 px-4">Office</th>}
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {purchases.map((purchase) => {
                  const totalOrd = parseFloat(purchase.totalOrderedQuantity) || parseFloat(purchase.totalQuantity) || 0;
                  const totalRec = parseFloat(purchase.totalReceivedQuantity) || 0;
                  const totalPen = Math.max(0, totalOrd - totalRec);
                  const itemsList = purchase.items || [];
                  const orderAmt = parseFloat(purchase.totalAmount) || (purchase.items || []).reduce((s, it) => s + (parseFloat(it.quantity || 0) * parseFloat(it.rate || 0)), 0);
                  const orderAvgPrice = totalOrd > 0 ? (orderAmt / totalOrd) : (parseFloat(purchase.averagePrice) || 0);

                  return (
                    <tr key={purchase.id} className="hover:bg-gray-50/75 transition-colors">
                      {/* Order ID & Date */}
                      <td className="py-3 px-4">
                        <Link 
                          to={`/purchases/${purchase.id}`} 
                          className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {cleanSerialNumber(purchase.purchaseNumber)}
                        </Link>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {purchase.purchaseDate}
                        </div>
                      </td>

                      {/* Party Name */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">
                          {purchase.vendorName || <span className="text-gray-400 italic">Unspecified</span>}
                        </div>
                        <div className="text-xs text-gray-500">
                          By: {purchase.creator?.username || 'User'}
                        </div>
                      </td>

                      {/* Products Summary */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-sm">
                          {itemsList.slice(0, 3).map((it, idx) => (
                            <span 
                              key={idx} 
                              className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200"
                            >
                              <span className="font-medium">{it.productNameSnapshot || 'Product'}:</span>
                              <span>{parseFloat(it.quantity).toFixed(1)}T</span>
                              <span className={`text-[10px] px-1 rounded ${
                                it.carbonType === 'High Carbon' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'
                              }`}>
                                {it.carbonType === 'High Carbon' ? 'HC' : 'LC'}
                              </span>
                            </span>
                          ))}
                          {itemsList.length > 3 && (
                            <span className="text-[11px] text-gray-500 self-center">
                              +{itemsList.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Ordered Qty */}
                      <td className="py-3 px-4 text-right font-semibold text-gray-900 text-sm">
                        {totalOrd.toFixed(3)} <span className="text-xs font-normal text-gray-500">T</span>
                      </td>

                      {/* Received Qty */}
                      <td className="py-3 px-4 text-right font-medium text-emerald-700 text-sm">
                        {totalRec.toFixed(3)} <span className="text-xs font-normal text-gray-400">T</span>
                      </td>

                      {/* Pending Qty */}
                      <td className="py-3 px-4 text-right text-sm">
                        {totalPen <= 0 ? (
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            0.000 T
                          </span>
                        ) : (
                          <span className="font-bold text-amber-600">
                            {totalPen.toFixed(3)} <span className="text-xs font-normal text-gray-400">T</span>
                          </span>
                        )}
                      </td>

                      {/* Avg. Price */}
                      <td className="py-3 px-4 text-right font-medium text-slate-800 text-sm">
                        {orderAvgPrice > 0 ? (
                          <>₹{orderAvgPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Office (Super Admin) */}
                      {user?.role === 'SUPER_ADMIN' && (
                        <td className="py-3 px-4 text-xs text-gray-600">
                          {purchase.Organization?.name || `Office #${purchase.organizationId}`}
                        </td>
                      )}

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {renderStatusBadge(purchase.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Receive Goods via Purchase Estimate Voucher Button */}
                          {totalPen > 0 && purchase.status !== 'CANCELLED' && (
                            <Link
                              to={`/purchase-estimate?purchaseId=${purchase.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-medium transition-colors"
                              title="Receive Goods via Purchase Estimate Voucher"
                            >
                              <Inbox className="w-3.5 h-3.5" />
                              Receive
                            </Link>
                          )}

                          {/* View Detail */}
                          <Link
                            to={`/purchases/${purchase.id}`}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="View Order Details & Receipts"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {/* Print Purchase Order Slip */}
                          <Link
                            to={`/purchases/${purchase.id}/print`}
                            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                            title="Print Purchase Order Slip"
                          >
                            <Printer className="w-4 h-4" />
                          </Link>

                          {/* Edit (if no receipts yet) */}
                          {totalRec === 0 && purchase.status !== 'CANCELLED' && (
                            <Link
                              to={`/purchase-order?purchaseId=${purchase.id}&mode=edit`}
                              className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                              title="Edit Purchase Order in Workspace"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchasesList;
