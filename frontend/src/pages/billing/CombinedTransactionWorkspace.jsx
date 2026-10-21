import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Receipt,
  FileText,
  Plus,
  Trash2,
  Save,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Printer,
  Building2,
  Lock,
  Unlock,
  ShieldAlert,
  AlertCircle,
  CheckCircle,
  Loader2,
  Percent,
  Truck,
  ArrowRight
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import {
  getPreviousBill,
  getNextBill,
  getBillById,
  createBill,
  updateBill,
  overrideBill
} from '../../services/billingService';

const STANDARD_UNITS = ['Ton', 'Kg', 'Piece', 'Meter', 'Bundle', 'Length'];

const BLANK_TRANSACTION_ROW = {
  productId: '',
  productName: '',
  description: '',
  difference: 0,
  pcs: '',
  quantity: 1,
  unit: 'Ton', // By default weight is in Tons
  baseRate: 0,
  rate: 0,
  amount: 0
};

export default function CombinedTransactionWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialBillId = searchParams.get('billId');
  const { user } = useContext(AuthContext);

  // Transaction Finite State: 'VIEW' | 'ADD' | 'EDIT' | 'SAVING'
  const [mode, setMode] = useState('VIEW');
  const [isDirty, setIsDirty] = useState(false);
  const [isOverride, setIsOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  // Office / Organization context
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');

  // Effective office ID based on role
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

  // 1. Single Customer Selection State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // 2. Transaction Header (Matching legacy desktop screen)
  const [header, setHeader] = useState({
    billNumber: '',
    billDate: new Date().toISOString().split('T')[0],
    baseRate: 0,
    terms: 'Bill',
    vehicle: '',
    taxType: 'GST 18%',
    billCash: 'Bill',
    mfgTrd: 'Trading Sale'
  });

  // 3. Unified Single Items Grid
  const [transactionItems, setTransactionItems] = useState([{ ...BLANK_TRANSACTION_ROW }]);

  // 4. Estimate Details
  const [estimateId, setEstimateId] = useState(null);
  const [estimateNumber, setEstimateNumber] = useState('');
  const [estimateOthers, setEstimateOthers] = useState(0);

  // 5. Billing & Tax Details
  const [billExpBeforeTax, setBillExpBeforeTax] = useState(0);
  const [billTaxRate, setBillTaxRate] = useState(18); // Default 18% GST
  const [billTransportCost, setBillTransportCost] = useState(0);
  const [billShortage, setBillShortage] = useState(0);
  const [billRemark, setBillRemark] = useState('');
  const [billDueDate, setBillDueDate] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ==========================================
  // 1. Load Offices for Super Admin / CEO
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
  // 2. Load Customers & Products for Office
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

  // ==========================================
  // 3. Keep selectedCustomer in sync
  // ==========================================
  useEffect(() => {
    if (!selectedCustomerId) {
      setSelectedCustomer(null);
      return;
    }
    const match = customers.find(c => String(c.id) === String(selectedCustomerId));
    setSelectedCustomer(match || null);
  }, [selectedCustomerId, customers]);

  // ==========================================
  // 4. Initial Load: Load requested bill or latest
  // ==========================================
  useEffect(() => {
    if (!effectiveOrgId) return;

    const loadInitialTransaction = async () => {
      setLoading(true);
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
          setMode('VIEW');
        } else {
          resetToAddMode();
        }
      } catch (err) {
        console.error('Initial transaction load error:', err);
        resetToAddMode();
      } finally {
        setLoading(false);
      }
    };

    loadInitialTransaction();
  }, [effectiveOrgId, initialBillId]);

  // Helper to populate state from a fetched Bill record
  const populateBillIntoState = (bill) => {
    setCurrentBill(bill);
    setIsDirty(false);
    setIsOverride(false);

    // Customer
    setSelectedCustomerId(bill.customerId ? String(bill.customerId) : '');

    // Header
    const bRateVal = parseFloat(bill.Estimate?.basic) || 0;
    setHeader({
      billNumber: bill.billNumber || '',
      billDate: bill.billDate || new Date().toISOString().split('T')[0],
      baseRate: bRateVal,
      terms: 'Bill',
      vehicle: '',
      taxType: `GST ${bill.gstPercentage || 18}%`,
      billCash: 'Bill',
      mfgTrd: 'Trading Sale'
    });

    // Estimate Info
    if (bill.Estimate) {
      setEstimateId(bill.Estimate.id);
      setEstimateNumber(bill.Estimate.estimateNumber || '');
      setEstimateOthers(parseFloat(bill.Estimate.others) || 0);
    } else {
      setEstimateId(bill.estimateId || null);
      setEstimateNumber('');
      setEstimateOthers(0);
    }

    // Line items
    if (bill.items && bill.items.length > 0) {
      setTransactionItems(bill.items.map(item => {
        const rateVal = parseFloat(item.rate) || 0;
        const qVal = parseFloat(item.quantity) || 1;
        return {
          productId: item.productId ? String(item.productId) : '',
          productName: item.productNameSnapshot || '',
          description: item.productSpecificationsSnapshot || '',
          difference: (rateVal - bRateVal).toFixed(2),
          pcs: item.btls || '',
          quantity: qVal,
          unit: item.unit || 'Ton',
          baseRate: bRateVal,
          rate: rateVal,
          amount: parseFloat(item.amount) || (rateVal * qVal)
        };
      }));
    } else {
      setTransactionItems([{ ...BLANK_TRANSACTION_ROW }]);
    }

    // Billing Financials
    setBillTaxRate(parseFloat(bill.gstPercentage) || 18);
    setBillTransportCost(parseFloat(bill.transportCost) || 0);
    setBillExpBeforeTax(0);
    setBillShortage(0);
    setBillRemark(bill.notes || '');
    setBillDueDate(bill.billDate || '');
  };

  // Helper to reset form for fresh ADD mode
  const resetToAddMode = () => {
    setCurrentBill(null);
    setSelectedCustomerId('');
    setSelectedCustomer(null);
    setIsDirty(false);
    setIsOverride(false);
    setOverrideReason('');
    setErrorMsg('');
    setSuccessMsg('');

    setHeader({
      billNumber: '(Auto-Generated)',
      billDate: new Date().toISOString().split('T')[0],
      baseRate: 0,
      terms: 'Bill',
      vehicle: '',
      taxType: 'GST 18%',
      billCash: 'Bill',
      mfgTrd: 'Trading Sale'
    });

    setTransactionItems([{ ...BLANK_TRANSACTION_ROW }]);
    setEstimateId(null);
    setEstimateNumber('(Auto-Generated)');
    setEstimateOthers(0);

    setBillExpBeforeTax(0);
    setBillTaxRate(18);
    setBillTransportCost(0);
    setBillShortage(0);
    setBillRemark('');
    setBillDueDate('');

    setMode('ADD');
  };

  // ==========================================
  // Calculations: Real-time mathematical engine
  // ==========================================
  const calculations = useMemo(() => {
    let totalPcs = 0;
    let totalQty = 0;
    let valueSubtotal = 0;

    transactionItems.forEach(item => {
      const q = parseFloat(item.quantity) || 0;
      const r = parseFloat(item.rate) || 0;
      const p = parseFloat(item.pcs) || 0;
      totalPcs += p;
      totalQty += q;
      valueSubtotal += q * r;
    });

    // 1. Estimate Calculations (Pre-Tax)
    const estOthers = parseFloat(estimateOthers) || 0;
    const estimateTotal = valueSubtotal + estOthers;

    // 2. Billing Calculations (With GST, Transport, Shortage)
    const expBeforeTax = parseFloat(billExpBeforeTax) || 0;
    const taxableSubtotal = valueSubtotal + expBeforeTax;

    const taxRate = parseFloat(billTaxRate) || 0;
    const gstAmount = (taxableSubtotal * taxRate) / 100;

    const transportCost = parseFloat(billTransportCost) || 0;
    const shortage = parseFloat(billShortage) || 0;

    const finalBillAmount = taxableSubtotal + gstAmount + transportCost - shortage;

    return {
      totalPcs,
      totalQty: totalQty.toFixed(3),
      valueSubtotal: valueSubtotal.toFixed(2),
      estOthers: estOthers.toFixed(2),
      estimateTotal: estimateTotal.toFixed(2),
      expBeforeTax: expBeforeTax.toFixed(2),
      taxRate,
      gstAmount: gstAmount.toFixed(2),
      transportCost: transportCost.toFixed(2),
      shortage: shortage.toFixed(2),
      finalBillAmount: finalBillAmount.toFixed(2)
    };
  }, [transactionItems, estimateOthers, billExpBeforeTax, billTaxRate, billTransportCost, billShortage]);

  // ==========================================
  // Grid Handlers: Unified Line Item Modification
  // ==========================================
  const handleItemProductChange = (index, productId) => {
    if (mode === 'VIEW') return;
    setIsDirty(true);
    setTransactionItems(prev => {
      const updated = [...prev];
      const prod = products.find(p => String(p.id) === String(productId));
      const bRate = parseFloat(header.baseRate) || 0;

      let itemRate = bRate;
      let diff = 0;
      let unit = 'Ton';
      let name = '';
      let desc = '';

      if (prod) {
        name = prod.name;
        desc = prod.specifications || prod.description || '';
        unit = prod.unit || 'Ton';
        const pPrice = parseFloat(prod.price) || 0;
        if (pPrice > 0) {
          itemRate = pPrice;
          diff = (pPrice - bRate).toFixed(2);
        }
      }

      const q = parseFloat(updated[index].quantity) || 1;
      updated[index] = {
        ...updated[index],
        productId: productId || '',
        productName: name || updated[index].productName,
        description: desc || updated[index].description,
        unit,
        baseRate: bRate,
        difference: diff,
        rate: itemRate,
        amount: (q * itemRate).toFixed(2)
      };
      return updated;
    });
  };

  const handleItemQuantityChange = (index, qtyVal) => {
    if (mode === 'VIEW') return;
    setIsDirty(true);
    setTransactionItems(prev => {
      const updated = [...prev];
      const q = parseFloat(qtyVal) || 0;
      const r = parseFloat(updated[index].rate) || 0;
      updated[index] = {
        ...updated[index],
        quantity: qtyVal,
        amount: (q * r).toFixed(2)
      };
      return updated;
    });
  };

  const handleItemDifferenceChange = (index, diffVal) => {
    if (mode === 'VIEW') return;
    setIsDirty(true);
    setTransactionItems(prev => {
      const updated = [...prev];
      const bRate = parseFloat(updated[index].baseRate || header.baseRate) || 0;
      const diff = parseFloat(diffVal) || 0;
      const newRate = (bRate + diff).toFixed(2);
      const q = parseFloat(updated[index].quantity) || 0;
      updated[index] = {
        ...updated[index],
        difference: diffVal,
        rate: newRate,
        amount: (q * parseFloat(newRate)).toFixed(2)
      };
      return updated;
    });
  };

  const handleItemRateChange = (index, rateVal) => {
    if (mode === 'VIEW') return;
    setIsDirty(true);
    setTransactionItems(prev => {
      const updated = [...prev];
      const bRate = parseFloat(updated[index].baseRate || header.baseRate) || 0;
      const r = parseFloat(rateVal) || 0;
      const diff = (r - bRate).toFixed(2);
      const q = parseFloat(updated[index].quantity) || 0;
      updated[index] = {
        ...updated[index],
        rate: rateVal,
        difference: diff,
        amount: (q * r).toFixed(2)
      };
      return updated;
    });
  };

  const handleItemFieldChange = (index, field, value) => {
    if (mode === 'VIEW') return;
    setIsDirty(true);
    setTransactionItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
  };

  const addTransactionRow = () => {
    if (mode === 'VIEW') return;
    setIsDirty(true);
    const bRate = parseFloat(header.baseRate) || 0;
    setTransactionItems(prev => [
      ...prev,
      {
        ...BLANK_TRANSACTION_ROW,
        baseRate: bRate,
        rate: bRate
      }
    ]);
  };

  const removeTransactionRow = (index) => {
    if (mode === 'VIEW') return;
    if (transactionItems.length <= 1) return;
    setIsDirty(true);
    setTransactionItems(prev => prev.filter((_, i) => i !== index));
  };

  // Sync Base Rate from header to all rows
  const handleBaseRateChange = (newBaseRate) => {
    if (mode === 'VIEW') return;
    setIsDirty(true);
    const parsedBase = parseFloat(newBaseRate) || 0;
    setHeader(prev => ({ ...prev, baseRate: newBaseRate }));

    setTransactionItems(prev => prev.map(item => {
      const diff = parseFloat(item.difference) || 0;
      const newRate = (parsedBase + diff).toFixed(2);
      const q = parseFloat(item.quantity) || 0;
      return {
        ...item,
        baseRate: parsedBase,
        rate: newRate,
        amount: (q * parseFloat(newRate)).toFixed(2)
      };
    }));
  };

  // Single Customer Selection Handler
  const handleCustomerSelect = (customerId) => {
    if (mode === 'VIEW') return;
    setIsDirty(true);
    setSelectedCustomerId(customerId);
  };

  // =========================================================================
  // 5. THE FOUR FUNCTIONAL BUTTONS: Add, Previous, Edit, Save (+ Print)
  // =========================================================================

  // BUTTON 1: ADD
  const handleAdd = () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Discard and start a fresh sale voucher?');
      if (!confirmDiscard) return;
    }
    resetToAddMode();
    setSuccessMsg('Started new Sale Voucher. Select customer, add products and quantity once, view estimate, and add taxes.');
  };

  // BUTTON 2: PREVIOUS
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

  // NEXT NAVIGATION
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

  // BUTTON 3: EDIT
  const handleEdit = () => {
    if (!currentBill) {
      setErrorMsg('No saved sale voucher is currently loaded to edit.');
      return;
    }

    if (currentBill.status === 'FINALIZED') {
      const canOverride = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(user?.role);
      if (!canOverride) {
        setErrorMsg('This bill is Finalized and locked. Only an Admin or CEO can edit it via authorized override.');
        return;
      }
      setIsOverride(true);
      setMode('EDIT');
      setSuccessMsg('Voucher is Finalized. Entering Authorized Override Edit mode.');
    } else {
      setIsOverride(false);
      setMode('EDIT');
      setSuccessMsg('Edit mode active. You may now modify customer, products, quantities, or taxes.');
    }
  };

  // BUTTON 4: SAVE (Saves both Estimate & Bill atomically)
  const handleSave = async () => {
    // Validations
    if (!selectedCustomerId) {
      setErrorMsg('Please select a Customer before saving.');
      return;
    }

    if (!transactionItems || transactionItems.length === 0) {
      setErrorMsg('Voucher must contain at least one line item.');
      return;
    }

    for (let i = 0; i < transactionItems.length; i++) {
      const item = transactionItems[i];
      if (!item.productName.trim() && !item.productId) {
        setErrorMsg(`Row #${i + 1}: Please select a product or enter description.`);
        return;
      }
      if (parseFloat(item.quantity) <= 0) {
        setErrorMsg(`Row #${i + 1}: Quantity must be greater than zero.`);
        return;
      }
      if (parseFloat(item.rate) < 0) {
        setErrorMsg(`Row #${i + 1}: Rate cannot be negative.`);
        return;
      }
    }

    if (isOverride && !overrideReason.trim()) {
      setErrorMsg('An override audit reason is required to update a finalized bill.');
      return;
    }

    setActionLoading(true);
    setMode('SAVING');
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. Create or Update the underlying Estimate record
      let targetEstimateId = estimateId;
      const estimateItemsPayload = transactionItems.map(item => ({
        productId: item.productId ? parseInt(item.productId, 10) : null,
        productNameSnapshot: item.productName.trim(),
        productCategorySnapshot: null,
        productSizeSnapshot: null,
        productSpecificationsSnapshot: item.description || null,
        quantity: parseFloat(item.quantity) || 1,
        unit: item.unit || 'Ton',
        negotiatedRate: parseFloat(item.rate) || 0
      }));

      const estimatePayload = {
        organizationId: effectiveOrgId,
        customerId: parseInt(selectedCustomerId, 10),
        estimateDate: header.billDate,
        basic: header.baseRate ? String(header.baseRate) : '',
        others: parseFloat(estimateOthers) || 0,
        notes: billRemark || null,
        status: 'GENERATED',
        items: estimateItemsPayload
      };

      if (!targetEstimateId) {
        try {
          const estRes = await api.post('/estimates', estimatePayload);
          if (estRes.data && estRes.data.estimate) {
            targetEstimateId = estRes.data.estimate.id;
            setEstimateId(targetEstimateId);
            setEstimateNumber(estRes.data.estimate.estimateNumber);
          }
        } catch (estErr) {
          console.warn('Note while creating estimate record:', estErr.message);
        }
      } else {
        try {
          await api.put(`/estimates/${targetEstimateId}`, estimatePayload);
        } catch (estErr) {
          console.warn('Note while updating estimate record:', estErr.message);
        }
      }

      // 2. Create or Update the Bill record linked to this Estimate
      const billItemsPayload = transactionItems.map(item => ({
        productId: item.productId ? parseInt(item.productId, 10) : null,
        productNameSnapshot: item.productName.trim(),
        productCategorySnapshot: null,
        productSizeSnapshot: null,
        productSpecificationsSnapshot: item.description || null,
        btls: item.pcs || null,
        quantity: parseFloat(item.quantity) || 1,
        unit: item.unit || 'Ton',
        rate: parseFloat(item.rate) || 0
      }));

      const billPayload = {
        organizationId: effectiveOrgId,
        customerId: parseInt(selectedCustomerId, 10),
        estimateId: targetEstimateId || null,
        billDate: header.billDate,
        items: billItemsPayload,
        gstPercentage: parseFloat(billTaxRate) || 0,
        transportCost: parseFloat(billTransportCost) || 0,
        notes: billRemark || null
      };

      let savedRecord = null;
      if (currentBill?.id) {
        if (isOverride) {
          const res = await overrideBill(currentBill.id, {
            ...billPayload,
            reason: overrideReason.trim()
          });
          savedRecord = res.bill || res;
        } else {
          const res = await updateBill(currentBill.id, billPayload);
          savedRecord = res.bill || res;
        }
        setSuccessMsg(`Sale Voucher #${savedRecord.billNumber || currentBill.billNumber} successfully updated.`);
      } else {
        const res = await createBill(billPayload);
        savedRecord = res.bill || res;
        setSuccessMsg(`Sale Voucher #${savedRecord.billNumber} saved successfully.`);
      }

      // Re-fetch saved bill with all associations
      const freshBill = await getBillById(savedRecord.id);
      populateBillIntoState(freshBill);
      setMode('VIEW');
      setIsDirty(false);
    } catch (err) {
      console.error('Error saving transaction:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to save voucher.';
      setErrorMsg(msg);
      setMode(currentBill?.id ? 'EDIT' : 'ADD');
    } finally {
      setActionLoading(false);
    }
  };

  // PRINT HANDLERS
  const handlePrintBill = () => {
    if (!currentBill?.id) {
      alert('Please save the sale voucher first before printing.');
      return;
    }
    window.open(`/bills/${currentBill.id}/print`, '_blank');
  };

  const handlePrintEstimate = () => {
    if (!estimateId && !currentBill?.estimateId) {
      alert('Please save the transaction first to generate the printable estimate quotation.');
      return;
    }
    const idToPrint = estimateId || currentBill.estimateId;
    window.open(`/estimates/${idToPrint}/print`, '_blank');
  };

  const isReadOnly = mode === 'VIEW' || mode === 'SAVING';

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 text-slate-800 font-sans text-xs">
      
      {/* ─────────────────────────────────────────────────────────────────
          WINDOW TOP BAR: Desktop Accounting Style Top Bar
         ───────────────────────────────────────────────────────────────── */}
      <header className="bg-slate-800 text-white px-3 py-1.5 flex items-center justify-between shadow-sm border-b border-slate-700">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-bold tracking-wide uppercase text-sm text-slate-100">
            <Receipt className="w-4 h-4 text-amber-400" />
            <span>Sale Voucher Module</span>
          </div>

          {/* Mode Pill Badge */}
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase flex items-center gap-1 ${
            mode === 'VIEW'
              ? 'bg-blue-600 text-white'
              : mode === 'ADD'
              ? 'bg-emerald-600 text-white animate-pulse'
              : mode === 'EDIT'
              ? 'bg-amber-600 text-white'
              : 'bg-indigo-600 text-white'
          }`}>
            {mode === 'VIEW' && <Lock className="w-3 h-3" />}
            {mode === 'ADD' && <Plus className="w-3 h-3" />}
            {mode === 'EDIT' && <Edit3 className="w-3 h-3" />}
            {mode === 'SAVING' && <Loader2 className="w-3 h-3 animate-spin" />}
            {mode} MODE
          </span>

          {currentBill?.status === 'FINALIZED' && (
            <span className="px-1.5 py-0.5 bg-red-800 text-white rounded text-[10px] font-bold">
              FINALIZED / LOCKED
            </span>
          )}

          {isOverride && (
            <span className="px-1.5 py-0.5 bg-purple-700 text-white rounded text-[10px] font-bold flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> OVERRIDE ACTIVE
            </span>
          )}
        </div>

        {/* Office Context Selector */}
        <div className="flex items-center space-x-2">
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') && organizations.length > 1 ? (
            <div className="flex items-center space-x-1 bg-slate-900 px-2 py-1 rounded border border-slate-700">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <label className="text-slate-300 text-[10px] uppercase font-bold">Office:</label>
              <select
                value={selectedOrgId}
                disabled={isDirty}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="bg-slate-800 text-white font-semibold text-xs rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 bg-slate-900 px-2.5 py-1 rounded text-slate-300 border border-slate-700">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold text-white">
                {user?.Organization?.name || organizations.find(o => String(o.id) === String(effectiveOrgId))?.name || 'Assigned Office'}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Notifications / Alerts Bar */}
      {errorMsg && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-3 py-1.5 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center space-x-1.5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-700 font-bold hover:text-red-900 text-xs">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 px-3 py-1.5 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center space-x-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-800 font-bold hover:text-emerald-900 text-xs">✕</button>
        </div>
      )}

      {/* Override Reason Prompt if editing finalized bill */}
      {isOverride && mode === 'EDIT' && (
        <div className="bg-purple-50 border border-purple-300 p-2 mx-2 mt-1 rounded text-purple-900 flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-purple-600 shrink-0" />
          <span className="font-semibold text-xs">Override Audit Reason:</span>
          <input
            type="text"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="State authoritative reason for amending finalized bill..."
            className="flex-1 bg-white border border-purple-300 rounded px-2 py-1 text-xs text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          MAIN WORKSPACE BODY
         ───────────────────────────────────────────────────────────────── */}
      <main className="flex-1 p-2 space-y-2 overflow-y-auto">
        
        {/* ==============================================================
            A. UNIFIED TRANSACTION HEADER (Customer Selected Once)
           ============================================================== */}
        <section className="bg-white rounded border border-slate-300 shadow-sm p-2.5">
          {/* Header Title Bar */}
          <div className="flex items-center justify-between pb-1 mb-2 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-slate-800 tracking-wide">Sale Voucher</span>
              <span className="text-[11px] text-slate-400 font-normal">| Unified Customer & Item Entry</span>
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
          </div>

          {/* Form Fields: Row 1 */}
          <div className="grid grid-cols-12 gap-2 bg-slate-50/80 p-2 rounded border border-slate-200 mb-2">
            {/* Date */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Date</label>
              <input
                type="date"
                value={header.billDate}
                disabled={isReadOnly}
                onChange={(e) => {
                  setIsDirty(true);
                  setHeader(prev => ({ ...prev, billDate: e.target.value }));
                }}
                className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800 disabled:bg-slate-100"
              />
            </div>

            {/* Bill No */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">B.No (Bill No)</label>
              <input
                type="text"
                value={header.billNumber || '(Auto-Generated)'}
                readOnly
                className="w-full bg-slate-100 border border-slate-300 rounded px-1.5 py-1 text-xs font-mono font-bold text-slate-800"
              />
            </div>

            {/* Customer Selection (Selected Once) */}
            <div className="col-span-4">
              <label className="block text-[10px] font-bold text-blue-700 uppercase">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCustomerId}
                disabled={isReadOnly}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full bg-white border-2 border-blue-400 rounded px-2 py-1 text-xs font-bold text-slate-900 disabled:bg-slate-100 disabled:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Select Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* City */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">City</label>
              <input
                type="text"
                value={selectedCustomer?.city || ''}
                readOnly
                placeholder="City"
                className="w-full bg-slate-100 border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-700"
              />
            </div>

            {/* TIN / GSTIN */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Tin / GSTIN</label>
              <input
                type="text"
                value={selectedCustomer?.tin || ''}
                readOnly
                placeholder="TIN / GSTIN"
                className="w-full bg-slate-100 border border-slate-300 rounded px-1.5 py-1 text-xs font-mono text-slate-700"
              />
            </div>
          </div>

          {/* Form Fields: Row 2 (Legacy Desktop Fields) */}
          <div className="grid grid-cols-12 gap-2 bg-slate-50/50 p-2 rounded border border-slate-200">
            {/* Base Rate */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">B.Rate (Base Rate)</label>
              <input
                type="number"
                step="any"
                value={header.baseRate}
                disabled={isReadOnly}
                onChange={(e) => handleBaseRateChange(e.target.value)}
                placeholder="51921.00"
                className="w-full font-mono bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800 disabled:bg-slate-100 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Terms */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Terms</label>
              <input
                type="text"
                value={header.terms}
                disabled={isReadOnly}
                onChange={(e) => {
                  setIsDirty(true);
                  setHeader(prev => ({ ...prev, terms: e.target.value }));
                }}
                placeholder="Bill / 30 Days"
                className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800 disabled:bg-slate-100"
              />
            </div>

            {/* Vehicle No */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Vehicle No.</label>
              <input
                type="text"
                value={header.vehicle}
                disabled={isReadOnly}
                onChange={(e) => {
                  setIsDirty(true);
                  setHeader(prev => ({ ...prev, vehicle: e.target.value }));
                }}
                placeholder="e.g. RJ14 GB 1234"
                className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800 disabled:bg-slate-100"
              />
            </div>

            {/* Tax Type */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Tax Type</label>
              <select
                value={header.taxType}
                disabled={isReadOnly}
                onChange={(e) => {
                  setIsDirty(true);
                  const val = e.target.value;
                  let rate = 18;
                  if (val.includes('12%')) rate = 12;
                  else if (val.includes('5%')) rate = 5;
                  else if (val.includes('0%') || val.includes('Exempt')) rate = 0;
                  setHeader(prev => ({ ...prev, taxType: val }));
                  setBillTaxRate(rate);
                }}
                className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800 disabled:bg-slate-100"
              >
                <option value="GST 18%">GST 18% (Standard)</option>
                <option value="GST 12%">GST 12%</option>
                <option value="GST 5%">GST 5%</option>
                <option value="Exempt">Exempt / 0%</option>
              </select>
            </div>

            {/* Bill / Cash */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Bill / Cash</label>
              <select
                value={header.billCash}
                disabled={isReadOnly}
                onChange={(e) => {
                  setIsDirty(true);
                  setHeader(prev => ({ ...prev, billCash: e.target.value }));
                }}
                className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800 disabled:bg-slate-100"
              >
                <option value="Bill">Bill</option>
                <option value="Cash">Cash</option>
              </select>
            </div>

            {/* Mfg / Trading */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Mfg. / Trd.</label>
              <select
                value={header.mfgTrd}
                disabled={isReadOnly}
                onChange={(e) => {
                  setIsDirty(true);
                  setHeader(prev => ({ ...prev, mfgTrd: e.target.value }));
                }}
                className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800 disabled:bg-slate-100"
              >
                <option value="Trading Sale">Trading Sale</option>
                <option value="Mfg. Sale">Mfg. Sale</option>
              </select>
            </div>
          </div>
        </section>

        {/* ==============================================================
            B. UNIFIED TRANSACTION GRID (Product & Quantity entered ONCE)
           ============================================================== */}
        <section className="bg-white rounded border border-slate-300 shadow-sm p-2.5">
          <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-200">
            <span className="font-bold text-xs uppercase text-slate-700 tracking-wide">
              Product Items Grid (Weight defaulted in Tons)
            </span>
            <span className="text-[11px] text-slate-500">
              Rate = Base Rate + Difference | Amount = Quantity × Rate
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-300 rounded">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-1.5 px-1.5 w-8 text-center">#</th>
                  <th className="py-1.5 px-2 w-64">Product Name</th>
                  <th className="py-1.5 px-2">Description / Specs</th>
                  <th className="py-1.5 px-1.5 w-24 text-right">Difference</th>
                  <th className="py-1.5 px-1.5 w-16 text-center">Pcs</th>
                  <th className="py-1.5 px-1.5 w-28 text-right bg-blue-50/50">Quantity (Tons)</th>
                  <th className="py-1.5 px-1.5 w-24 text-right">B.Rate</th>
                  <th className="py-1.5 px-1.5 w-28 text-right bg-amber-50/50">Rate (₹/Ton)</th>
                  <th className="py-1.5 px-2 w-32 text-right">Amount (₹)</th>
                  {!isReadOnly && <th className="py-1.5 px-1 w-10 text-center">Act</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {transactionItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-1 px-1.5 text-center text-slate-500 text-[11px] font-mono">{idx + 1}</td>

                    {/* Product Name (Dropdown selecting once) */}
                    <td className="py-1 px-2">
                      <select
                        value={item.productId}
                        disabled={isReadOnly}
                        onChange={(e) => handleItemProductChange(idx, e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-800 disabled:bg-transparent disabled:border-none"
                      >
                        <option value="">{item.productName || '-- Select Product --'}</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.price ? `(₹${p.price}/${p.unit || 'Ton'})` : ''}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Description */}
                    <td className="py-1 px-2">
                      <input
                        type="text"
                        value={item.description}
                        disabled={isReadOnly}
                        onChange={(e) => handleItemFieldChange(idx, 'description', e.target.value)}
                        placeholder="Specifications / Details"
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-700 disabled:bg-transparent disabled:border-none"
                      />
                    </td>

                    {/* Difference */}
                    <td className="py-1 px-1.5 text-right">
                      <input
                        type="number"
                        step="any"
                        value={item.difference}
                        disabled={isReadOnly}
                        onChange={(e) => handleItemDifferenceChange(idx, e.target.value)}
                        placeholder="0.00"
                        className="w-full text-right font-mono bg-white border border-slate-300 rounded px-1 py-0.5 text-xs text-slate-700 disabled:bg-transparent disabled:border-none"
                      />
                    </td>

                    {/* Pcs */}
                    <td className="py-1 px-1.5 text-center">
                      <input
                        type="text"
                        value={item.pcs}
                        disabled={isReadOnly}
                        onChange={(e) => handleItemFieldChange(idx, 'pcs', e.target.value)}
                        placeholder="0"
                        className="w-full text-center font-mono bg-white border border-slate-300 rounded px-1 py-0.5 text-xs text-slate-700 disabled:bg-transparent disabled:border-none"
                      />
                    </td>

                    {/* Quantity (Selected once, default in Ton) */}
                    <td className="py-1 px-1.5 text-right bg-blue-50/30">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.quantity}
                        disabled={isReadOnly}
                        onChange={(e) => handleItemQuantityChange(idx, e.target.value)}
                        className="w-full text-right font-mono font-bold text-blue-900 bg-white border border-blue-300 rounded px-1 py-0.5 text-xs disabled:bg-transparent disabled:border-none"
                      />
                    </td>

                    {/* B.Rate */}
                    <td className="py-1 px-1.5 text-right text-slate-600 font-mono">
                      ₹{parseFloat(item.baseRate || header.baseRate || 0).toFixed(2)}
                    </td>

                    {/* Rate */}
                    <td className="py-1 px-1.5 text-right bg-amber-50/30">
                      <input
                        type="number"
                        step="any"
                        value={item.rate}
                        disabled={isReadOnly}
                        onChange={(e) => handleItemRateChange(idx, e.target.value)}
                        className="w-full text-right font-mono font-bold text-amber-900 bg-white border border-amber-300 rounded px-1 py-0.5 text-xs disabled:bg-transparent disabled:border-none"
                      />
                    </td>

                    {/* Amount */}
                    <td className="py-1 px-2 text-right font-mono font-bold text-slate-900">
                      ₹{parseFloat(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Delete Action */}
                    {!isReadOnly && (
                      <td className="py-1 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeTransactionRow(idx)}
                          disabled={transactionItems.length <= 1}
                          className="text-slate-400 hover:text-red-600 disabled:opacity-20 p-0.5"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Grid Footer / Summary Totals */}
          <div className="flex items-center justify-between mt-1.5 pt-1.5 bg-slate-50 p-2 rounded border border-slate-200">
            {!isReadOnly ? (
              <button
                type="button"
                onClick={addTransactionRow}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item Row</span>
              </button>
            ) : <div />}

            <div className="flex items-center space-x-6 font-mono text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-sans uppercase">Total Pcs: </span>
                <span className="font-bold text-slate-800">{calculations.totalPcs}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-sans uppercase">Total Qty: </span>
                <span className="font-bold text-blue-800">{calculations.totalQty} Ton</span>
              </div>
              <div className="bg-slate-200/80 px-2.5 py-1 rounded">
                <span className="text-[10px] text-slate-600 font-sans font-bold uppercase">Value / Subtotal: </span>
                <span className="font-bold text-slate-900">₹{parseFloat(calculations.valueSubtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ==============================================================
            C. STEPPED ESTIMATE & BILLING SECTIONS
               1. First: Customer is shown Estimate
               2. Second: If customer is okay, add GST & taxes to show Bill
           ============================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          
          {/* ───────────────────────────────────────────────────────────
              ESTIMATE SUMMARY (Shown immediately from items)
             ─────────────────────────────────────────────────────────── */}
          <section className="bg-sky-50/60 rounded border border-sky-300 shadow-sm p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-1 mb-2 border-b border-sky-200">
                <div className="flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-sky-700" />
                  <h3 className="font-bold text-xs uppercase text-sky-900 tracking-wide">
                    1. Estimate / Quotation Summary (Pre-Tax)
                  </h3>
                </div>
                <span className="px-2 py-0.5 bg-sky-200 text-sky-800 rounded text-[10px] font-bold">
                  Quotation Phase
                </span>
              </div>

              <p className="text-[11px] text-sky-700 mb-2">
                This estimate quotation is calculated immediately from the items above. If customer is satisfied, proceed to add GST & billing details.
              </p>

              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between items-center py-1 border-b border-sky-100">
                  <span className="font-sans text-slate-600">Customer:</span>
                  <span className="font-semibold text-slate-900">{selectedCustomer?.name || 'Not Selected'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-sky-100">
                  <span className="font-sans text-slate-600">Total Quantity:</span>
                  <span className="font-bold text-blue-700">{calculations.totalQty} Ton</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-sky-100">
                  <span className="font-sans text-slate-600">Basic Subtotal:</span>
                  <span className="font-bold text-slate-800">₹{parseFloat(calculations.valueSubtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-sky-100">
                  <span className="font-sans text-slate-600">Others / Adjustment:</span>
                  <div className="flex items-center space-x-1">
                    <span>₹</span>
                    <input
                      type="number"
                      step="any"
                      value={estimateOthers}
                      disabled={isReadOnly}
                      onChange={(e) => {
                        setIsDirty(true);
                        setEstimateOthers(e.target.value);
                      }}
                      className="w-20 text-right font-mono bg-white border border-sky-300 rounded px-1.5 py-0.5 text-xs text-slate-800 disabled:bg-transparent disabled:border-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-sky-200">
              <div className="flex justify-between items-center bg-sky-100 p-2 rounded border border-sky-300">
                <span className="font-sans font-bold text-xs text-sky-900 uppercase">
                  Estimate Grand Total:
                </span>
                <span className="font-mono font-bold text-base text-sky-900">
                  ₹{parseFloat(calculations.estimateTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handlePrintEstimate}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-sky-100 text-sky-800 border border-sky-300 rounded text-xs font-semibold shadow-2xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Estimate Quotation</span>
                </button>
              </div>
            </div>
          </section>

          {/* ───────────────────────────────────────────────────────────
              BILLING & TAX DETAILS (When Customer Approves)
             ─────────────────────────────────────────────────────────── */}
          <section className="bg-emerald-50/60 rounded border border-emerald-300 shadow-sm p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-1 mb-2 border-b border-emerald-200">
                <div className="flex items-center space-x-1.5">
                  <Receipt className="w-4 h-4 text-emerald-700" />
                  <h3 className="font-bold text-xs uppercase text-emerald-900 tracking-wide">
                    2. Final Bill & GST Tax Calculation
                  </h3>
                </div>
                <span className="px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded text-[10px] font-bold">
                  Official Bill
                </span>
              </div>

              {/* Tax & Financial Fields Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                {/* Exp Before Tax */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600">Exp. Before Tax (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={billExpBeforeTax}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      setIsDirty(true);
                      setBillExpBeforeTax(e.target.value);
                    }}
                    placeholder="0.00"
                    className="w-full font-mono bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800 disabled:bg-slate-100"
                  />
                </div>

                {/* GST Rate */}
                <div>
                  <label className="block text-[10px] font-bold text-emerald-800">GST Rate (%)</label>
                  <select
                    value={billTaxRate}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      setIsDirty(true);
                      setBillTaxRate(parseFloat(e.target.value) || 0);
                    }}
                    className="w-full bg-white border-2 border-emerald-400 rounded px-1.5 py-0.5 text-xs font-bold text-emerald-900 disabled:bg-slate-100 disabled:border-slate-300"
                  >
                    <option value="18">18% (Standard GST)</option>
                    <option value="12">12% GST</option>
                    <option value="5">5% GST</option>
                    <option value="0">0% (Exempt)</option>
                  </select>
                </div>

                {/* Transport Cost */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600">Transport Cost (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={billTransportCost}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      setIsDirty(true);
                      setBillTransportCost(e.target.value);
                    }}
                    placeholder="0.00"
                    className="w-full font-mono bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800 disabled:bg-slate-100"
                  />
                </div>

                {/* Shortage / Deductions */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600">Shortage / Discount (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={billShortage}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      setIsDirty(true);
                      setBillShortage(e.target.value);
                    }}
                    placeholder="0.00"
                    className="w-full font-mono bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800 disabled:bg-slate-100"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600">Due Date</label>
                  <input
                    type="date"
                    value={billDueDate}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      setIsDirty(true);
                      setBillDueDate(e.target.value);
                    }}
                    className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800 disabled:bg-slate-100"
                  />
                </div>

                {/* Delivery Remark */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600">Remark / Notes</label>
                  <input
                    type="text"
                    value={billRemark}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      setIsDirty(true);
                      setBillRemark(e.target.value);
                    }}
                    placeholder="e.g. Dispatched via Truck"
                    className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800 disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Real-time Tax Breakdown */}
              <div className="bg-white/80 p-2 rounded border border-emerald-200 space-y-1 font-mono text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-sans">Taxable Subtotal:</span>
                  <span>₹{(parseFloat(calculations.valueSubtotal) + parseFloat(calculations.expBeforeTax)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-800 font-bold">
                  <span className="font-sans">GST Amount ({calculations.taxRate}%):</span>
                  <span>+ ₹{parseFloat(calculations.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {parseFloat(calculations.transportCost) > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-sans">Transport Charges:</span>
                    <span>+ ₹{parseFloat(calculations.transportCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {parseFloat(calculations.shortage) > 0 && (
                  <div className="flex justify-between items-center text-red-600">
                    <span className="font-sans">Shortage / Deduction:</span>
                    <span>- ₹{parseFloat(calculations.shortage).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Final Grand Total Amount */}
            <div className="mt-3 pt-2 border-t border-emerald-200">
              <div className="flex justify-between items-center bg-emerald-700 text-white p-2.5 rounded shadow-sm">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider font-semibold opacity-90">
                    Final Bill Amount (Incl. GST):
                  </span>
                  <span className="text-xs opacity-75 font-sans">Official Sale Voucher Total</span>
                </div>
                <span className="font-mono font-bold text-xl text-white">
                  ₹{parseFloat(calculations.finalBillAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handlePrintBill}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Tax Invoice / Bill</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────────
          BOTTOM ACTION TOOLBAR (As in legacy software screenshot)
          Only 4 Primary Functional Buttons: Add, Previous, Edit, Save (+ Print)
         ───────────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-200 border-t-2 border-slate-300 p-2 flex items-center justify-between shadow-inner">
        <div className="flex items-center space-x-1.5">
          {/* BUTTON 1: ADD */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={actionLoading}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-400 rounded text-xs font-bold shadow-xs active:translate-y-0.5 transition-all flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Add</span>
          </button>

          {/* BUTTON 3: EDIT */}
          <button
            type="button"
            onClick={handleEdit}
            disabled={actionLoading || mode === 'EDIT' || mode === 'SAVING'}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-400 rounded text-xs font-bold shadow-xs active:translate-y-0.5 transition-all flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Edit3 className="w-3.5 h-3.5 text-blue-600" />
            <span>Edit</span>
          </button>

          {/* BUTTON 2: PREVIOUS */}
          <button
            type="button"
            onClick={handlePrevious}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-400 rounded text-xs font-bold shadow-xs active:translate-y-0.5 transition-all flex items-center space-x-1 disabled:opacity-50"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
            <span>&lt; Previous</span>
          </button>

          {/* NEXT */}
          <button
            type="button"
            onClick={handleNext}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-400 rounded text-xs font-bold shadow-xs active:translate-y-0.5 transition-all flex items-center space-x-1 disabled:opacity-50"
          >
            <span>Next &gt;</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          </button>
        </div>

        {/* Action Status Indicator */}
        <div className="hidden sm:flex items-center space-x-2 text-[11px] text-slate-600 font-medium">
          {isDirty && (
            <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-bold animate-pulse">
              ● Unsaved changes
            </span>
          )}
          <span>{currentBill?.billNumber ? `Voucher: ${currentBill.billNumber}` : 'New Transaction'}</span>
        </div>

        {/* Right Buttons: Print & Save */}
        <div className="flex items-center space-x-2">
          {/* PRINT BILL */}
          <button
            type="button"
            onClick={handlePrintBill}
            disabled={!currentBill?.id || actionLoading}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-400 rounded text-xs font-bold shadow-xs flex items-center space-x-1.5 disabled:opacity-40"
            title="Print official Bill"
          >
            <Printer className="w-3.5 h-3.5 text-slate-700" />
            <span>Print Bill</span>
          </button>

          {/* BUTTON 4: SAVE */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isReadOnly || actionLoading}
            className="px-6 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-sm active:translate-y-0.5 transition-all flex items-center space-x-1.5 disabled:opacity-50 disabled:bg-slate-400"
          >
            {actionLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
