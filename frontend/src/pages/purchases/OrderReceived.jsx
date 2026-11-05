import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import {
  getPreviousPurchase,
  getNextPurchase,
  lookupPurchaseByNumber,
  getPurchaseById,
  receiveGoods,
  getPurchases
} from '../../services/purchaseService';

const DEFAULT_ROWS_COUNT = 30;

const BLANK_RECEIVE_ROW = {
  purchaseItemId: '',
  productId: '',
  productName: '',
  description: '',
  orderedQty: '',
  receivedBeforeQty: '',
  pendingQty: '',
  receiveNowQty: '',
  currentStock: ''
};

const createBlankRows = (count = DEFAULT_ROWS_COUNT) => {
  return Array.from({ length: count }, () => ({ ...BLANK_RECEIVE_ROW }));
};

// Date utilities
const formatToDisplayDate = (isoStr) => {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return isoStr;
};

const parseDisplayDateToIso = (dispStr) => {
  if (!dispStr) return '';
  const parts = dispStr.split('-');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dispStr;
};

const getDayOfWeekName = (dateStr) => {
  if (!dateStr) return '';
  let d;
  if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
    const [y, m, day] = dateStr.split('-');
    d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(day, 10));
  } else if (dateStr.includes('-')) {
    const [day, m, y] = dateStr.split('-');
    d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(day, 10));
  } else {
    d = new Date(dateStr);
  }
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
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

