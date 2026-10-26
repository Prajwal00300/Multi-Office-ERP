import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import {
  getPreviousPurchase,
  getNextPurchase,
  getNextPurchaseNumber,
  getPurchaseById,
  createPurchase,
  updatePurchase
} from '../../services/purchaseService';

const DEFAULT_ROWS_COUNT = 30;

const BLANK_ORDER_ROW = {
  productId: '',
  productName: '',
  description: '',
  quantity: '',
  price: '',
  amount: '0.00'
};

const createBlankRows = (count = DEFAULT_ROWS_COUNT) => {
  return Array.from({ length: count }, () => ({ ...BLANK_ORDER_ROW }));
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
    return String(parseInt(str, 10)); // e.g. '001' -> '1', '1' -> '1'
  }
  const match = str.match(/\d+$/);
  if (match) {
    return String(parseInt(match[0], 10));
  }
  return str;
};

export default function PurchaseOrderWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPurchaseId = searchParams.get('purchaseId');
  const { user } = useContext(AuthContext);

  // Mode: 'VIEW' | 'ADD' | 'EDIT' | 'SAVING'
  const [mode, setMode] = useState('VIEW');
  const [isDirty, setIsDirty] = useState(false);

  // Office context
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');

  const effectiveOrgId = useMemo(() => {
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') {
      return selectedOrgId || user?.organizationId || '';
    }
    return user?.organizationId || '';
  }, [user, selectedOrgId]);

  // Master Data
  const [products, setProducts] = useState([]);
  const [partySuggestions, setPartySuggestions] = useState([]);

  // Active / Current Loaded Purchase Order Record
  const [currentPurchase, setCurrentPurchase] = useState(null);

  // Header Fields
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderNumber, setOrderNumber] = useState('');
  const [partyName, setPartyName] = useState('');

  // Table Grid Items State
  const [orderItems, setOrderItems] = useState(createBlankRows(DEFAULT_ROWS_COUNT));
  const [activeRowIdx, setActiveRowIdx] = useState(0);

  // Autocomplete suggestions popover state
  const [activeAutocompleteIdx, setActiveAutocompleteIdx] = useState(null);
  const [highlightedSuggestionIdx, setHighlightedSuggestionIdx] = useState(0);

  // Party suggestions dropdown
  const [showPartySuggestions, setShowPartySuggestions] = useState(false);

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

  // Helper to mark dirty and switch to edit mode
  const markDirtyAndEdit = () => {
    setIsDirty(true);
    if (mode === 'VIEW') {
      setMode('EDIT');
    }
  };

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

  // 2. Fetch Products and Previous Parties for the active Office
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const orgQuery = effectiveOrgId ? `?organizationId=${effectiveOrgId}` : '';
        const [prodRes, purRes] = await Promise.all([
          api.get(`/products${orgQuery}`),
          api.get(`/purchases${orgQuery}`)
        ]);
        setProducts(prodRes.data || []);

        // Collect distinct vendor/party names
        const purchasesList = purRes.data || [];
        const parties = Array.from(
          new Set(
            purchasesList
              .map(p => p.vendorName || p.partyName)
              .filter(name => Boolean(name && name.trim()))
          )
        );
        setPartySuggestions(parties);
      } catch (err) {
        console.error('Failed to load master data for Purchase Order:', err);
      }
    };

    fetchMasterData();
  }, [effectiveOrgId]);

  // Helper: Populate a Purchase Record into State
  const populatePurchaseIntoState = (pur) => {
    if (!pur) return;
    setCurrentPurchase(pur);
    setIsDirty(false);

    setOrderDate(pur.purchaseDate || new Date().toISOString().split('T')[0]);
    setOrderNumber(cleanSerialNumber(pur.purchaseNumber) || '');
    setPartyName(pur.vendorName || pur.partyName || '');
    setOrderRemark(pur.remarks || pur.purchaseDetails || '');

    if (pur.items && pur.items.length > 0) {
      const mapped = pur.items.map(item => {
        const q = parseFloat(item.quantity) || 0;
        const p = parseFloat(item.rate) || 0;
        const amt = parseFloat(item.amount) || (q * p);
        return {
          productId: item.productId ? String(item.productId) : '',
          productName: item.productNameSnapshot || item.Product?.name || '',
          description: item.productSpecificationsSnapshot || item.specifications || '',
          quantity: q > 0 ? String(q) : '',
          price: p > 0 ? String(p) : '',
          amount: amt > 0 ? amt.toFixed(2) : '0.00'
        };
      });

      const padded = [...mapped];
      while (padded.length < DEFAULT_ROWS_COUNT) {
        padded.push({ ...BLANK_ORDER_ROW });
      }
      setOrderItems(padded);
    } else {
      setOrderItems(createBlankRows(DEFAULT_ROWS_COUNT));
    }
  };

  // Reset Workspace for New ADD Entry
  const resetToAddMode = async () => {
    const orgId = effectiveOrgId;
    setCurrentPurchase(null);
    setOrderDate(new Date().toISOString().split('T')[0]);
    setPartyName('');
    setOrderItems(createBlankRows(DEFAULT_ROWS_COUNT));
    setOrderRemark('');
    setIsDirty(false);
    setMode('ADD');

    // Fetch next sequential purchase number preview (1, 2, 3, 4...)
    try {
      const numRes = await getNextPurchaseNumber(orgId ? { organizationId: orgId } : {});
      setOrderNumber(cleanSerialNumber(numRes?.nextPurchaseNumber) || '1');
    } catch (err) {
      console.warn('Failed to preview next purchase number:', err);
      setOrderNumber('1');
    }
  };

  // Initial Load: Either specific purchaseId or latest order / new entry
  useEffect(() => {
    const loadInitialPurchase = async () => {
      setErrorMsg('');
      try {
        let purData = null;
        if (initialPurchaseId) {
          purData = await getPurchaseById(initialPurchaseId);
        } else {
          try {
            purData = await getPreviousPurchase(null, effectiveOrgId);
          } catch (navErr) {
            purData = null;
          }
        }

        if (purData) {
          populatePurchaseIntoState(purData);
          if (searchParams.get('mode') === 'edit') {
            setMode('EDIT');
            setSuccessMsg(`Loaded Serial Number #${purData.purchaseNumber} in Edit mode.`);
          } else {
            setMode('VIEW');
          }
        } else {
          await resetToAddMode();
        }
      } catch (err) {
        console.error('Initial purchase load error:', err);
        await resetToAddMode();
      }
    };

    loadInitialPurchase();
  }, [effectiveOrgId, initialPurchaseId]);

  // Filtered products for autocomplete
  const getFilteredProducts = (query) => {
    if (!query || !query.trim()) return products.slice(0, 15);
    const q = query.toLowerCase().trim();
    return products.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.specifications && p.specifications.toLowerCase().includes(q))
    ).slice(0, 15);
  };

  // Product Name input change
  const handleProductNameInputChange = (index, text) => {
    if (actionLoading || mode === 'SAVING') return;
    markDirtyAndEdit();
    setActiveRowIdx(index);
    setActiveAutocompleteIdx(index);
    setHighlightedSuggestionIdx(0);

    setOrderItems(prev => {
      const updated = [...prev];
      if (!text.trim()) {
        updated[index] = { ...BLANK_ORDER_ROW };
        return updated;
      }

      const match = products.find(p => p.name.toLowerCase() === text.trim().toLowerCase());
      let prodId = updated[index].productId;
      let desc = updated[index].description;
      if (match) {
        prodId = String(match.id);
        desc = match.specifications || match.description || desc;
      }

      const q = parseFloat(updated[index].quantity) || 0;
      const p = parseFloat(updated[index].price) || 0;
      const amt = q * p;

      updated[index] = {
        ...updated[index],
        productId: prodId,
        productName: text,
        description: desc,
        amount: amt > 0 ? amt.toFixed(2) : '0.00'
      };
      return updated;
    });
  };

  // Select product from suggestion popup
  const handleSelectProductSuggestion = (index, prod) => {
    if (actionLoading || mode === 'SAVING') return;
    markDirtyAndEdit();
    setActiveRowIdx(index);

    setOrderItems(prev => {
      const updated = [...prev];
      const q = parseFloat(updated[index].quantity) || 0;
      const p = parseFloat(updated[index].price) || 0;
      const amt = q * p;

      updated[index] = {
        ...updated[index],
        productId: String(prod.id),
        productName: prod.name,
        description: prod.specifications || prod.description || prod.name,
        amount: amt > 0 ? amt.toFixed(2) : '0.00'
      };
      return updated;
    });
    setActiveAutocompleteIdx(null);
    setHighlightedSuggestionIdx(0);
  };

  // Keyboard navigation for product autocomplete
  const handleProductInputKeyDown = (e, idx, filtered) => {
    if (activeAutocompleteIdx !== idx || filtered.length === 0) {
      if (e.key === 'ArrowDown') {
        setActiveAutocompleteIdx(idx);
        setHighlightedSuggestionIdx(0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedSuggestionIdx(prev => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedSuggestionIdx(prev => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (highlightedSuggestionIdx >= 0 && highlightedSuggestionIdx < filtered.length) {
        e.preventDefault();
        handleSelectProductSuggestion(idx, filtered[highlightedSuggestionIdx]);
      } else {
        setActiveAutocompleteIdx(null);
      }
    } else if (e.key === 'Escape') {
      setActiveAutocompleteIdx(null);
    }
  };

  // Description input change
  const handleItemDescriptionChange = (index, val) => {
    if (actionLoading || mode === 'SAVING') return;
    markDirtyAndEdit();
    setOrderItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], description: val };
      return updated;
    });
  };

  // Quantity input change: calculate Amount = Quantity * Price
  const handleItemQuantityChange = (index, val) => {
    if (actionLoading || mode === 'SAVING') return;
    markDirtyAndEdit();
    setOrderItems(prev => {
      const updated = [...prev];
      const q = parseFloat(val) || 0;
      const p = parseFloat(updated[index].price) || 0;
      const amt = q * p;

      updated[index] = {
        ...updated[index],
        quantity: val,
        amount: amt > 0 ? amt.toFixed(2) : '0.00'
      };
      return updated;
    });
  };

  // Price input change: calculate Amount = Quantity * Price
  const handleItemPriceChange = (index, val) => {
    if (actionLoading || mode === 'SAVING') return;
    markDirtyAndEdit();
    setOrderItems(prev => {
      const updated = [...prev];
      const p = parseFloat(val) || 0;
      const q = parseFloat(updated[index].quantity) || 0;
      const amt = q * p;

      updated[index] = {
        ...updated[index],
        price: val,
        amount: amt > 0 ? amt.toFixed(2) : '0.00'
      };
      return updated;
    });
  };

  // Amount input change: calculate Price = Amount / Quantity (if qty > 0)
  const handleItemAmountChange = (index, val) => {
    if (actionLoading || mode === 'SAVING') return;
    markDirtyAndEdit();
    setOrderItems(prev => {
      const updated = [...prev];
      const amt = parseFloat(val) || 0;
      const q = parseFloat(updated[index].quantity) || 0;
      let p = parseFloat(updated[index].price) || 0;
      if (q > 0) {
        p = amt / q;
      }

      updated[index] = {
        ...updated[index],
        amount: val,
        price: p > 0 ? p.toFixed(2) : updated[index].price
      };
      return updated;
    });
  };

  // ==========================================
  // CALCULATIONS
  // ==========================================
  const calculations = useMemo(() => {
    let totalQty = 0;
    let totalVal = 0;
    let validRows = 0;

    orderItems.forEach(item => {
      const hasProduct = Boolean(item.productId || (item.productName && item.productName.trim()));
      const q = parseFloat(item.quantity) || 0;
      const p = parseFloat(item.price) || 0;
      const amt = parseFloat(item.amount) || (q * p);

      if (hasProduct || q > 0 || amt > 0) {
        validRows += 1;
        totalQty += q;
        totalVal += amt;
      }
    });

    return {
      validRows,
      totalQty: totalQty.toFixed(3),
      value: totalVal.toFixed(2),
      grandTotal: totalVal.toFixed(2)
    };
  }, [orderItems]);

  // ==========================================
  // ACTION BAR HANDLERS
  // ==========================================

  // 1. ADD
  const handleAdd = async () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Discard and start a new purchase order?');
      if (!confirmDiscard) return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    await resetToAddMode();
  };

  // 2. PREVIOUS
  const handlePrevious = async () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Discard and load the previous purchase order?');
      if (!confirmDiscard) return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(true);
    try {
      const prevData = await getPreviousPurchase(currentPurchase?.id, effectiveOrgId);
      if (prevData) {
        populatePurchaseIntoState(prevData);
        setMode('VIEW');
        setSuccessMsg(`Loaded Serial Number #${cleanSerialNumber(prevData.purchaseNumber)}`);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'No preceding record found for this office.');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. NEXT
  const handleNext = async () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Discard and load the next record?');
      if (!confirmDiscard) return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(true);
    try {
      const nextData = await getNextPurchase(currentPurchase?.id, effectiveOrgId);
      if (nextData) {
        populatePurchaseIntoState(nextData);
        setMode('VIEW');
        setSuccessMsg(`Loaded Serial Number #${cleanSerialNumber(nextData.purchaseNumber)}`);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'No subsequent record found for this office.');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. CORE SAVE LOGIC
  const executeSave = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!partyName || !partyName.trim()) {
      setErrorMsg('Party Name is required before saving.');
      return null;
    }

    const validLines = orderItems
      .filter(item => Boolean(item.productId || (item.productName && item.productName.trim())))
      .map(item => {
        const q = parseFloat(item.quantity) || 0;
        const p = parseFloat(item.price) || 0;
        const amt = parseFloat(item.amount) || (q * p);
        return {
          productId: item.productId ? parseInt(item.productId, 10) : null,
          productNameSnapshot: item.productName.trim(),
          productCategorySnapshot: 'General',
          productSizeSnapshot: '-',
          productSpecificationsSnapshot: item.description?.trim() || null,
          quantity: q,
          carbonType: 'Low Carbon',
          unit: 'Ton',
          rate: p,
          amount: amt
        };
      });

    if (validLines.length === 0) {
      setErrorMsg('Please add at least one product row with a product name.');
      return null;
    }

    const invalidQtyRow = validLines.find(line => line.quantity <= 0);
    if (invalidQtyRow) {
      setErrorMsg(`Product "${invalidQtyRow.productNameSnapshot}" must have a quantity greater than 0.`);
      return null;
    }

    const payload = {
      purchaseNumber: cleanSerialNumber(orderNumber) || undefined,
      purchaseDate: orderDate,
      partyName: partyName.trim(),
      vendorName: partyName.trim(),
      purchaseDetails: orderRemark || null,
      remarks: orderRemark || null,
      items: validLines,
      organizationId: effectiveOrgId ? parseInt(effectiveOrgId, 10) : undefined
    };

    const prevMode = mode;
    setMode('SAVING');
    setActionLoading(true);

    try {
      let savedRecord = null;
      if (prevMode === 'EDIT' && currentPurchase?.id) {
        savedRecord = await updatePurchase(currentPurchase.id, payload);
        setSuccessMsg(`Serial Number #${cleanSerialNumber(savedRecord.purchaseNumber || orderNumber)} updated successfully.`);
      } else {
        const res = await createPurchase(payload);
        savedRecord = res.purchase || res;
        setSuccessMsg(`Serial Number #${cleanSerialNumber(savedRecord.purchaseNumber || orderNumber)} created successfully.`);
      }

      populatePurchaseIntoState(savedRecord);
      setMode('VIEW');
      setIsDirty(false);
      return savedRecord;
    } catch (err) {
      console.error('Failed to save record:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to save record. Please check inputs.');
      setMode(prevMode === 'ADD' ? 'ADD' : 'EDIT');
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  // 5. SAVE BUTTON (No print redirect)
  const handleSaveOnly = async () => {
    await executeSave();
  };

  // 6. PRINT & SAVE BUTTON
  const handlePrintAndSave = async () => {
    if (mode === 'VIEW' && currentPurchase?.id && !isDirty) {
      navigate(`/purchases/${currentPurchase.id}/print`);
      return;
    }

    const savedRecord = await executeSave();
    if (savedRecord?.id) {
      navigate(`/purchases/${savedRecord.id}/print`);
    }
  };

  // 7. OPEN SEARCH MODAL
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
      (p.purchaseDate && p.purchaseDate.includes(q))
    ).slice(0, 50);
  }, [allPurchases, searchQuery]);

  const isSaving = mode === 'SAVING';

  return (
    <div className="w-full h-full flex flex-col bg-[#e6e9ed] border border-[#7f9db9] text-black text-xs select-none overflow-hidden font-sans">
      
      {/* Notifications */}
      {errorMsg && (
        <div className="shrink-0 bg-red-100 border-b border-red-300 text-red-800 px-3 py-0.5 flex items-center justify-between text-[11px] font-medium">
          <span>⚠ {errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')} className="font-bold text-red-900 ml-2 cursor-pointer">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="shrink-0 bg-emerald-100 border-b border-emerald-300 text-emerald-900 px-3 py-0.5 flex items-center justify-between text-[11px] font-medium">
          <span>✓ {successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg('')} className="font-bold text-emerald-900 ml-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          VOUCHER BODY (LOCKED HEIGHT, ZERO VERTICAL SCROLLBAR)
         ───────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col p-1.5 space-y-1 bg-[#e6e9ed] overflow-hidden min-h-0">

        {/* TOP SECTION: Date, Serial Number, Center Title, Mode Indicator, Right Info */}
        <div className="shrink-0 grid grid-cols-12 gap-1 items-start">
          
          {/* Top Left: Date and Serial Number */}
          <div className="col-span-12 md:col-span-4 space-y-0.5">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-[11px] text-black w-22">Date</span>
              <input
                type="text"
                value={formatToDisplayDate(orderDate)}
                disabled={isSaving}
                onChange={(e) => {
                  markDirtyAndEdit();
                  setOrderDate(parseDisplayDateToIso(e.target.value));
                }}
                placeholder="DD-MM-YYYY"
                className="w-24 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] text-black font-semibold focus:outline-none focus:bg-white"
              />
              <span className="font-bold text-[11px] text-black">
                {getDayOfWeekName(orderDate)}
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-[11px] text-black w-22">Serial Number</span>
              <input
                type="text"
                readOnly
                value={orderNumber || ''}
                placeholder="Serial No."
                className="w-24 h-5 bg-[#e4ebf5] border border-[#7f9db9] px-1 text-[11px] text-black font-bold cursor-not-allowed select-none"
                title="Serial Number is generated automatically and cannot be edited"
              />
            </div>
          </div>

          {/* Top Center: "Purchase Order" and Mode in RED */}
          <div className="col-span-12 md:col-span-4 text-center">
            <h1 className="font-serif text-[22px] leading-tight text-black font-normal tracking-wide">
              Purchase Order
            </h1>
            <div className="text-red-600 font-bold text-[12px] leading-tight">
              {mode === 'VIEW' ? 'View' : mode === 'ADD' ? 'Add' : mode === 'EDIT' ? 'Edit' : 'Saving'}
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
                    disabled={isDirty}
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
            HEADER FORM FIELDS: Party Name (Vendor / Supplier)
           ───────────────────────────────────────────────────────────── */}
        <div className="shrink-0 bg-[#d9e8fb] border border-[#7f9db9] p-1 text-xs">
          <div className="flex items-center space-x-2">
            <label className="font-bold text-[11px] text-black w-22 shrink-0">Party Name</label>
            <div className="flex-1 relative">
              <input
                type="text"
                value={partyName}
                disabled={isSaving}
                placeholder="Enter party name..."
                onFocus={() => setShowPartySuggestions(true)}
                onChange={(e) => {
                  markDirtyAndEdit();
                  setPartyName(e.target.value);
                  setShowPartySuggestions(true);
                }}
                className="w-full h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] font-bold text-black focus:outline-none focus:bg-white"
              />

              {/* Suggestions Dropdown for Party Name */}
              {showPartySuggestions && partySuggestions.length > 0 && (
                <div className="absolute top-full left-0 z-50 w-full bg-white border border-[#7f9db9] shadow-lg max-h-40 overflow-y-auto text-xs">
                  <div className="bg-[#b3d1f5] text-slate-900 px-2 py-0.5 text-[10px] font-bold border-b border-[#7f9db9]">
                    Previous Parties ({partySuggestions.filter(p => !partyName || p.toLowerCase().includes(partyName.toLowerCase())).length})
                  </div>
                  {partySuggestions
                    .filter(p => !partyName || p.toLowerCase().includes(partyName.toLowerCase()))
                    .map((p, idx) => (
                      <div
                        key={idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          markDirtyAndEdit();
                          setPartyName(p);
                          setShowPartySuggestions(false);
                        }}
                        className="px-2 py-1 cursor-pointer hover:bg-blue-100 flex items-center justify-between font-medium"
                      >
                        <span>{p}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-1 shrink-0 text-slate-700 pl-2">
              <span className="font-bold text-[11px]">Items:</span>
              <span className="font-mono font-bold bg-white px-1.5 py-0.5 border border-[#7f9db9] text-[11px]">{calculations.validRows}</span>
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
                  <th className="border-r border-[#7f9db9] px-2 py-0.5 text-left min-w-[220px]">Description</th>
                  <th className="border-r border-[#7f9db9] px-2 py-0.5 text-right w-28">Quantity</th>
                  <th className="border-r border-[#7f9db9] px-2 py-0.5 text-right w-28">Price</th>
                  <th className="px-2 py-0.5 text-right w-36">Amount</th>
                </tr>
              </thead>
            </table>
          </div>

          {/* Table Body (Scrolls internally if rows exceed container) */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full border-collapse text-xs">
              <tbody>
                {orderItems.map((item, idx) => {
                  const isActive = idx === activeRowIdx;
                  const filtered = getFilteredProducts(item.productName);
                  const hasProduct = Boolean(item.productId || (item.productName && item.productName.trim()));
                  const hasRowData = Boolean(
                    hasProduct ||
                    (item.quantity && item.quantity !== '') ||
                    (item.price && item.price !== '')
                  );

                  return (
                    <tr
                      key={idx}
                      onClick={() => setActiveRowIdx(idx)}
                      className={`h-5 border-b border-[#c0c0c0] ${isActive ? 'bg-[#f4f7fc]' : 'bg-white hover:bg-slate-50'}`}
                    >
                      {/* Active Row Indicator */}
                      <td className="w-6 border-r border-[#7f9db9] text-center text-black font-bold p-0 select-none">
                        {isActive ? '▸' : ''}
                      </td>

                      {/* Product Name */}
                      <td className="border-r border-[#7f9db9] p-0 relative min-w-[200px]">
                        <input
                          type="text"
                          value={item.productName}
                          disabled={isSaving}
                          onChange={(e) => handleProductNameInputChange(idx, e.target.value)}
                          onFocus={() => {
                            setActiveRowIdx(idx);
                            if (!isSaving) {
                              setActiveAutocompleteIdx(idx);
                              setHighlightedSuggestionIdx(0);
                            }
                          }}
                          onKeyDown={(e) => handleProductInputKeyDown(e, idx, filtered)}
                          className="w-full h-5 px-1 text-xs text-black bg-transparent border-0 outline-none font-medium"
                        />

                        {/* Autocomplete Suggestions Box */}
                        {!isSaving && activeAutocompleteIdx === idx && (
                          <div className="absolute top-full left-0 z-50 min-w-[280px] bg-white border border-[#7f9db9] shadow-lg text-xs">
                            <div className="bg-[#b3d1f5] text-slate-900 px-2 py-0.5 text-[10px] font-bold border-b border-[#7f9db9]">
                              Product Suggestions ({filtered.length})
                            </div>
                            <div className="max-h-40 overflow-y-auto">
                              {filtered.length === 0 ? (
                                <div className="p-2 text-slate-500 italic">No products found</div>
                              ) : (
                                filtered.map((p, pIdx) => (
                                  <div
                                    key={p.id}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleSelectProductSuggestion(idx, p);
                                    }}
                                    className={`px-2 py-1 cursor-pointer flex justify-between items-center ${
                                      pIdx === highlightedSuggestionIdx ? 'bg-[#cce4f7] font-bold' : 'hover:bg-slate-100'
                                    }`}
                                  >
                                    <span>{p.name}</span>
                                    {p.specifications && (
                                      <span className="font-mono text-[11px] text-slate-600 truncate max-w-[120px]">
                                        {p.specifications}
                                      </span>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Description (Optional) */}
                      <td className="border-r border-[#7f9db9] p-0 min-w-[220px]">
                        <input
                          type="text"
                          value={item.description}
                          disabled={isSaving}
                          onChange={(e) => handleItemDescriptionChange(idx, e.target.value)}
                          onFocus={() => setActiveRowIdx(idx)}
                          className="w-full h-5 px-1 text-xs text-black bg-transparent border-0 outline-none"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="border-r border-[#7f9db9] p-0 text-right w-28">
                        <input
                          type="number"
                          step="any"
                          value={item.quantity}
                          disabled={isSaving}
                          onChange={(e) => handleItemQuantityChange(idx, e.target.value)}
                          onFocus={() => setActiveRowIdx(idx)}
                          className="w-full h-5 px-1 text-right text-xs font-mono text-black bg-transparent border-0 outline-none"
                        />
                      </td>

                      {/* Price */}
                      <td className="border-r border-[#7f9db9] p-0 text-right w-28">
                        <input
                          type="number"
                          step="any"
                          value={hasRowData ? item.price : ''}
                          disabled={isSaving}
                          onChange={(e) => handleItemPriceChange(idx, e.target.value)}
                          onFocus={() => setActiveRowIdx(idx)}
                          className="w-full h-5 px-1 text-right text-xs font-mono font-medium text-black bg-transparent border-0 outline-none focus:bg-white"
                        />
                      </td>

                      {/* Amount (Quantity * Price) */}
                      <td className="p-0 text-right w-36">
                        <input
                          type="number"
                          step="any"
                          value={hasProduct ? (item.amount && item.amount !== '0.00' ? item.amount : '') : (item.amount && item.amount !== '0.00' ? item.amount : '')}
                          disabled={isSaving}
                          onChange={(e) => handleItemAmountChange(idx, e.target.value)}
                          onFocus={() => setActiveRowIdx(idx)}
                          className="w-full h-5 px-1 text-right text-xs font-mono font-semibold text-black bg-transparent border-0 outline-none focus:bg-white"
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
            <span className="font-bold text-[11px] text-black">Total Qty</span>
            <input
              type="text"
              readOnly
              value={calculations.totalQty}
              className="w-28 h-5 bg-white border border-[#7f9db9] px-1 text-right font-mono font-bold text-black text-[11px]"
              title="Total Quantity"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[11px] text-black">Value</span>
            <input
              type="text"
              readOnly
              value={calculations.value}
              className="w-36 h-5 bg-white border border-[#7f9db9] px-2 text-right font-mono font-bold text-black text-[11px]"
              title="Total Order Value"
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
              disabled={isSaving}
              onChange={(e) => {
                markDirtyAndEdit();
                setOrderRemark(e.target.value);
              }}
              className="flex-1 h-12 bg-[#cce4f7] border border-[#7f9db9] px-1.5 py-0.5 text-xs text-black focus:outline-none focus:bg-white resize-none"
            />
          </div>

          {/* Lower Right: Grand Total */}
          <div className="md:col-span-4 flex flex-col justify-end space-y-1 text-right">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-black">Value</span>
              <input
                type="text"
                readOnly
                value={calculations.value}
                className="w-32 h-5 bg-white border border-[#7f9db9] px-1 text-right font-mono font-bold text-black text-[11px]"
              />
            </div>

            <div className="flex items-center justify-between pt-0.5 border-t border-[#7f9db9]">
              <span className="font-black text-[12px] text-black uppercase">GRAND TOTAL</span>
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
            BOTTOM ACTION BUTTON BAR: Add, Previous, Next, Save, Print & Save
           ───────────────────────────────────────────────────────────── */}
        <div className="shrink-0 pt-1 border-t border-[#7f9db9]">
          <div className="flex items-center justify-between gap-1">
            
            {/* Left: Add, < Previous, Next >, Save */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleAdd}
                disabled={actionLoading}
                className="px-3 py-1 bg-[#ece9d8] hover:bg-[#f5f4ef] text-black font-semibold text-xs border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-[#707070] border-b-[#707070] active:border-t-[#707070] active:border-l-[#707070] active:border-r-white active:border-b-white disabled:opacity-50 select-none cursor-pointer outline-dotted outline-1 outline-[#404040] outline-offset-[-3px]"
              >
                Add
              </button>

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
                onClick={handleSaveOnly}
                disabled={actionLoading}
                className="px-4 py-1 bg-[#ece9d8] hover:bg-[#f5f4ef] text-black font-bold text-xs border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-[#707070] border-b-[#707070] active:border-t-[#707070] active:border-l-[#707070] active:border-r-white active:border-b-white disabled:opacity-50 select-none cursor-pointer"
                title="Save record only without printing"
              >
                {actionLoading && mode === 'SAVING' ? 'Saving...' : 'Save'}
              </button>
            </div>

            {/* Right: Print & Save */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={handlePrintAndSave}
                disabled={actionLoading}
                className="px-4 py-1 bg-[#ece9d8] hover:bg-[#f5f4ef] text-black font-bold text-xs border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-[#707070] border-b-[#707070] active:border-t-[#707070] active:border-l-[#707070] active:border-r-white active:border-b-white disabled:opacity-50 select-none cursor-pointer"
              >
                {actionLoading && mode === 'SAVING' ? 'Saving...' : 'Print & Save'}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          SEARCH MODAL
         ───────────────────────────────────────────────────────────── */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#ece9d8] border-2 border-[#7f9db9] w-full max-w-2xl shadow-xl flex flex-col max-h-[80vh]">
            <div className="bg-[#0a246a] text-white px-2 py-1 text-xs font-bold flex justify-between items-center">
              <span>Search Purchase Orders</span>
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
                placeholder="Search by Serial Number, Party Name, or Date..."
                className="w-full h-7 px-2 text-xs border border-[#7f9db9] bg-white text-black outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-[#d9e8fb] border-b border-[#7f9db9] text-left">
                    <th className="p-1 border-r border-[#7f9db9]">Serial No.</th>
                    <th className="p-1 border-r border-[#7f9db9]">Date</th>
                    <th className="p-1 border-r border-[#7f9db9]">Party Name</th>
                    <th className="p-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-4 text-center text-slate-500">No matching orders found</td>
                    </tr>
                  ) : (
                    filteredPurchases.map(p => (
                      <tr
                        key={p.id}
                        onClick={() => {
                          populatePurchaseIntoState(p);
                          setShowSearchModal(false);
                          setMode('VIEW');
                        }}
                        className="hover:bg-blue-100 cursor-pointer border-b border-slate-200"
                      >
                        <td className="p-1 border-r border-[#7f9db9] font-mono font-bold text-blue-800">{cleanSerialNumber(p.purchaseNumber)}</td>
                        <td className="p-1 border-r border-[#7f9db9]">{p.purchaseDate}</td>
                        <td className="p-1 border-r border-[#7f9db9] font-bold">{p.vendorName || p.partyName}</td>
                        <td className="p-1 text-right font-mono font-bold">{parseFloat(p.totalAmount || 0).toFixed(2)}</td>
                      </tr>
                    ))
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
    </div>
  );
}
