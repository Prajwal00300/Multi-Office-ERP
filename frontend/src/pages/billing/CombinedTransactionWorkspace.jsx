import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import {
  getPreviousBill,
  getNextBill,
  getFirstBill,
  getLastBill,
  getNextBillNumber,
  getBillById,
  createBill,
  updateBill
} from '../../services/billingService';

const DEFAULT_ROWS_COUNT = 30;

const BLANK_TRANSACTION_ROW = {
  productId: '',
  productName: '',
  description: '',
  difference: '0.00',
  pcs: '0',
  quantity: '',
  basicRate: '',
  finalRate: '0.00',
  amount: '0.00'
};

const createBlankRows = (count = DEFAULT_ROWS_COUNT) => {
  return Array.from({ length: count }, () => ({ ...BLANK_TRANSACTION_ROW }));
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

export default function CombinedTransactionWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialBillId = searchParams.get('billId');
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
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  // Active Transaction Record
  const [currentBill, setCurrentBill] = useState(null);

  // =========================================================================
  // Exact Header Fields from Client Screenshot
  // =========================================================================
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [billNumber, setBillNumber] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Middle Column Header Fields
  const [headerBRate, setHeaderBRate] = useState('');
  const [terms, setTerms] = useState('');
  const [vehicle, setVehicle] = useState('');

  // Right Column Header Fields (Fixed to Vat Sale, Bill, Trading Sale)
  const [taxType, setTaxType] = useState('Vat Sale');
  const [billCash, setBillCash] = useState('Bill');
  const [mfgTrd, setMfgTrd] = useState('Trading Sale');

  // =========================================================================
  // Product Items Grid State (Table)
  // Columns: ▸ | Product Name | Description | Difference | Pcs | Quantity | B.Rate | Rate | Amount
  // =========================================================================
  const [transactionItems, setTransactionItems] = useState(createBlankRows());
  const [activeRowIdx, setActiveRowIdx] = useState(0);
  const [activeAutocompleteIdx, setActiveAutocompleteIdx] = useState(null);
  const [highlightedSuggestionIdx, setHighlightedSuggestionIdx] = useState(0);
  const autocompleteContainerRef = useRef(null);

  // =========================================================================
  // Lower Section Fields
  // Left: Remark (compact), Transport, Broker
  // Center: Due Date, Total VAT (red), Shortage (qty & amt)
  // Right: Value, Exp Before Tax, Vat/Cst, Sur @, Exp After Tax, Grand Total
  // =========================================================================
  const [billRemark, setBillRemark] = useState('');
  const [transportName, setTransportName] = useState('');
  const [brokerName, setBrokerName] = useState('');

  const [billDueDate, setBillDueDate] = useState('');
  const [shortageQty, setShortageQty] = useState('');
  const [shortageAmt, setShortageAmt] = useState('');

  const [expBeforeTax, setExpBeforeTax] = useState('');
  const [billTaxRate, setBillTaxRate] = useState('18.00');
  const [surchargeRate, setSurchargeRate] = useState('');
  const [expAfterTax, setExpAfterTax] = useState('');

  // Search Modal & Dialogs
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allOfficeBills, setAllOfficeBills] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Estimate link
  const [estimateId, setEstimateId] = useState(null);

  // UI state
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const remarkTextareaRef = useRef(null);

  useEffect(() => {
    const handleKeyStatus = (e) => {
      if (e.key === 'F7') {
        e.preventDefault();
        if (remarkTextareaRef.current) {
          remarkTextareaRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyStatus);
    return () => window.removeEventListener('keydown', handleKeyStatus);
  }, []);

  // Close product autocomplete suggestions on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (autocompleteContainerRef.current && !autocompleteContainerRef.current.contains(e.target)) {
        setActiveAutocompleteIdx(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // ==========================================
  // Load Offices for Super Admin / CEO
  // ==========================================
  useEffect(() => {
    const fetchOffices = async () => {
      try {
        if (user?.role === 'SUPER_ADMIN') {
          const res = await api.get('/organizations');
          const list = res.data || [];
          setOrganizations(list);
          if (list.length > 0 && !selectedOrgId) {
            setSelectedOrgId(String(user?.organizationId || list[0].id));
          }
        } else if (user?.role === 'CEO') {
          const res = await api.get('/ceo/offices');
          const list = res.data || [];
          setOrganizations(list);
          if (list.length > 0 && !selectedOrgId) {
            setSelectedOrgId(String(user?.organizationId || list[0].id));
          }
        }
      } catch (err) {
        console.error('Failed to load offices:', err);
      }
    };
    fetchOffices();
  }, [user]);

  // ==========================================
  // Load Customers & Products for Office
  // ==========================================
  useEffect(() => {
    if (!effectiveOrgId) return;

    const loadMasters = async () => {
      try {
        const [custRes, prodRes] = await Promise.all([
          api.get(`/customers?organizationId=${effectiveOrgId}`),
          api.get(`/products?organizationId=${effectiveOrgId}&status=ACTIVE`)
        ]);
        setCustomers(custRes.data || []);
        setProducts(prodRes.data || []);
      } catch (err) {
        console.error('Failed to load master data:', err);
      }
    };
    loadMasters();
  }, [effectiveOrgId]);

  // Sync selectedCustomer based on selectedCustomerId
  useEffect(() => {
    if (!selectedCustomerId) {
      setSelectedCustomer(null);
      return;
    }
    const match = customers.find(c => String(c.id) === String(selectedCustomerId));
    setSelectedCustomer(match || null);
  }, [selectedCustomerId, customers]);

  // ==========================================
  // Initial Load: Load requested bill or latest
  // ==========================================
  useEffect(() => {
    if (!effectiveOrgId) return;

    const loadInitialTransaction = async () => {
      setErrorMsg('');
      try {
        let billData = null;
        if (initialBillId) {
          billData = await getBillById(initialBillId);
        } else {
          try {
            billData = await getPreviousBill(null, effectiveOrgId);
          } catch (navErr) {
            billData = null;
          }
        }

        if (billData) {
          populateBillIntoState(billData);
          if (searchParams.get('mode') === 'edit') {
            setMode('EDIT');
            setSuccessMsg(`Loaded Sale Voucher #${billData.billNumber} in Edit mode.`);
          } else {
            setMode('VIEW');
          }
        } else {
          await resetToAddMode();
        }
      } catch (err) {
        console.error('Initial transaction load error:', err);
        await resetToAddMode();
      }
    };

    loadInitialTransaction();
  }, [effectiveOrgId, initialBillId]);

  // ==========================================
  // Populate state from saved bill
  // ==========================================
  const populateBillIntoState = (bill) => {
    setCurrentBill(bill);
    setIsDirty(false);

    setBillDate(bill.billDate || new Date().toISOString().split('T')[0]);
    setBillNumber(bill.billNumber || '');
    setSelectedCustomerId(bill.customerId ? String(bill.customerId) : '');
    if (bill.Customer) {
      setSelectedCustomer(bill.Customer);
    }

    if (bill.Estimate) {
      setEstimateId(bill.Estimate.id);
    } else {
      setEstimateId(bill.estimateId || null);
    }

    // Notes / Remark (clean text)
    if (bill.notes && bill.notes.includes('---METADATA---')) {
      const [pureRemark] = bill.notes.split('---METADATA---');
      setBillRemark(pureRemark ? pureRemark.trim() : '');
    } else {
      setBillRemark(bill.notes || '');
    }

    // Financial totals from backend
    const transportVal = parseFloat(bill.transportCost) || 0;
    setExpBeforeTax(transportVal > 0 ? transportVal.toFixed(2) : '');

    const gstVal = parseFloat(bill.gstPercentage) || 0;
    setBillTaxRate(gstVal.toFixed(2));

    if (bill.items && bill.items.length > 0) {
      const mapped = bill.items.map(item => {
        const finalRateVal = parseFloat(item.rate) || 0;
        const qVal = parseFloat(item.quantity) || 0;
        const prod = (products && products.find(p => String(p.id) === String(item.productId))) || item.Product;
        const diffVal = prod && prod.difference !== undefined ? parseFloat(prod.difference) : 0;
        const bRateVal = finalRateVal - diffVal > 0 ? (finalRateVal - diffVal) : (finalRateVal > 0 ? finalRateVal : '');

        return {
          productId: item.productId ? String(item.productId) : '',
          productName: item.productNameSnapshot || '',
          description: item.productSpecificationsSnapshot || '',
          difference: String(diffVal.toFixed(2)),
          pcs: item.btls !== undefined && item.btls !== null ? String(item.btls) : (item.pcs !== undefined ? String(item.pcs) : '0'),
          quantity: qVal > 0 ? qVal.toFixed(3) : '',
          basicRate: bRateVal !== '' ? (typeof bRateVal === 'number' ? bRateVal.toFixed(2) : String(bRateVal)) : '',
          finalRate: finalRateVal.toFixed(2),
          amount: (finalRateVal * qVal).toFixed(2)
        };
      });

      const padded = [...mapped];
      while (padded.length < DEFAULT_ROWS_COUNT) {
        padded.push({ ...BLANK_TRANSACTION_ROW });
      }
      setTransactionItems(padded);
    } else {
      setTransactionItems(createBlankRows());
    }

    if (!billDueDate && bill.billDate) {
      setBillDueDate(bill.billDate);
    }
  };

  // ==========================================
  // Reset state to fresh ADD mode
  // ==========================================
  const resetToAddMode = async (targetOrgId) => {
    const orgId = targetOrgId || effectiveOrgId;

    setCurrentBill(null);
    setSelectedCustomerId('');
    setSelectedCustomer(null);
    const todayIso = new Date().toISOString().split('T')[0];
    setBillDate(todayIso);
    setBillDueDate(todayIso);
    setBillNumber('');

    setTransactionItems(createBlankRows());
    setEstimateId(null);

    setHeaderBRate('');
    setTerms('');
    setVehicle('');
    setTaxType('Vat Sale');
    setBillCash('Bill');
    setMfgTrd('Trading Sale');
    setBillRemark('');
    setTransportName('');
    setBrokerName('');
    setShortageQty('');
    setShortageAmt('');
    setExpBeforeTax('');
    setBillTaxRate('18.00');
    setSurchargeRate('');
    setExpAfterTax('');

    setIsDirty(false);
    setErrorMsg('');
    setSuccessMsg('');
    setMode('ADD');
    setActiveRowIdx(0);

    // Fetch next upcoming bill number preview
    try {
      const billRes = await getNextBillNumber(orgId);
      if (billRes?.nextBillNumber) {
        setBillNumber(billRes.nextBillNumber);
      }
    } catch (err) {
      console.warn('Could not fetch next number preview:', err);
    }
  };

  // ==========================================
  // Real-Time Calculations Engine
  // ==========================================
  const calculations = useMemo(() => {
    let totalPcs = 0;
    let totalQty = 0;
    let value = 0;

    transactionItems.forEach(item => {
      const hasContent = Boolean(item.productId || (item.productName && item.productName.trim()));
      const pcs = parseInt(item.pcs, 10) || 0;
      const q = parseFloat(item.quantity) || 0;
      const bRate = parseFloat(item.basicRate) || 0;
      const diff = parseFloat(item.difference) || 0;
      const fRate = bRate + diff;
      const amt = q * fRate;

      if (hasContent || amt > 0 || q > 0) {
        totalPcs += pcs;
        totalQty += q;
        value += amt;
      }
    });

    // Align with backend billingCalculationService
    const expBefore = parseFloat(expBeforeTax) || 0;
    const taxPercent = parseFloat(billTaxRate) || 0;
    const totalVat = (value * taxPercent) / 100;
    const grandTotalVal = value + totalVat + expBefore;

    return {
      totalPcs,
      totalQty: totalQty.toFixed(3),
      value: value.toFixed(2),
      totalVat: totalVat.toFixed(2),
      grandTotal: grandTotalVal.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      rawGrandTotal: grandTotalVal
    };
  }, [
    transactionItems,
    expBeforeTax,
    billTaxRate
  ]);

  // ==========================================
  // Grid Handlers
  // ==========================================
  const getFilteredProducts = (query) => {
    if (!query || !query.trim()) {
      return products.slice(0, 10);
    }
    const q = query.toLowerCase().trim();
    return products.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.specifications && p.specifications.toLowerCase().includes(q))
    ).slice(0, 15);
  };

  // Helper to mark dirty and switch to edit mode when any field is changed
  const markDirtyAndEdit = () => {
    setIsDirty(true);
    if (mode === 'VIEW') {
      setMode('EDIT');
    }
  };

  const handleProductNameInputChange = (index, text) => {
    if (actionLoading || mode === 'SAVING') return;
    markDirtyAndEdit();
    setActiveRowIdx(index);
    setActiveAutocompleteIdx(index);
    setHighlightedSuggestionIdx(0);

    setTransactionItems(prev => {
      const updated = [...prev];
      const match = products.find(p => p.name.toLowerCase() === text.trim().toLowerCase());

      const bRate = updated[index].isCustomBRate
        ? updated[index].basicRate
        : (headerBRate || updated[index].basicRate || '');
      let diff = parseFloat(updated[index].difference) || 0;
      let prodId = updated[index].productId;
      let desc = updated[index].description;

      if (match) {
        prodId = String(match.id);
        desc = match.specifications || match.description || desc;
        diff = match.difference !== undefined && match.difference !== null
          ? parseFloat(match.difference)
          : 0;
      }

      const bRateNum = parseFloat(bRate) || 0;
      const fRate = bRateNum + diff;
      const q = parseFloat(updated[index].quantity) || 0;

      updated[index] = {
        ...updated[index],
        productId: prodId,
        productName: text,
        description: desc,
        basicRate: String(bRate),
        difference: diff.toFixed(2),
        finalRate: fRate.toFixed(2),
        amount: (fRate * q).toFixed(2)
      };
      return updated;
    });
  };

  const handleSelectProductSuggestion = (index, prod) => {
    if (actionLoading || mode === 'SAVING') return;
    markDirtyAndEdit();
    setActiveRowIdx(index);

    setTransactionItems(prev => {
      const updated = [...prev];
      const prodDiff = prod.difference !== undefined && prod.difference !== null
        ? parseFloat(prod.difference)
        : 0;
      const bRate = updated[index].isCustomBRate
        ? updated[index].basicRate
        : (headerBRate || updated[index].basicRate || '');
      const bRateNum = parseFloat(bRate) || 0;
      const fRate = bRateNum + prodDiff;
      const q = parseFloat(updated[index].quantity) || 0;

      updated[index] = {
        ...updated[index],
        productId: String(prod.id),
        productName: prod.name,
        description: prod.specifications || prod.description || prod.name,
        difference: prodDiff.toFixed(2),
        pcs: updated[index].pcs || '0',
        quantity: updated[index].quantity || '',
        basicRate: String(bRate),
        finalRate: fRate.toFixed(2),
        amount: (fRate * q).toFixed(2)
      };
      return updated;
    });
    setActiveAutocompleteIdx(null);
    setHighlightedSuggestionIdx(0);
  };

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

  const handleItemDescriptionChange = (index, val) => {
    if (actionLoading || mode === 'SAVING') return;
    markDirtyAndEdit();
    setTransactionItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], description: val };
      return updated;
    });
  };

  const handleItemDifferenceChange = (index, val) => {
    if (actionLoading || mode === 'SAVING') return;
    markDirtyAndEdit();
    setTransactionItems(prev => {
      const updated = [...prev];
      const diff = parseFloat(val) || 0;
      const bRateStr = updated[index].isCustomBRate
        ? updated[index].basicRate
        : (headerBRate || updated[index].basicRate || '');
      const bRate = parseFloat(bRateStr) || 0;
      const fRate = bRate + diff;
      const q = parseFloat(updated[index].quantity) || 0;

      updated[index] = {
        ...updated[index],
        difference: val,
        basicRate: bRateStr,
        finalRate: fRate.toFixed(2),
        amount: (fRate * q).toFixed(2)
      };
      return updated;
    });
  };

  const handleItemPcsChange = (index, val) => {
    if (actionLoading || mode === 'SAVING') return;
    markDirtyAndEdit();
    setTransactionItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], pcs: val };
      return updated;
    });
  };

  const handleItemQuantityChange = (index, val) => {
    if (actionLoading || mode === 'SAVING') return;
    markDirtyAndEdit();
    setTransactionItems(prev => {
      const updated = [...prev];
      const q = parseFloat(val) || 0;
      const diff = parseFloat(updated[index].difference) || 0;
      const bRate = parseFloat(updated[index].basicRate || headerBRate || 0) || 0;
      const fRate = bRate + diff;

      updated[index] = {
        ...updated[index],
        quantity: val,
        finalRate: fRate.toFixed(2),
        amount: (fRate * q).toFixed(2)
      };
      return updated;
    });
  };

  const handleItemBasicRateChange = (index, val) => {
    if (actionLoading || mode === 'SAVING') return;
    markDirtyAndEdit();
    setTransactionItems(prev => {
      const updated = [...prev];
      const isCustom = val !== '' && val !== headerBRate;
      const diff = parseFloat(updated[index].difference) || 0;
      const bRate = parseFloat(val) || 0;
      const fRate = bRate + diff;
      const q = parseFloat(updated[index].quantity) || 0;

      updated[index] = {
        ...updated[index],
        basicRate: val,
        isCustomBRate: isCustom,
        finalRate: fRate.toFixed(2),
        amount: (fRate * q).toFixed(2)
      };
      return updated;
    });
  };

  // Direct Rate change: calculate Difference = Rate - B.Rate, Amount = Rate * Quantity
  const handleItemRateChange = (index, val) => {
    if (actionLoading || mode === 'SAVING') return;
    markDirtyAndEdit();
    setTransactionItems(prev => {
      const updated = [...prev];
      const fRate = parseFloat(val) || 0;
      const bRate = parseFloat(updated[index].basicRate || headerBRate || 0) || 0;
      const diff = fRate - bRate;
      const q = parseFloat(updated[index].quantity) || 0;

      updated[index] = {
        ...updated[index],
        finalRate: val,
        difference: diff.toFixed(2),
        amount: (fRate * q).toFixed(2)
      };
      return updated;
    });
  };

  // Direct Amount change: calculate Rate = Amount / Quantity (if qty > 0)
  const handleItemAmountChange = (index, val) => {
    if (actionLoading || mode === 'SAVING') return;
    markDirtyAndEdit();
    setTransactionItems(prev => {
      const updated = [...prev];
      const amt = parseFloat(val) || 0;
      const q = parseFloat(updated[index].quantity) || 0;
      let fRate = parseFloat(updated[index].finalRate) || 0;
      if (q > 0) {
        fRate = amt / q;
      }
      const bRate = parseFloat(updated[index].basicRate || headerBRate || 0) || 0;
      const diff = fRate - bRate;

      updated[index] = {
        ...updated[index],
        amount: val,
        finalRate: fRate > 0 ? fRate.toFixed(2) : updated[index].finalRate,
        difference: diff.toFixed(2)
      };
      return updated;
    });
  };

  // Header B.Rate change: propagate to all rows (unless user set a custom row B.Rate)
  const handleHeaderBRateChange = (val) => {
    if (actionLoading || mode === 'SAVING') return;
    markDirtyAndEdit();
    setHeaderBRate(val);
    setTransactionItems(prev => {
      return prev.map(item => {
        // If user explicitly entered a custom B.Rate for this specific row, don't overwrite it
        if (item.isCustomBRate) {
          return item;
        }

        const hasProduct = Boolean(item.productId || (item.productName && item.productName.trim()));
        const diff = parseFloat(item.difference) || 0;
        const bRate = parseFloat(val) || 0;
        const fRate = bRate + diff;
        const q = parseFloat(item.quantity) || 0;

        return {
          ...item,
          basicRate: hasProduct ? val : '',
          finalRate: hasProduct ? fRate.toFixed(2) : '0.00',
          amount: hasProduct ? (fRate * q).toFixed(2) : '0.00'
        };
      });
    });
  };

  // =========================================================================
  // TOOLBAR ACTION HANDLERS
  // Buttons: Add, Edit, <Previous, Next >, First, Last, Search, Move, Print, Vch.Prn, Exit, Save
  // =========================================================================

  // 1. ADD
  const handleAdd = async () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Discard and start a new sale voucher?');
      if (!confirmDiscard) return;
    }
    await resetToAddMode();
    setSuccessMsg('Ready for new entry. Select customer, enter products and quantities.');
  };

  // 2. EDIT
  const handleEdit = () => {
    if (!currentBill) {
      setErrorMsg('No saved sale voucher is currently loaded to edit.');
      return;
    }
    setMode('EDIT');
    setSuccessMsg('Edit mode active. You may now modify the voucher details.');
  };

  // 3. PREVIOUS (<Previous)
  const handlePrevious = async () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Discard and navigate to the previous voucher?');
      if (!confirmDiscard) return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const prevBill = await getPreviousBill(currentBill?.id || null, effectiveOrgId);
      if (prevBill) {
        populateBillIntoState(prevBill);
        setMode('VIEW');
        setSuccessMsg(`Loaded previous Sale Voucher #${prevBill.billNumber}.`);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'No earlier voucher found for this office.';
      setErrorMsg(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. NEXT (Next >)
  const handleNext = async () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Discard and navigate to the next voucher?');
      if (!confirmDiscard) return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const nextBill = await getNextBill(currentBill?.id || null, effectiveOrgId);
      if (nextBill) {
        populateBillIntoState(nextBill);
        setMode('VIEW');
        setSuccessMsg(`Loaded Sale Voucher #${nextBill.billNumber}.`);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'No subsequent voucher found for this office.';
      setErrorMsg(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // 5. FIRST
  const handleFirst = async () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Discard and navigate to the first voucher?');
      if (!confirmDiscard) return;
    }

    setActionLoading(true);
    setErrorMsg('');
    try {
      const firstBill = await getFirstBill(effectiveOrgId);
      if (firstBill) {
        populateBillIntoState(firstBill);
        setMode('VIEW');
        setSuccessMsg(`Loaded first Sale Voucher #${firstBill.billNumber}.`);
      } else {
        setErrorMsg('No vouchers found for this office.');
      }
    } catch (err) {
      setErrorMsg('Could not load the first voucher.');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. LAST
  const handleLast = async () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Discard and navigate to the latest voucher?');
      if (!confirmDiscard) return;
    }

    setActionLoading(true);
    setErrorMsg('');
    try {
      const lastBill = await getLastBill(effectiveOrgId);
      if (lastBill) {
        populateBillIntoState(lastBill);
        setMode('VIEW');
        setSuccessMsg(`Loaded latest Sale Voucher #${lastBill.billNumber}.`);
      } else {
        setErrorMsg('No vouchers found for this office.');
      }
    } catch (err) {
      setErrorMsg('Could not load the latest voucher.');
    } finally {
      setActionLoading(false);
    }
  };

  // 7. SEARCH
  const handleOpenSearch = async () => {
    setSearchModalOpen(true);
    setSearchLoading(true);
    try {
      const res = await api.get(`/bills${effectiveOrgId ? `?organizationId=${effectiveOrgId}` : ''}`);
      setAllOfficeBills(res.data || []);
    } catch (err) {
      console.error('Failed to load bills for search:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectSearchResult = async (billId) => {
    setSearchModalOpen(false);
    setActionLoading(true);
    try {
      const billData = await getBillById(billId);
      if (billData) {
        populateBillIntoState(billData);
        setMode('VIEW');
        setSuccessMsg(`Loaded Sale Voucher #${billData.billNumber}.`);
      }
    } catch (err) {
      setErrorMsg('Failed to load selected voucher.');
    } finally {
      setActionLoading(false);
    }
  };

  // 8. MOVE (Advance / Focus row)
  const handleMove = () => {
    setActiveRowIdx(prev => (prev + 1) % transactionItems.length);
  };

  // 9. PRINT
  const handlePrintBill = () => {
    if (!currentBill?.id) {
      alert('Please save the sale voucher first before printing.');
      return;
    }
    window.open(`/bills/${currentBill.id}/print`, '_blank');
  };

  // 10. VCH.PRN (Print Estimate / Voucher)
  const handlePrintEstimate = () => {
    const idToPrint = estimateId || currentBill?.estimateId;
    if (!idToPrint) {
      alert('Please save the transaction first to generate printable voucher.');
      return;
    }
    window.open(`/estimates/${idToPrint}/print`, '_blank');
  };

  // 11. EXIT
  const handleExit = () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Do you want to exit without saving?');
      if (!confirmDiscard) return;
    }
    navigate('/bills');
  };

  // Reusable core save function for both Save and Print & Save
  const saveBillRecord = async () => {
    if (!selectedCustomerId) {
      setErrorMsg('Please select a Customer before saving.');
      return null;
    }

    const filledItems = transactionItems.filter(item =>
      Boolean(item.productId || (item.productName && item.productName.trim()) || (item.description && item.description.trim()))
    );

    if (filledItems.length === 0) {
      setErrorMsg('Voucher must contain at least one product item.');
      return null;
    }

    for (let i = 0; i < filledItems.length; i++) {
      const item = filledItems[i];
      if (!item.productName.trim() && !item.productId) {
        setErrorMsg(`Row #${i + 1}: Please select a product or enter description.`);
        return null;
      }
      if (parseFloat(item.quantity) <= 0 || isNaN(parseFloat(item.quantity))) {
        setErrorMsg(`Row #${i + 1} (${item.productName || 'Product'}): Quantity must be greater than zero.`);
        return null;
      }
    }

    setActionLoading(true);
    setMode('SAVING');
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. Prepare bill items strictly matching backend BillItem schema
      const billItemsPayload = filledItems.map(item => {
        let prod = products.find(p => String(p.id) === String(item.productId));
        if (!prod && item.productName) {
          prod = products.find(p => p.name.toLowerCase() === item.productName.trim().toLowerCase());
        }
        const resolvedProdId = item.productId ? parseInt(item.productId, 10) : (prod ? prod.id : null);
        return {
          productId: resolvedProdId,
          productNameSnapshot: item.productName.trim(),
          productCategorySnapshot: prod?.category || null,
          productSizeSnapshot: prod?.size || null,
          productSpecificationsSnapshot: item.description ? item.description.trim() : (prod?.specifications || null),
          btls: item.pcs ? String(item.pcs).trim() : null,
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit || prod?.unit || 'Ton',
          rate: parseFloat(item.finalRate) || 0
        };
      });

      // 2. Prepare bill payload strictly matching backend Bill model (marking completed sale as FINALIZED)
      const billPayload = {
        organizationId: effectiveOrgId,
        customerId: parseInt(selectedCustomerId, 10),
        estimateId: estimateId || null,
        billDate: billDate,
        items: billItemsPayload,
        gstPercentage: parseFloat(billTaxRate) || 0,
        transportCost: parseFloat(expBeforeTax) || 0,
        notes: billRemark ? billRemark.trim() : null,
        status: 'FINALIZED'
      };

      let savedRecord = null;
      if (currentBill?.id) {
        const res = await updateBill(currentBill.id, billPayload);
        savedRecord = res.bill || res;
      } else {
        const res = await createBill(billPayload);
        savedRecord = res.bill || res;
      }

      setIsDirty(false);
      populateBillIntoState(savedRecord);
      setMode('VIEW');
      return savedRecord;
    } catch (err) {
      console.error('Error saving transaction:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to save voucher.';
      setErrorMsg(msg);
      setMode(currentBill?.id ? 'EDIT' : 'ADD');
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  // SAVE ONLY: saves the sale voucher without printing
  const handleSaveOnly = async () => {
    const savedRecord = await saveBillRecord();
    if (savedRecord) {
      setSuccessMsg(`Sale Voucher #${savedRecord.billNumber} saved successfully.`);
    }
  };

  // PRINT & SAVE: saves the sale voucher and redirects user to print receipt page
  const handlePrintAndSave = async () => {
    // If voucher is already saved as FINALIZED and has no unsaved changes, navigate directly to print
    if (!isDirty && currentBill?.id && currentBill?.status === 'FINALIZED') {
      navigate(`/bills/${currentBill.id}/print`);
      return;
    }

    const savedRecord = await saveBillRecord();
    if (savedRecord) {
      navigate(`/bills/${savedRecord.id}/print`);
    }
  };

  const isSaving = mode === 'SAVING' || actionLoading;

  // Today Date & Day
  const todayDateObj = new Date();
  const todayDateStr = `${String(todayDateObj.getDate()).padStart(2, '0')}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-${todayDateObj.getFullYear()}`;
  const todayDayStr = todayDateObj.toLocaleDateString('en-US', { weekday: 'long' });

  // Filtered bills for Search Modal
  const filteredSearchBills = useMemo(() => {
    if (!searchQuery.trim()) return allOfficeBills.slice(0, 20);
    const q = searchQuery.toLowerCase().trim();
    return allOfficeBills.filter(b =>
      (b.billNumber && b.billNumber.toLowerCase().includes(q)) ||
      (b.Customer?.name && b.Customer.name.toLowerCase().includes(q)) ||
      (b.billDate && b.billDate.includes(q))
    ).slice(0, 30);
  }, [allOfficeBills, searchQuery]);

  return (
    <div className="w-full h-full flex flex-col bg-[#e6e9ed] border border-[#7f9db9] text-black text-xs select-none overflow-hidden font-sans">
      
      {/* Notifications (if any) */}
      {errorMsg && (
        <div className="shrink-0 bg-red-100 border-b border-red-300 text-red-800 px-3 py-0.5 flex items-center justify-between text-[11px] font-medium">
          <span>⚠ {errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')} className="font-bold text-red-900 ml-2">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="shrink-0 bg-emerald-100 border-b border-emerald-300 text-emerald-900 px-3 py-0.5 flex items-center justify-between text-[11px] font-medium">
          <span>✓ {successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg('')} className="font-bold text-emerald-900 ml-2">✕</button>
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
                value={formatToDisplayDate(billDate)}
                disabled={isSaving}
                onChange={(e) => {
                  markDirtyAndEdit();
                  setBillDate(parseDisplayDateToIso(e.target.value));
                }}
                placeholder="DD-MM-YYYY"
                className="w-24 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] text-black font-semibold focus:outline-none focus:bg-white"
              />
              <span className="font-bold text-[11px] text-black">
                {getDayOfWeekName(billDate) || 'Friday'}
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-[11px] text-black w-22">Serial Number</span>
              <input
                type="text"
                readOnly
                value={billNumber || ''}
                placeholder="Serial No."
                className="w-24 h-5 bg-[#e4ebf5] border border-[#7f9db9] px-1 text-[11px] text-black font-bold cursor-not-allowed select-none"
                title="Serial Number is generated automatically and cannot be edited"
              />
            </div>
          </div>

          {/* Top Center: "Sale Voucher" and Mode in RED */}
          <div className="col-span-12 md:col-span-4 text-center">
            <h1 className="font-serif text-[22px] leading-tight text-black font-normal tracking-wide">
              Sale Voucher
            </h1>
            <div className="text-red-600 font-bold text-[12px] leading-tight">
              {mode === 'VIEW' ? 'View' : mode === 'ADD' ? 'Add' : mode === 'EDIT' ? 'Edit' : 'Saving'}
            </div>
          </div>

          {/* Top Right: Setup, Option, Today Date & Day + Office Selector */}
          <div className="col-span-12 md:col-span-4 flex flex-col items-end text-right space-y-0.5 text-[11px]">
            <div className="flex items-center space-x-2 text-black font-medium">
              {(user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') && organizations.length > 1 && (
                <span className="text-[10px] font-normal bg-white/80 px-1.5 py-0.5 rounded border border-slate-300">
                  Office:
                  <select
                    value={selectedOrgId}
                    disabled={isDirty}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="ml-1 bg-transparent text-[10px] font-bold outline-none cursor-pointer"
                  >
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </span>
              )}
              <span className="cursor-pointer hover:underline">Setup</span>
              <span className="cursor-pointer hover:underline">Option</span>
            </div>
            <div className="text-black font-medium leading-tight">
              Today {todayDateStr}
            </div>
            <div className="text-black font-medium leading-tight">
              {todayDayStr}
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            THREE-COLUMN MASTER HEADER GRID
           ───────────────────────────────────────────────────────────── */}
        <div className="shrink-0 grid grid-cols-1 md:grid-cols-12 gap-2 pt-0.5">
          
          {/* Column 1: Cust.Name, City, Tin */}
          <div className="md:col-span-5 space-y-0.5">
            <div className="flex items-center">
              <label className="w-18 font-bold text-[11px] text-black">Cust.Name</label>
              <div className="flex-1 relative">
                <select
                  value={selectedCustomerId}
                  disabled={isSaving}
                  onChange={(e) => {
                    markDirtyAndEdit();
                    setSelectedCustomerId(e.target.value);
                  }}
                  className="w-full h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] text-black font-bold uppercase focus:outline-none focus:bg-white cursor-pointer"
                >
                  <option value="">-- SELECT CUSTOMER --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center">
              <label className="w-18 font-bold text-[11px] text-black">City</label>
              <input
                type="text"
                readOnly
                value={selectedCustomer?.city || ''}
                className="flex-1 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] text-black"
              />
            </div>

            <div className="flex items-center">
              <label className="w-18 font-bold text-[11px] text-black">Tin</label>
              <input
                type="text"
                readOnly
                value={selectedCustomer?.tin || ''}
                className="flex-1 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] text-black"
              />
            </div>
          </div>

          {/* Column 2: B.Rate, Terms (commented), Vehicle (commented) */}
          <div className="md:col-span-3 space-y-0.5">
            <div className="flex items-center">
              <label className="w-14 font-bold text-[11px] text-black">B.Rate</label>
              <input
                type="number"
                step="any"
                value={headerBRate}
                disabled={isSaving}
                onChange={(e) => handleHeaderBRateChange(e.target.value)}
                placeholder="0.00"
                className="w-32 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] text-black font-bold focus:outline-none focus:bg-white"
              />
            </div>

            {/* Terms (Commented out per request)
            <div className="flex items-center">
              <label className="w-14 font-bold text-[11px] text-black">Terms</label>
              <input
                type="text"
                value={terms}
                disabled={isSaving}
                onChange={(e) => {
                  markDirtyAndEdit();
                  setTerms(e.target.value);
                }}
                className="flex-1 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] text-black focus:outline-none focus:bg-white"
              />
            </div>
            */}

            {/* Vehicle (Commented out per request)
            <div className="flex items-center">
              <label className="w-14 font-bold text-[11px] text-black">Vehicle</label>
              <input
                type="text"
                value={vehicle}
                disabled={isSaving}
                onChange={(e) => {
                  markDirtyAndEdit();
                  setVehicle(e.target.value);
                }}
                className="flex-1 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] text-black focus:outline-none focus:bg-white"
              />
            </div>
            */}
          </div>

          {/* Column 3: Tax Type, Bill Cash, Mfg.Trd (Fixed to Vat Sale, Bill, Trading Sale) */}
          <div className="md:col-span-4 space-y-0.5">
            <div className="flex items-center">
              <label className="w-16 font-bold text-[11px] text-black">Tax Type</label>
              <input
                type="text"
                readOnly
                value={taxType || "Vat Sale"}
                className="flex-1 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] text-black font-semibold cursor-default select-none"
                title="Tax Type is fixed to Vat Sale"
              />
            </div>

            <div className="flex items-center">
              <label className="w-16 font-bold text-[11px] text-black">Bill Cash</label>
              <input
                type="text"
                readOnly
                value={billCash || "Bill"}
                className="flex-1 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] text-black font-semibold cursor-default select-none"
                title="Bill Cash is fixed to Bill"
              />
            </div>

            <div className="flex items-center">
              <label className="w-16 font-bold text-[11px] text-black">Mfg.Trd</label>
              <input
                type="text"
                readOnly
                value={mfgTrd || "Trading Sale"}
                className="flex-1 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] text-black font-semibold cursor-default select-none"
                title="Mfg.Trd is fixed to Trading Sale"
              />
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            LEDGER PRODUCT TABLE (FLEXIBLE HEIGHT, INNER SCROLL ONLY)
           ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-[140px] border border-[#7f9db9] bg-white flex flex-col overflow-hidden relative" ref={autocompleteContainerRef}>
          
          {/* Table Header Row (Locked) */}
          <div className="bg-[#e4ebf5] border-b border-[#7f9db9] text-black font-bold select-none text-[11px] shrink-0">
            <table className="w-full border-collapse">
              <thead>
                <tr className="h-5">
                  <th className="w-6 border-r border-[#7f9db9] py-0.5 text-center font-mono">▸</th>
                  <th className="border-r border-[#7f9db9] px-2 py-0.5 text-left min-w-[150px]">Product Name</th>
                  <th className="border-r border-[#7f9db9] px-2 py-0.5 text-left min-w-[150px]">Description</th>
                  <th className="border-r border-[#7f9db9] px-2 py-0.5 text-right w-24">Difference</th>
                  <th className="border-r border-[#7f9db9] px-2 py-0.5 text-right w-16">Pcs</th>
                  <th className="border-r border-[#7f9db9] px-2 py-0.5 text-right w-20">Quantity</th>
                  <th className="border-r border-[#7f9db9] px-2 py-0.5 text-right w-24">B.Rate</th>
                  <th className="border-r border-[#7f9db9] px-2 py-0.5 text-right w-24">Rate</th>
                  <th className="px-2 py-0.5 text-right w-28">Amount</th>
                </tr>
              </thead>
            </table>
          </div>

          {/* Table Body (Scrolls internally if rows exceed height) */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full border-collapse text-xs">
              <tbody>
                {transactionItems.map((item, idx) => {
                  const isActive = idx === activeRowIdx;
                  const filtered = getFilteredProducts(item.productName);
                  const hasProduct = Boolean(item.productId || (item.productName && item.productName.trim()));

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
                      <td className="border-r border-[#7f9db9] p-0 relative min-w-[150px]">
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
                                    <span className="font-mono text-[11px] text-slate-600">
                                      Diff: {p.difference !== undefined ? p.difference : '0.00'}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Description */}
                      <td className="border-r border-[#7f9db9] p-0 min-w-[150px]">
                        <input
                          type="text"
                          value={item.description}
                          disabled={isSaving}
                          onChange={(e) => handleItemDescriptionChange(idx, e.target.value)}
                          onFocus={() => setActiveRowIdx(idx)}
                          className="w-full h-5 px-1 text-xs text-black bg-transparent border-0 outline-none"
                        />
                      </td>

                      {/* Difference */}
                      <td className="border-r border-[#7f9db9] p-0 text-right w-24">
                        <input
                          type="number"
                          step="any"
                          value={hasProduct || (item.difference && item.difference !== '0.00') ? item.difference : ''}
                          disabled={isSaving}
                          onChange={(e) => handleItemDifferenceChange(idx, e.target.value)}
                          onFocus={() => setActiveRowIdx(idx)}
                          className="w-full h-5 px-1 text-right text-xs font-mono text-black bg-transparent border-0 outline-none"
                        />
                      </td>

                      {/* Pcs */}
                      <td className="border-r border-[#7f9db9] p-0 text-right w-16">
                        <input
                          type="number"
                          value={hasProduct || (item.pcs && item.pcs !== '0') ? item.pcs : ''}
                          disabled={isSaving}
                          onChange={(e) => handleItemPcsChange(idx, e.target.value)}
                          onFocus={() => setActiveRowIdx(idx)}
                          className="w-full h-5 px-1 text-right text-xs font-mono text-black bg-transparent border-0 outline-none"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="border-r border-[#7f9db9] p-0 text-right w-20">
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

                      {/* B.Rate */}
                      <td className="border-r border-[#7f9db9] p-0 text-right w-24">
                        <input
                          type="number"
                          step="any"
                          value={item.basicRate}
                          disabled={isSaving}
                          onChange={(e) => handleItemBasicRateChange(idx, e.target.value)}
                          onFocus={() => setActiveRowIdx(idx)}
                          className="w-full h-5 px-1 text-right text-xs font-mono text-black bg-transparent border-0 outline-none"
                        />
                      </td>

                      {/* Rate (Calculated / Editable: B.Rate + Diff) */}
                      <td className="border-r border-[#7f9db9] p-0 text-right w-24">
                        <input
                          type="number"
                          step="any"
                          value={hasProduct || (item.finalRate && item.finalRate !== '0.00') ? item.finalRate : ''}
                          disabled={isSaving}
                          onChange={(e) => handleItemRateChange(idx, e.target.value)}
                          onFocus={() => setActiveRowIdx(idx)}
                          className="w-full h-5 px-1 text-right text-xs font-mono font-medium text-black bg-transparent border-0 outline-none focus:bg-white"
                        />
                      </td>

                      {/* Amount (Calculated / Editable: Rate * Qty) */}
                      <td className="p-0 text-right w-28">
                        <input
                          type="number"
                          step="any"
                          value={hasProduct || (item.amount && item.amount !== '0.00') ? item.amount : ''}
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
            <input
              type="text"
              readOnly
              value={calculations.totalPcs}
              className="w-16 h-5 bg-white border border-[#7f9db9] px-1 text-right font-mono font-bold text-black text-[11px]"
              title="Total Pieces"
            />
          </div>
          <div className="flex items-center space-x-1">
            <input
              type="text"
              readOnly
              value={calculations.totalQty}
              className="w-20 h-5 bg-white border border-[#7f9db9] px-1 text-right font-mono font-bold text-black text-[11px]"
              title="Total Quantity"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[11px] text-black">Value</span>
            <input
              type="text"
              readOnly
              value={calculations.value}
              className="w-28 h-5 bg-white border border-[#7f9db9] px-2 text-right font-mono font-bold text-black text-[11px]"
              title="Total Value"
            />
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            LOWER SECTION: Left (Remark/Transport/Broker), Center (Due/VAT/Shortage), Right (Taxes/Grand Total)
           ───────────────────────────────────────────────────────────── */}
        <div className="shrink-0 grid grid-cols-1 md:grid-cols-12 gap-2 pt-0.5">
          
          {/* Lower Left: Remark (expanded width), Transport, Broker */}
          <div className="md:col-span-7 space-y-1">
            <div className="flex items-start w-full">
              <label className="w-16 font-bold text-[11px] text-black pt-0.5">Remark:</label>
              <textarea
                ref={remarkTextareaRef}
                rows={3}
                value={billRemark}
                disabled={isSaving}
                onChange={(e) => {
                  markDirtyAndEdit();
                  setBillRemark(e.target.value);
                }}
                className="flex-1 h-20 bg-[#cce4f7] border border-[#7f9db9] px-1.5 py-1 text-xs text-black focus:outline-none focus:bg-white resize-none"
              />
            </div>

            {/* Transport (Commented out per request)
            <div className="flex items-center">
              <label className="w-16 font-bold text-[11px] text-black">Transport</label>
              <input
                type="text"
                value={transportName}
                disabled={isSaving}
                onChange={(e) => {
                  markDirtyAndEdit();
                  setTransportName(e.target.value);
                }}
                className="flex-1 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] text-black focus:outline-none focus:bg-white"
              />
            </div>
            */}

            {/* Broker (Commented out per request)
            <div className="flex items-center">
              <label className="w-16 font-bold text-[11px] text-black">Broker</label>
              <input
                type="text"
                value={brokerName}
                disabled={isSaving}
                onChange={(e) => {
                  markDirtyAndEdit();
                  setBrokerName(e.target.value);
                }}
                className="flex-1 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] text-black focus:outline-none focus:bg-white"
              />
            </div>
            */}
          </div>

          {/* Lower Center: Due Date, Total VAT (red), Shortage */}
          <div className="md:col-span-2 space-y-1">
            {/* Due Date (Commented out per request)
            <div className="flex items-center">
              <label className="w-18 font-bold text-[11px] text-black">Due Date</label>
              <input
                type="text"
                value={formatToDisplayDate(billDueDate)}
                disabled={isSaving}
                onChange={(e) => {
                  markDirtyAndEdit();
                  setBillDueDate(parseDisplayDateToIso(e.target.value));
                }}
                placeholder="DD-MM-YYYY"
                className="w-24 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] text-black font-semibold focus:outline-none focus:bg-white"
              />
            </div>
            */}

            <div className="flex items-center">
              <label className="w-16 font-bold text-[11px] text-red-700">Total VAT</label>
              <input
                type="text"
                readOnly
                value={calculations.totalVat}
                className="w-20 h-5 bg-white border border-[#7f9db9] px-1 text-[11px] font-mono font-bold text-right text-black"
              />
            </div>

            {/* Shortage (Commented out per request)
            <div className="flex items-center">
              <label className="w-18 font-bold text-[11px] text-black">Shortage</label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  step="any"
                  value={shortageQty}
                  disabled={isSaving}
                  onChange={(e) => {
                    markDirtyAndEdit();
                    setShortageQty(e.target.value);
                  }}
                  placeholder="Qty"
                  className="w-14 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] font-mono text-right text-black focus:outline-none focus:bg-white"
                />
                <input
                  type="number"
                  step="any"
                  value={shortageAmt}
                  disabled={isSaving}
                  onChange={(e) => {
                    markDirtyAndEdit();
                    setShortageAmt(e.target.value);
                  }}
                  placeholder="0.00"
                  className="w-18 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-[11px] font-mono text-right text-black focus:outline-none focus:bg-white"
                />
              </div>
            </div>
            */}
          </div>

          {/* Lower Right: Value, Exp Before Tax, Vat/Cst, Sur @, Exp After Tax, Grand Total */}
          <div className="md:col-span-3 space-y-0.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-[11px] text-black">Value</label>
              <input
                type="text"
                readOnly
                value={calculations.value}
                className="w-28 h-5 bg-white border border-[#7f9db9] px-1 text-right font-mono font-bold text-black text-[11px]"
              />
            </div>

            {/* Exp Before Tax (Commented out per request)
            <div className="flex items-center justify-between">
              <label className="font-bold text-[11px] text-black">Exp Before Tax</label>
              <input
                type="number"
                step="any"
                value={expBeforeTax}
                disabled={isSaving}
                onChange={(e) => {
                  markDirtyAndEdit();
                  setExpBeforeTax(e.target.value);
                }}
                placeholder="0.00"
                className="w-28 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-right font-mono text-black focus:outline-none focus:bg-white text-[11px]"
              />
            </div>
            */}

            <div className="flex items-center justify-between">
              <label className="font-bold text-[11px] text-black">Vat/Cst</label>
              <input
                type="number"
                step="any"
                value={billTaxRate}
                disabled={isSaving}
                onChange={(e) => {
                  markDirtyAndEdit();
                  setBillTaxRate(e.target.value);
                }}
                className="w-28 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-right font-mono text-black font-semibold focus:outline-none focus:bg-white text-[11px]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="font-bold text-[11px] text-black">Sur @</label>
              <input
                type="number"
                step="any"
                value={surchargeRate}
                disabled={isSaving}
                onChange={(e) => {
                  markDirtyAndEdit();
                  setSurchargeRate(e.target.value);
                }}
                placeholder="0.00"
                className="w-28 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-right font-mono text-black focus:outline-none focus:bg-white text-[11px]"
              />
            </div>

            {/* Exp After Tax (Commented out per request)
            <div className="flex items-center justify-between">
              <label className="font-bold text-[11px] text-black">Exp After Tax</label>
              <input
                type="number"
                step="any"
                value={expAfterTax}
                disabled={isSaving}
                onChange={(e) => {
                  markDirtyAndEdit();
                  setExpAfterTax(e.target.value);
                }}
                placeholder="0.00"
                className="w-28 h-5 bg-[#cce4f7] border border-[#7f9db9] px-1 text-right font-mono text-black focus:outline-none focus:bg-white text-[11px]"
              />
            </div>
            */}

            <div className="flex items-center justify-between pt-0.5">
              <label className="font-black text-[12px] text-black uppercase">Grand Total</label>
              <input
                type="text"
                readOnly
                value={calculations.grandTotal}
                className="w-32 h-5.5 bg-[#cce4f7] border border-[#7f9db9] px-1.5 text-right font-mono font-black text-[13px] text-black"
              />
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            BOTTOM ACTION BUTTON BAR: Add, Previous, Next, Print & Save
           ───────────────────────────────────────────────────────────── */}
        <div className="shrink-0 pt-1 border-t border-[#7f9db9]">
          <div className="flex items-center justify-between gap-1">
            
            {/* Left: Add, < Previous, Next > */}
            <div className="flex items-center gap-1.5">
              {/* 1. Add */}
              <button
                type="button"
                onClick={handleAdd}
                disabled={actionLoading}
                className="px-3 py-1 bg-[#ece9d8] hover:bg-[#f5f4ef] text-black font-semibold text-xs border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-[#707070] border-b-[#707070] active:border-t-[#707070] active:border-l-[#707070] active:border-r-white active:border-b-white disabled:opacity-50 select-none cursor-pointer outline-dotted outline-1 outline-[#404040] outline-offset-[-3px]"
              >
                Add
              </button>

              {/* 2. Previous */}
              <button
                type="button"
                onClick={handlePrevious}
                disabled={actionLoading}
                className="px-3 py-1 bg-[#ece9d8] hover:bg-[#f5f4ef] text-black font-semibold text-xs border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-[#707070] border-b-[#707070] active:border-t-[#707070] active:border-l-[#707070] active:border-r-white active:border-b-white disabled:opacity-50 select-none cursor-pointer"
              >
                &lt; Previous
              </button>

              {/* 3. Next */}
              <button
                type="button"
                onClick={handleNext}
                disabled={actionLoading}
                className="px-3 py-1 bg-[#ece9d8] hover:bg-[#f5f4ef] text-black font-semibold text-xs border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-[#707070] border-b-[#707070] active:border-t-[#707070] active:border-l-[#707070] active:border-r-white active:border-b-white disabled:opacity-50 select-none cursor-pointer"
              >
                Next &gt;
              </button>

              {/* 4. Save (Save only without printing) */}
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
                {actionLoading ? 'Saving...' : 'Print & Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          SEARCH MODAL
         ───────────────────────────────────────────────────────────────── */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#e6e9ed] border-2 border-[#7f9db9] shadow-2xl w-full max-w-xl text-black">
            
            {/* Modal Title Bar */}
            <div className="bg-gradient-to-r from-[#b3d1f5] to-[#d4e4f7] px-3 py-1 flex items-center justify-between border-b border-[#7f9db9]">
              <span className="font-bold text-xs">Search Sale Voucher</span>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="w-4 h-4 bg-white/80 hover:bg-red-500 hover:text-white border border-[#7f9db9] text-[10px] font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-3 space-y-2">
              <div>
                <label className="block text-[11px] font-bold mb-1">Search by Bill Number, Customer Name, or Date:</label>
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type to filter..."
                  className="w-full bg-[#cce4f7] border border-[#7f9db9] px-2 py-1 text-xs text-black font-semibold focus:outline-none focus:bg-white"
                />
              </div>

              <div className="border border-[#7f9db9] bg-white max-h-60 overflow-y-auto">
                {searchLoading ? (
                  <div className="p-4 text-center text-slate-500">Loading vouchers...</div>
                ) : filteredSearchBills.length === 0 ? (
                  <div className="p-4 text-center text-slate-500">No matching vouchers found</div>
                ) : (
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#e4ebf5] border-b border-[#7f9db9] text-left font-bold text-[11px]">
                        <th className="p-1.5 border-r border-[#7f9db9]">Bill #</th>
                        <th className="p-1.5 border-r border-[#7f9db9]">Date</th>
                        <th className="p-1.5 border-r border-[#7f9db9]">Customer</th>
                        <th className="p-1.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSearchBills.map(b => (
                        <tr
                          key={b.id}
                          onClick={() => handleSelectSearchResult(b.id)}
                          className="hover:bg-[#cce4f7] cursor-pointer border-b border-slate-200"
                        >
                          <td className="p-1.5 font-bold border-r border-slate-200">{b.billNumber}</td>
                          <td className="p-1.5 border-r border-slate-200">{formatToDisplayDate(b.billDate)}</td>
                          <td className="p-1.5 border-r border-slate-200">{b.Customer?.name || '—'}</td>
                          <td className="p-1.5 text-right font-mono font-bold">₹{parseFloat(b.finalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSearchModalOpen(false)}
                  className="px-4 py-1 bg-[#ece9d8] hover:bg-[#f5f4ef] text-black font-semibold text-xs border-t-2 border-l-2 border-white border-r-2 border-b-2 border-r-[#707070] border-b-[#707070]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