export default function OrderReceived() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialOrderId = searchParams.get('orderId') || searchParams.get('purchaseId');
  const { user } = useContext(AuthContext);

  // Office context
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');

  const effectiveOrgId = useMemo(() => {
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') {
      return selectedOrgId || user?.organizationId || '';
    }
    return user?.organizationId || '';
  }, [user, selectedOrgId]);

  // Active Loaded Purchase Order Record
  const [currentPurchase, setCurrentPurchase] = useState(null);

  // Header Fields
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderNumberInput, setOrderNumberInput] = useState('');
  const [partyName, setPartyName] = useState('');
  const [vehicleChallanNo, setVehicleChallanNo] = useState('');

  // Table Grid Items State
  const [receiveItems, setReceiveItems] = useState(createBlankRows(DEFAULT_ROWS_COUNT));
  const [activeRowIdx, setActiveRowIdx] = useState(0);

  // Lower Section Fields
  const [orderRemark, setOrderRemark] = useState('');
  const remarkTextareaRef = useRef(null);

  // UI Status
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Search Modal State
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [allPurchases, setAllPurchases] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // History Modal State (Past GRNs)
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // 1. Fetch Organizations for Super Admin / CEO
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        if (user?.role === 'SUPER_ADMIN') {
          const res = await api.get('/organizations');
          setOrganizations(res.data || []);
          if (!selectedOrgId && res.data?.length > 0) {
            setSelectedOrgId(res.data[0].id);
          }
        } else if (user?.role === 'CEO') {
          const res = await api.get('/ceo/offices');
          setOrganizations(res.data || []);
          if (!selectedOrgId && res.data?.length > 0) {
            setSelectedOrgId(res.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load organizations:', err);
      }
    };
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') {
      fetchOrgs();
    }
  }, [user]);

  // Helper: Populate a Purchase Record into State
  const populatePurchaseIntoState = (pur) => {
    if (!pur) return;
    setCurrentPurchase(pur);
    setOrderNumberInput(cleanSerialNumber(pur.purchaseNumber) || '');
    setPartyName(pur.vendorName || pur.partyName || '');
    setOrderRemark('');
    setVehicleChallanNo('');

    const lines = pur.productLines || pur.items || [];
    if (lines.length > 0) {
      const mapped = lines.map(item => {
        const ordered = parseFloat(item.quantity ?? item.orderedQuantity ?? 0);
        const received = parseFloat(item.receivedQuantity ?? item.previouslyReceivedQuantity ?? 0);
        const pending = Math.max(0, ordered - received);
        const stock = item.Product?.currentStock !== undefined 
          ? parseFloat(item.Product.currentStock) 
          : (item.currentStock !== undefined ? parseFloat(item.currentStock) : 0);

        return {
          purchaseItemId: item.id || item.purchaseItemId,
          productId: item.productId ? String(item.productId) : '',
          productName: item.productNameSnapshot || item.productName || item.Product?.name || '',
          description: item.productSpecificationsSnapshot || item.specifications || item.carbonType || '',
          orderedQty: ordered > 0 ? ordered.toFixed(3) : '0.000',
          receivedBeforeQty: received > 0 ? received.toFixed(3) : '0.000',
          pendingQty: pending > 0 ? pending.toFixed(3) : '0.000',
          receiveNowQty: '',
          currentStock: stock > 0 ? stock.toFixed(3) : '0.000'
        };
      });

      const padded = [...mapped];
      while (padded.length < DEFAULT_ROWS_COUNT) {
        padded.push({ ...BLANK_RECEIVE_ROW });
      }
      setReceiveItems(padded);
    } else {
      setReceiveItems(createBlankRows(DEFAULT_ROWS_COUNT));
    }
  };

  // Initial Load: Either specific orderId or latest purchase order
  useEffect(() => {
    const loadInitialPurchase = async () => {
      setErrorMsg('');
      try {
        let purData = null;
        if (initialOrderId) {
          try {
            purData = await lookupPurchaseByNumber(initialOrderId, effectiveOrgId ? { organizationId: effectiveOrgId } : {});
          } catch (lookupErr) {
            purData = await getPurchaseById(initialOrderId);
          }
        } else {
          try {
            purData = await getPreviousPurchase(null, effectiveOrgId);
          } catch (navErr) {
            purData = null;
          }
        }

        if (purData) {
          populatePurchaseIntoState(purData);
        }
      } catch (err) {
        console.error('Failed to load initial purchase order:', err);
      }
    };

    loadInitialPurchase();
  }, [initialOrderId, effectiveOrgId]);

  // Lookup by Serial Number when entered in input
  const handleSearchByNumber = async (numToSearch) => {
    const target = (numToSearch || orderNumberInput || '').trim();
    if (!target) {
      setErrorMsg('Please enter a Serial Number to search.');
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const data = await lookupPurchaseByNumber(target, effectiveOrgId ? { organizationId: effectiveOrgId } : {});
      populatePurchaseIntoState(data);
      setSuccessMsg(`Loaded Serial Number #${cleanSerialNumber(data.purchaseNumber)}`);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || `Purchase Order "${target}" not found.`);
    } finally {
      setActionLoading(false);
    }
  };

  // Receive Now input change
  const handleItemReceiveNowChange = (index, val) => {
    if (actionLoading) return;
    setReceiveItems(prev => {
      const updated = [...prev];
      const pending = parseFloat(updated[index].pendingQty) || 0;
      const numVal = parseFloat(val) || 0;

      // Allow typing, but warn if over pending
      if (numVal > pending && pending > 0) {
        setErrorMsg(`Row #${index + 1}: Quantity received (${numVal}) exceeds pending quantity (${pending}).`);
      } else {
        if (errorMsg.includes('exceeds pending quantity')) {
          setErrorMsg('');
        }
      }

      updated[index] = {
        ...updated[index],
        receiveNowQty: val
      };
      return updated;
    });
  };

  // Receive All Pending shortcut
  const handleReceiveAllPending = () => {
    setReceiveItems(prev => {
      return prev.map(item => {
        const pending = parseFloat(item.pendingQty) || 0;
        if (pending > 0) {
          return {
            ...item,
            receiveNowQty: item.pendingQty
          };
        }
        return item;
      });
    });
    setErrorMsg('');
    setSuccessMsg('Populated all pending quantities into Receive Now.');
  };

  // Clear Receive Now inputs
  const handleClearReceive = () => {
    setReceiveItems(prev => {
      return prev.map(item => ({
        ...item,
        receiveNowQty: ''
      }));
    });
    setErrorMsg('');
  };

  // Keyboard Navigation on Table Inputs
  const handleKeyDownOnReceiveNow = (e, idx) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      const nextIdx = Math.min(DEFAULT_ROWS_COUNT - 1, idx + 1);
      setActiveRowIdx(nextIdx);
      const nextInput = document.getElementById(`receive-now-input-${nextIdx}`);
      if (nextInput) nextInput.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = Math.max(0, idx - 1);
      setActiveRowIdx(prevIdx);
      const prevInput = document.getElementById(`receive-now-input-${prevIdx}`);
      if (prevInput) prevInput.focus();
    }
  };

  // ==========================================
  // CALCULATIONS
  // ==========================================
  const calculations = useMemo(() => {
    let totalOrdered = 0;
    let totalReceivedBefore = 0;
    let totalPending = 0;
    let totalReceiveNow = 0;
    let validRows = 0;

    receiveItems.forEach(item => {
      const hasProduct = Boolean(item.purchaseItemId || item.productId || (item.productName && item.productName.trim()));
      const ord = parseFloat(item.orderedQty) || 0;
      const rec = parseFloat(item.receivedBeforeQty) || 0;
      const pen = parseFloat(item.pendingQty) || 0;
      const now = parseFloat(item.receiveNowQty) || 0;

      if (hasProduct || ord > 0 || pen > 0 || now > 0) {
        validRows += 1;
        totalOrdered += ord;
        totalReceivedBefore += rec;
        totalPending += pen;
        totalReceiveNow += now;
      }
    });

    return {
      validRows,
      totalOrdered: totalOrdered.toFixed(3),
      totalReceivedBefore: totalReceivedBefore.toFixed(3),
      totalPending: totalPending.toFixed(3),
      totalReceiveNow: totalReceiveNow.toFixed(3),
      grandTotal: totalReceiveNow.toFixed(3)
    };
  }, [receiveItems]);

  // ==========================================
  // ACTION BAR HANDLERS
  // ==========================================

  // 1. PREVIOUS
  const handlePrevious = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(true);
    try {
      const prevData = await getPreviousPurchase(currentPurchase?.id, effectiveOrgId);
      if (prevData) {
        populatePurchaseIntoState(prevData);
        setSuccessMsg(`Loaded Serial Number #${cleanSerialNumber(prevData.purchaseNumber)}`);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'No preceding record found for this office.');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. NEXT
  const handleNext = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(true);
    try {
      const nextData = await getNextPurchase(currentPurchase?.id, effectiveOrgId);
      if (nextData) {
        populatePurchaseIntoState(nextData);
        setSuccessMsg(`Loaded Serial Number #${cleanSerialNumber(nextData.purchaseNumber)}`);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'No subsequent record found for this office.');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. SAVE / RECEIVE GOODS
  const handleSaveReceipt = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentPurchase) {
      setErrorMsg('Please load a valid Purchase Order first.');
      return;
    }

    const linesToSubmit = [];
    let hasOver = false;
    let hasNegative = false;

    receiveItems.forEach((line, idx) => {
      const qNow = parseFloat(line.receiveNowQty) || 0;
      const pending = parseFloat(line.pendingQty) || 0;

      if (qNow < 0) {
        hasNegative = true;
      } else if (qNow > pending) {
        hasOver = true;
      } else if (qNow > 0 && line.purchaseItemId) {
        linesToSubmit.push({
          purchaseItemId: line.purchaseItemId,
          quantityReceivedNow: qNow
        });
      }
    });

    if (hasNegative) {
      setErrorMsg('Quantity received cannot be negative.');
      return;
    }

    if (hasOver) {
      setErrorMsg('Quantity received now cannot exceed the pending quantity for any item.');
      return;
    }

    if (linesToSubmit.length === 0) {
      setErrorMsg('Please enter a quantity greater than 0 in "Receive Now" for at least one item.');
      return;
    }

    setActionLoading(true);
    try {
      const idempotencyKey = `rcpt_${currentPurchase.id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const combinedRemarks = [vehicleChallanNo ? `Vehicle/Challan: ${vehicleChallanNo}` : '', orderRemark ? orderRemark : ''].filter(Boolean).join(' | ');

      const payload = {
        orderId: currentPurchase.purchaseNumber || currentPurchase.id,
        receiptDate: receiptDate || new Date().toISOString().split('T')[0],
        remarks: combinedRemarks || undefined,
        idempotencyKey,
        items: linesToSubmit,
        organizationId: effectiveOrgId ? parseInt(effectiveOrgId, 10) : undefined
      };

      const res = await receiveGoods(payload);
      const rcpt = res.goodsReceipt || res.receipt;
      setSuccessMsg(`✓ Goods Receipt #${rcpt?.receiptNumber || 'Saved'} recorded! ${calculations.totalReceiveNow} Tons added to stock.`);

      // Refresh the loaded order from backend
      const refreshed = await lookupPurchaseByNumber(currentPurchase.purchaseNumber, effectiveOrgId ? { organizationId: effectiveOrgId } : {});
      populatePurchaseIntoState(refreshed);
    } catch (err) {
      console.error('Failed to record goods receipt:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to record goods receipt. Please check quantities.');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. OPEN SEARCH MODAL
  const handleOpenSearchModal = async () => {
    setShowSearchModal(true);
    setSearchQuery('');
    try {
      const res = await api.get(`/purchases${effectiveOrgId ? `?organizationId=${effectiveOrgId}` : ''}`);
      setAllPurchases(res.data || []);
    } catch (err) {
      console.error('Failed to load purchases for search:', err);
    }
  };

  const filteredPurchases = useMemo(() => {
    if (!searchQuery.trim()) return allPurchases.slice(0, 50);
    const q = searchQuery.toLowerCase().trim();
    return allPurchases.filter(p =>
      (p.purchaseNumber && p.purchaseNumber.toLowerCase().includes(q)) ||
      (p.vendorName && p.vendorName.toLowerCase().includes(q)) ||
      (p.purchaseDate && p.purchaseDate.includes(q)) ||
      (p.status && p.status.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [allPurchases, searchQuery]);

  return (
    <div className="w-full h-full flex flex-col bg-[#e6e9ed] border border-[#7f9db9] text-black text-xs select-none overflow-hidden font-sans">
      
      {/* Notifications Banner */}
      {errorMsg && (
        <div className="shrink-0 bg-red-100 border-b border-red-300 text-red-800 px-3 py-0.5 flex items-center justify-between text-[11px] font-medium">
          <span>⚠ {errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')} className="font-bold text-red-900 ml-2 cursor-pointer">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="shrink-0 bg-emerald-100 border-b border-emerald-300 text-emerald-900 px-3 py-0.5 flex items-center justify-between text-[11px] font-medium">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg('')} className="font-bold text-emerald-900 ml-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          VOUCHER BODY (LOCKED HEIGHT, ZERO VERTICAL SCROLLBAR)
         ───────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col p-1.5 space-y-1 bg-[#e6e9ed] overflow-hidden min-h-0">

        {/* TOP SECTION: Date, Serial Number, Center Title, Status Indicator, Right Info */}
        <div className="shrink-0 grid grid-cols-12 gap-1 items-start">
          
          {/* Top Left: Date and Serial Number */}
          <div className="col-span-12 md:col-span-4 space-y-0.5">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-[11px] text-black w-22">Receipt Date</span>
              <input
                type="text"
                value={formatToDisplayDate(receiptDate)}
                disabled={actionLoading}
                onChange={(e) => {
                  setReceiptDate(parseDisplayDateToIso(e.target.value));
                }}
                placeholder="DD-MM-YYYY"
                className="w-24 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] text-black font-semibold focus:outline-none focus:bg-white"
              />
              <span className="font-bold text-[11px] text-black">
                {getDayOfWeekName(receiptDate)}
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-[11px] text-black w-22">Order Serial</span>
              <input
                type="text"
                value={orderNumberInput}
                disabled={actionLoading}
                onChange={(e) => setOrderNumberInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchByNumber(orderNumberInput);
                  }
                }}
                placeholder="Serial No."
                className="w-24 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] text-black font-bold focus:outline-none focus:bg-white"
                title="Enter Serial Number and press Enter to search"
              />
              <button
                type="button"
                onClick={() => handleSearchByNumber(orderNumberInput)}
                disabled={actionLoading}
                className="px-1.5 py-0.5 bg-[#ece9d8] hover:bg-[#f5f4ef] text-black font-semibold text-[10px] border border-[#7f9db9] cursor-pointer"
              >
                Go
              </button>
            </div>
          </div>

          {/* Top Center: "Receive Order" and Status in RED */}
          <div className="col-span-12 md:col-span-4 text-center">
            <h1 className="font-serif text-[22px] leading-tight text-black font-normal tracking-wide">
              Receive Order
            </h1>
            <div className="text-red-600 font-bold text-[12px] leading-tight">
              {currentPurchase?.status || 'Goods Receipt'}
            </div>
          </div>

          {/* Top Right: Office dropdown + Options / Date */}
          <div className="col-span-12 md:col-span-4 flex flex-col items-end text-right space-y-0.5 text-[11px]">
            <div className="flex items-center space-x-2 text-black font-medium">
              {(user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') && organizations.length > 1 && (
                <span className="text-[10px] font-normal bg-white/80 px-1.5 py-0.5 rounded border border-slate-300">
                  Office:
                  <select
                    value={effectiveOrgId}
                    onChange={(e) => {
                      setSelectedOrgId(e.target.value);
                      setCurrentPurchase(null);
                    }}
                    className="ml-1 bg-transparent font-medium text-black focus:outline-none"
                  >
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </span>
              )}
              {currentPurchase?.receipts && currentPurchase.receipts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(true)}
                  className="text-emerald-800 hover:underline font-bold cursor-pointer"
                >
                  History ({currentPurchase.receipts.length})
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenSearchModal}
                className="text-blue-800 hover:underline font-bold cursor-pointer"
              >
                Search
              </button>
            </div>
            <div className="text-black font-bold text-[11px]">
              {formatToDisplayDate(new Date().toISOString().split('T')[0])} {getDayOfWeekName(new Date().toISOString().split('T')[0])}
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            HEADER FORM FIELDS: Party Name & Vehicle / Challan No
           ───────────────────────────────────────────────────────────── */}
        <div className="shrink-0 bg-[#d9e8fb] border border-[#7f9db9] p-1 text-xs">
          <div className="grid grid-cols-12 gap-2 items-center">
            
            {/* Party Name */}
            <div className="col-span-7 flex items-center space-x-2">
              <label className="font-bold text-[11px] text-black w-22 shrink-0">Party Name</label>
              <input
                type="text"
                readOnly
                value={partyName}
                placeholder="Party name from purchase order..."
                className="w-full h-5 bg-[#e4ebf5] border border-[#7f9db9] px-1 text-[11px] font-bold text-black cursor-not-allowed select-none"
              />
              <div className="flex items-center space-x-1 shrink-0 text-slate-700 pl-1">
                <span className="font-bold text-[11px]">Items:</span>
                <span className="font-mono font-bold bg-white px-1.5 py-0.5 border border-[#7f9db9] text-[11px]">
                  {calculations.validRows}
                </span>
              </div>
            </div>

            {/* Vehicle / Challan No */}
            <div className="col-span-5 flex items-center space-x-2">
              <label className="font-bold text-[11px] text-black w-24 shrink-0 text-right">Vehicle / Challan</label>
              <input
                type="text"
                value={vehicleChallanNo}
                disabled={actionLoading}
                onChange={(e) => setVehicleChallanNo(e.target.value)}
                placeholder="Truck No. / Challan No..."
                className="flex-1 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] font-medium text-black focus:outline-none focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            TRANSACTION PRODUCT ITEMS GRID (30 Rows, Clean, Desktop ERP)
           ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 border border-[#7f9db9] bg-white">
          
          {/* Table Header (Fixed) */}
          <div className="shrink-0 bg-[#d9e8fb] border-b border-[#7f9db9]">
            <table className="w-full border-collapse text-xs font-bold text-slate-800">
              <thead>
                <tr className="h-5">
                  <th className="w-6 border-r border-[#7f9db9] text-center p-0"></th>
                  <th className="border-r border-[#7f9db9] px-2 py-0.5 text-left min-w-[200px]">Product Name</th>
                  <th className="border-r border-[#7f9db9] px-2 py-0.5 text-left min-w-[180px]">Description</th>
                  <th className="border-r border-[#7f9db9] px-2 py-0.5 text-right w-24">Ordered Qty</th>
                  <th className="border-r border-[#7f9db9] px-2 py-0.5 text-right w-24 text-emerald-900">Recv Before</th>
                  <th className="border-r border-[#7f9db9] px-2 py-0.5 text-right w-24 text-amber-950">Pending Qty</th>
                  <th className="border-r border-[#7f9db9] px-2 py-0.5 text-right w-28 bg-[#cce4f7] text-blue-900 font-extrabold">Receive Now</th>
                  <th className="px-2 py-0.5 text-right w-24 text-slate-700">Stock</th>
                </tr>
              </thead>
            </table>
          </div>

          {/* Table Body (Scrolls internally if rows exceed container) */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full border-collapse text-xs">
              <tbody>
                {receiveItems.map((item, idx) => {
                  const isActive = idx === activeRowIdx;
                  const hasData = Boolean(item.purchaseItemId || item.productId || item.productName);
                  const isFullyReceived = hasData && parseFloat(item.pendingQty || 0) <= 0;

                  return (
                    <tr
                      key={idx}
                      onClick={() => setActiveRowIdx(idx)}
                      className={`h-5 border-b border-[#c0c0c0] ${
                        isActive ? 'bg-[#f4f7fc]' : isFullyReceived ? 'bg-slate-50/60' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      {/* Active Row Indicator */}
                      <td className="w-6 border-r border-[#7f9db9] text-center text-black font-bold p-0 select-none">
                        {isActive ? '▸' : ''}
                      </td>

                      {/* Product Name */}
                      <td className="border-r border-[#7f9db9] p-0 min-w-[200px]">
                        <input
                          type="text"
                          readOnly
                          value={item.productName}
                          onFocus={() => setActiveRowIdx(idx)}
                          className="w-full h-5 px-1 text-xs text-black bg-transparent border-0 outline-none font-medium cursor-default"
                        />
                      </td>

                      {/* Description */}
                      <td className="border-r border-[#7f9db9] p-0 min-w-[180px]">
                        <input
                          type="text"
                          readOnly
                          value={item.description}
                          onFocus={() => setActiveRowIdx(idx)}
                          className="w-full h-5 px-1 text-xs text-black bg-transparent border-0 outline-none cursor-default"
                        />
                      </td>

                      {/* Ordered Qty */}
                      <td className="border-r border-[#7f9db9] p-0 text-right w-24">
                        <input
                          type="text"
                          readOnly
                          value={item.orderedQty}
                          onFocus={() => setActiveRowIdx(idx)}
                          className="w-full h-5 px-1 text-right text-xs font-mono text-black bg-transparent border-0 outline-none cursor-default"
                        />
                      </td>

                      {/* Previously Received */}
                      <td className="border-r border-[#7f9db9] p-0 text-right w-24">
                        <input
                          type="text"
                          readOnly
                          value={item.receivedBeforeQty}
                          onFocus={() => setActiveRowIdx(idx)}
                          className="w-full h-5 px-1 text-right text-xs font-mono font-medium text-emerald-800 bg-transparent border-0 outline-none cursor-default"
                        />
                      </td>

                      {/* Pending Qty */}
                      <td className="border-r border-[#7f9db9] p-0 text-right w-24">
                        <input
                          type="text"
                          readOnly
                          value={item.pendingQty}
                          onFocus={() => setActiveRowIdx(idx)}
                          className="w-full h-5 px-1 text-right text-xs font-mono font-bold text-amber-900 bg-transparent border-0 outline-none cursor-default"
                        />
                      </td>

                      {/* Receive Now (Interactive Field) */}
                      <td className="border-r border-[#7f9db9] p-0 text-right w-28 bg-[#cce4f7]/40">
                        {hasData && !isFullyReceived ? (
                          <input
                            id={`receive-now-input-${idx}`}
                            type="number"
                            step="any"
                            min="0"
                            max={item.pendingQty}
                            value={item.receiveNowQty}
                            disabled={actionLoading}
                            onChange={(e) => handleItemReceiveNowChange(idx, e.target.value)}
                            onFocus={() => setActiveRowIdx(idx)}
                            onKeyDown={(e) => handleKeyDownOnReceiveNow(e, idx)}
                            placeholder="0.000"
                            className="w-full h-5 px-1 text-right text-xs font-mono font-bold text-black bg-[#cce4f7] focus:bg-white border-0 outline-none"
                          />
                        ) : hasData && isFullyReceived ? (
                          <span className="text-[10px] text-emerald-700 font-bold pr-2">
                            ✓ Done
                          </span>
                        ) : (
                          <span className="block h-5"></span>
                        )}
                      </td>

                      {/* Current Stock */}
                      <td className="p-0 text-right w-24">
                        <input
                          type="text"
                          readOnly
                          value={hasData ? item.currentStock : ''}
                          onFocus={() => setActiveRowIdx(idx)}
                          className="w-full h-5 px-1 text-right text-xs font-mono text-slate-600 bg-transparent border-0 outline-none cursor-default"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* TOTALS ROW DIRECTLY UNDER GRID COLUMNS */}
        <div className="shrink-0 flex items-center justify-end space-x-2 text-xs pt-0.5">
          <div className="flex items-center space-x-1">
            <span className="font-bold text-[11px] text-black">Ordered</span>
            <input
              type="text"
              readOnly
              value={calculations.totalOrdered}
              className="w-24 h-5 bg-white border border-[#7f9db9] px-1 text-right font-mono font-bold text-black text-[11px]"
            />
          </div>
          <div className="flex items-center space-x-1">
            <span className="font-bold text-[11px] text-emerald-800">Recv Before</span>
            <input
              type="text"
              readOnly
              value={calculations.totalReceivedBefore}
              className="w-24 h-5 bg-white border border-[#7f9db9] px-1 text-right font-mono font-bold text-emerald-800 text-[11px]"
            />
          </div>
          <div className="flex items-center space-x-1">
            <span className="font-bold text-[11px] text-amber-900">Pending</span>
            <input
              type="text"
              readOnly
              value={calculations.totalPending}
              className="w-24 h-5 bg-white border border-[#7f9db9] px-1 text-right font-mono font-bold text-amber-900 text-[11px]"
            />
          </div>
          <div className="flex items-center space-x-1">
            <span className="font-bold text-[11px] text-blue-900">Receive Now</span>
            <input
              type="text"
              readOnly
              value={calculations.totalReceiveNow}
              className="w-28 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-right font-mono font-black text-black text-[11px]"
              title="Total Receive Now (Tons)"
            />
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            LOWER SECTION: REMARK (LEFT) & GRAND TOTAL (RIGHT)
           ───────────────────────────────────────────────────────────── */}
        <div className="bg-[#d9e8fb] border border-[#7f9db9] p-1.5 grid grid-cols-1 md:grid-cols-12 gap-2 text-xs shrink-0">
          
          {/* Lower Left: Remark Textarea */}
          <div className="md:col-span-8 flex items-start">
            <label className="w-16 font-bold text-[11px] text-black pt-0.5 shrink-0">Remark:</label>
            <textarea
              ref={remarkTextareaRef}
              rows={2}
              value={orderRemark}
              disabled={actionLoading}
              onChange={(e) => setOrderRemark(e.target.value)}
              placeholder="Delivery notes, driver name, condition, or intake remarks..."
              className="flex-1 h-12 bg-[#cce4f7] border border-[#7f9db9] px-1.5 py-0.5 text-xs text-black focus:outline-none focus:bg-white resize-none"
            />
          </div>

          {/* Lower Right: Grand Total Received */}
          <div className="md:col-span-4 flex flex-col justify-end space-y-1 text-right">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-black">Total Inward Qty</span>
              <input
                type="text"
                readOnly
                value={calculations.totalReceiveNow}
                className="w-32 h-5 bg-white border border-[#7f9db9] px-1 text-right font-mono font-bold text-black text-[11px]"
              />
            </div>

            <div className="flex items-center justify-between pt-0.5 border-t border-[#7f9db9]">
              <span className="font-black text-[12px] text-black uppercase">GRAND TOTAL (TONS)</span>
              <input
                type="text"
                readOnly
                value={calculations.grandTotal}
                className="w-32 h-6 bg-[#cce4f7] border border-[#7f9db9] px-1.5 text-right font-mono font-black text-[13px] text-black"
              />
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            BOTTOM ACTION BUTTON BAR (Retro Windows 3D Beveled Buttons)
           ───────────────────────────────────────────────────────────── */}
        <div className="shrink-0 pt-1 border-t border-[#7f9db9]">
          <div className="flex items-center justify-between gap-1">
            
            {/* Left: < Previous, Next >, Receive All Pending, Clear */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={actionLoading}
                className="px-3 py-1 bg-[#ece9d8] hover:bg-[#f5f4ef] text-black font-semibold text-xs border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-[#707070] border-b-[#707070] active:border-t-[#707070] active:border-l-[#707070] active:border-r-white active:border-b-white disabled:opacity-50 select-none cursor-pointer"
              >
                &lt; Previous
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={actionLoading}
                className="px-3 py-1 bg-[#ece9d8] hover:bg-[#f5f4ef] text-black font-semibold text-xs border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-[#707070] border-b-[#707070] active:border-t-[#707070] active:border-l-[#707070] active:border-r-white active:border-b-white disabled:opacity-50 select-none cursor-pointer"
              >
                Next &gt;
              </button>

              <button
                type="button"
                onClick={handleReceiveAllPending}
                disabled={actionLoading}
                className="px-3 py-1 bg-[#ece9d8] hover:bg-[#f5f4ef] text-black font-semibold text-xs border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-[#707070] border-b-[#707070] active:border-t-[#707070] active:border-l-[#707070] active:border-r-white active:border-b-white disabled:opacity-50 select-none cursor-pointer"
              >
                Receive All Pending
              </button>

              <button
                type="button"
                onClick={handleClearReceive}
                disabled={actionLoading}
                className="px-3 py-1 bg-[#ece9d8] hover:bg-[#f5f4ef] text-black font-semibold text-xs border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-[#707070] border-b-[#707070] active:border-t-[#707070] active:border-l-[#707070] active:border-r-white active:border-b-white disabled:opacity-50 select-none cursor-pointer"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={handleSaveReceipt}
                disabled={actionLoading || parseFloat(calculations.totalReceiveNow) <= 0}
                className="px-4 py-1 bg-[#ece9d8] hover:bg-[#f5f4ef] text-black font-bold text-xs border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-[#707070] border-b-[#707070] active:border-t-[#707070] active:border-l-[#707070] active:border-r-white active:border-b-white disabled:opacity-50 select-none cursor-pointer outline-dotted outline-1 outline-[#404040] outline-offset-[-3px]"
              >
                {actionLoading ? 'Saving...' : 'Save Receipt'}
              </button>
            </div>

            {/* Right: Search & History */}
            <div className="flex items-center gap-1.5">
              {currentPurchase?.receipts && currentPurchase.receipts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(true)}
                  className="px-3 py-1 bg-[#ece9d8] hover:bg-[#f5f4ef] text-black font-semibold text-xs border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-[#707070] border-b-[#707070] active:border-t-[#707070] active:border-l-[#707070] active:border-r-white active:border-b-white cursor-pointer"
                >
                  GRN History ({currentPurchase.receipts.length})
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenSearchModal}
                className="px-4 py-1 bg-[#ece9d8] hover:bg-[#f5f4ef] text-black font-bold text-xs border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-[#707070] border-b-[#707070] active:border-t-[#707070] active:border-l-[#707070] active:border-r-white active:border-b-white cursor-pointer"
              >
                Search
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          SEARCH MODAL (Classic Windows Dialog Style)
         ───────────────────────────────────────────────────────────── */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#ece9d8] border-2 border-[#7f9db9] w-full max-w-3xl shadow-xl flex flex-col max-h-[80vh]">
            <div className="bg-[#0a246a] text-white px-2 py-1 text-xs font-bold flex justify-between items-center">
              <span>Search Purchase Orders To Receive</span>
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="text-white hover:bg-red-600 px-1 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-2 border-b border-[#7f9db9]">
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Serial Number, Party Name, Date, or Status..."
                className="w-full h-7 px-2 text-xs border border-[#7f9db9] bg-white text-black outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-[#d9e8fb] border-b border-[#7f9db9] text-left">
                    <th className="p-1 border-r border-[#7f9db9] w-20">Serial No.</th>
                    <th className="p-1 border-r border-[#7f9db9] w-24">Date</th>
                    <th className="p-1 border-r border-[#7f9db9]">Party Name</th>
                    <th className="p-1 border-r border-[#7f9db9] text-right w-24">Ordered</th>
                    <th className="p-1 border-r border-[#7f9db9] text-right w-24 text-emerald-800">Received</th>
                    <th className="p-1 border-r border-[#7f9db9] text-right w-24 text-amber-900">Pending</th>
                    <th className="p-1 text-center w-28">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-4 text-center text-slate-500">No matching orders found</td>
                    </tr>
                  ) : (
                    filteredPurchases.map(p => {
                      const ord = parseFloat(p.totalOrderedQuantity ?? p.totalQuantity ?? 0);
                      const rec = parseFloat(p.totalReceivedQuantity ?? 0);
                      const pen = parseFloat(p.totalPendingQuantity ?? Math.max(0, ord - rec));

                      return (
                        <tr
                          key={p.id}
                          onClick={() => {
                            populatePurchaseIntoState(p);
                            setShowSearchModal(false);
                          }}
                          className="hover:bg-blue-100 cursor-pointer border-b border-slate-200"
                        >
                          <td className="p-1 border-r border-[#7f9db9] font-mono font-bold text-blue-800">
                            {cleanSerialNumber(p.purchaseNumber)}
                          </td>
                          <td className="p-1 border-r border-[#7f9db9]">{p.purchaseDate}</td>
                          <td className="p-1 border-r border-[#7f9db9] font-bold">{p.vendorName || p.partyName}</td>
                          <td className="p-1 border-r border-[#7f9db9] text-right font-mono">{ord.toFixed(3)}</td>
                          <td className="p-1 border-r border-[#7f9db9] text-right font-mono text-emerald-800">{rec.toFixed(3)}</td>
                          <td className="p-1 border-r border-[#7f9db9] text-right font-mono font-bold text-amber-900">{pen.toFixed(3)}</td>
                          <td className="p-1 text-center font-semibold text-[11px]">
                            <span className={
                              p.status === 'Fully Received' || p.status === 'COMPLETED'
                                ? 'text-emerald-700'
                                : p.status === 'Partially Received'
                                  ? 'text-indigo-700'
                                  : 'text-amber-800'
                            }>
                              {p.status || 'Pending'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-2 border-t border-[#7f9db9] bg-[#d9e8fb] flex justify-end">
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="px-4 py-1 bg-white border border-[#7f9db9] text-xs font-bold text-black cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          GRN HISTORY MODAL (Previous Receipts)
         ───────────────────────────────────────────────────────────── */}
      {showHistoryModal && currentPurchase?.receipts && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#ece9d8] border-2 border-[#7f9db9] w-full max-w-2xl shadow-xl flex flex-col max-h-[80vh]">
            <div className="bg-[#0a246a] text-white px-2 py-1 text-xs font-bold flex justify-between items-center">
              <span>Goods Receipts History (Order #{cleanSerialNumber(currentPurchase.purchaseNumber)})</span>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-white hover:bg-red-600 px-1 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {currentPurchase.receipts.length === 0 ? (
                <div className="p-4 text-center text-slate-500">No goods receipts recorded yet.</div>
              ) : (
                currentPurchase.receipts.map(rcpt => {
                  const totalRcptQty = (rcpt.items || []).reduce(
                    (sum, it) => sum + (parseFloat(it.quantityReceived) || 0),
                    0
                  );

                  return (
                    <div key={rcpt.id} className="bg-white border border-[#7f9db9] p-2 space-y-1">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                        <span className="font-mono font-bold text-blue-800 text-xs">
                          {rcpt.receiptNumber}
                        </span>
                        <span className="text-[11px] text-slate-600">
                          Date: <strong className="text-black">{rcpt.receiptDate}</strong> | Received by: <strong className="text-black">{rcpt.receiver?.username || 'User'}</strong>
                        </span>
                        <span className="font-mono font-bold text-emerald-800 text-xs bg-emerald-50 px-1.5 py-0.5 border border-emerald-200">
                          +{totalRcptQty.toFixed(3)} Tons
                        </span>
                      </div>

                      {/* Items */}
                      <div className="text-[11px] space-y-0.5 pt-1">
                        {(rcpt.items || []).map(it => (
                          <div key={it.id} className="flex justify-between text-slate-700">
                            <span>{it.productNameSnapshot} ({it.carbonType})</span>
                            <span className="font-mono font-bold text-black">
                              {parseFloat(it.quantityReceived || 0).toFixed(3)} Tons
                            </span>
                          </div>
                        ))}
                      </div>

                      {rcpt.remarks && (
                        <div className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-100">
                          {rcpt.remarks}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-2 border-t border-[#7f9db9] bg-[#d9e8fb] flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1 bg-white border border-[#7f9db9] text-xs font-bold text-black cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
