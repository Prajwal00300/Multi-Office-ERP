import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Receipt,
  Eye,
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
  ShieldAlert,
  AlertCircle,
  CheckCircle,
  Loader2,
  Percent,
  Truck,
  Calendar,
  MessageSquare
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import {
  getPreviousBill,
  getNextBill,
  getNextBillNumber,
  getBillById,
  createBill,
  updateBill
} from '../../services/billingService';

const BLANK_TRANSACTION_ROW = {
  productId: '',
  productName: '',
  description: '',
  basicRate: '0.00',
  difference: '0.00',
  quantity: '1',
  unit: 'Ton', // Weight is by default in Tons
  finalRate: '0.00',
  amount: '0.00'
};

export default function CombinedTransactionWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialBillId = searchParams.get('billId');
  const { user } = useContext(AuthContext);

  // Finite State Machine: 'VIEW' | 'ADD' | 'EDIT' | 'SAVING'
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
  // 1. Header Fields (Exact required fields: Date, Bill No, Customer, City, TIN)
  // =========================================================================
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [billNumber, setBillNumber] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // =========================================================================
  // 2. Product Items Grid State
  // (Product, Description, Basic Rate, Difference, Quantity, Final Rate, Amount)
  // =========================================================================
  const [transactionItems, setTransactionItems] = useState([{ ...BLANK_TRANSACTION_ROW }]);

  // =========================================================================
  // 3. Estimate Details State
  // =========================================================================
  const [estimateId, setEstimateId] = useState(null);
  const [estimateNumber, setEstimateNumber] = useState('');
  const [estimateOthers, setEstimateOthers] = useState('0.00');

  // =========================================================================
  // 4. Billing Details State
  // (GST Rate dropdown/custom, Transport Cost, Due Date, Remarks/Notes, Final Bill Amount)
  // =========================================================================
  const [gstPreset, setGstPreset] = useState('18'); // '18' | '12' | '5' | '0' | 'custom'
  const [billTaxRate, setBillTaxRate] = useState('18');
  const [billTransportCost, setBillTransportCost] = useState('0.00');
  const [billDueDate, setBillDueDate] = useState('');
  const [billRemark, setBillRemark] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
      } finally {
        setLoading(false);
      }
    };

    loadInitialTransaction();
  }, [effectiveOrgId, initialBillId]);

  // Populate state from saved bill
  const populateBillIntoState = (bill) => {
    setCurrentBill(bill);
    setIsDirty(false);

    setBillDate(bill.billDate || new Date().toISOString().split('T')[0]);
    setBillNumber(bill.billNumber || '');
    setSelectedCustomerId(bill.customerId ? String(bill.customerId) : '');

    if (bill.Estimate) {
      setEstimateId(bill.Estimate.id);
      setEstimateNumber(bill.Estimate.estimateNumber || '');
      setEstimateOthers(String(parseFloat(bill.Estimate.others) || 0));
    } else {
      setEstimateId(bill.estimateId || null);
      setEstimateNumber('');
      setEstimateOthers('0.00');
    }

    if (bill.items && bill.items.length > 0) {
      setTransactionItems(bill.items.map(item => {
        const finalRateVal = parseFloat(item.rate) || 0;
        const qVal = parseFloat(item.quantity) || 1;
        const prod = products.find(p => String(p.id) === String(item.productId));
        const bRateVal = prod && prod.price ? parseFloat(prod.price) : finalRateVal;
        const diffVal = (finalRateVal - bRateVal).toFixed(2);
        return {
          productId: item.productId ? String(item.productId) : '',
          productName: item.productNameSnapshot || '',
          description: item.productSpecificationsSnapshot || '',
          basicRate: String(bRateVal),
          difference: String(diffVal),
          quantity: String(qVal),
          unit: item.unit || 'Ton',
          finalRate: finalRateVal.toFixed(2),
          amount: (finalRateVal * qVal).toFixed(2)
        };
      }));
    } else {
      setTransactionItems([{ ...BLANK_TRANSACTION_ROW }]);
    }

    const gstVal = parseFloat(bill.gstPercentage) || 0;
    setBillTaxRate(String(gstVal));
    if ([18, 12, 5, 0].includes(gstVal)) {
      setGstPreset(String(gstVal));
    } else {
      setGstPreset('custom');
    }

    setBillTransportCost(String(parseFloat(bill.transportCost) || 0));
    setBillDueDate(bill.billDate || '');
    setBillRemark(bill.notes || '');
  };

  // Reset state to fresh ADD mode
  const resetToAddMode = async (targetOrgId) => {
    const orgId = targetOrgId || effectiveOrgId;

    setCurrentBill(null);
    setSelectedCustomerId('');
    setSelectedCustomer(null);
    setBillDate(new Date().toISOString().split('T')[0]);
    setBillNumber('');

    setTransactionItems([{ ...BLANK_TRANSACTION_ROW }]);
    setEstimateId(null);
    setEstimateNumber('');
    setEstimateOthers('0.00');

    setGstPreset('18');
    setBillTaxRate('18');
    setBillTransportCost('0.00');
    setBillDueDate('');
    setBillRemark('');

    setIsDirty(false);
    setErrorMsg('');
    setSuccessMsg('');
    setMode('ADD');

    // Fetch next upcoming bill and estimate number previews scoped to this office
    try {
      const [billRes, estRes] = await Promise.allSettled([
        getNextBillNumber(orgId),
        api.get(`/estimates/next-number${orgId ? `?organizationId=${orgId}` : ''}`)
      ]);
      if (billRes.status === 'fulfilled' && billRes.value?.nextBillNumber) {
        setBillNumber(billRes.value.nextBillNumber);
      }
      if (estRes.status === 'fulfilled' && estRes.value?.data?.nextEstimateNumber) {
        setEstimateNumber(estRes.value.data.nextEstimateNumber);
      }
    } catch (err) {
      console.warn('Could not fetch next number previews:', err);
    }
  };

  // ==========================================
  // Real-Time Calculations Engine
  // ==========================================
  const calculations = useMemo(() => {
    let totalQty = 0;
    let subtotal = 0;

    transactionItems.forEach(item => {
      const q = parseFloat(item.quantity) || 0;
      const bRate = parseFloat(item.basicRate) || 0;
      const diff = parseFloat(item.difference) || 0;
      const fRate = bRate + diff;
      const amt = q * fRate;

      totalQty += q;
      subtotal += amt;
    });

    // 1. Estimate Total (Pre-tax)
    const estOthers = parseFloat(estimateOthers) || 0;
    const estimateTotal = subtotal + estOthers;

    // 2. Billing & Final Amount
    const taxRate = parseFloat(billTaxRate) || 0;
    const gstAmount = (subtotal * taxRate) / 100;
    const transport = parseFloat(billTransportCost) || 0;
    const finalBillAmount = subtotal + gstAmount + transport;

    return {
      totalQty: totalQty.toFixed(3),
      subtotal: subtotal.toFixed(2),
      estimateTotal: estimateTotal.toFixed(2),
      gstAmount: gstAmount.toFixed(2),
      finalBillAmount: finalBillAmount.toFixed(2)
    };
  }, [transactionItems, estimateOthers, billTaxRate, billTransportCost]);

  // ==========================================
  // Grid Handlers: Product, Difference, Quantity
  // ==========================================
  const handleItemProductChange = (index, productId) => {
    if (mode === 'VIEW') return;
    setIsDirty(true);
    setTransactionItems(prev => {
      const updated = [...prev];
      const prod = products.find(p => String(p.id) === String(productId));

      let bRate = 0;
      let name = '';
      let desc = '';

      if (prod) {
        name = prod.name;
        desc = prod.specifications || prod.description || '';
        bRate = parseFloat(prod.price) || 0;
      }

      const diff = parseFloat(updated[index].difference) || 0;
      const fRate = bRate + diff;
      const q = parseFloat(updated[index].quantity) || 1;

      updated[index] = {
        ...updated[index],
        productId: productId || '',
        productName: name || updated[index].productName,
        description: desc || updated[index].description,
        basicRate: String(bRate),
        finalRate: fRate.toFixed(2),
        amount: (fRate * q).toFixed(2)
      };
      return updated;
    });
  };

  const handleItemBasicRateChange = (index, val) => {
    if (mode === 'VIEW') return;
    setIsDirty(true);
    setTransactionItems(prev => {
      const updated = [...prev];
      const bRate = parseFloat(val) || 0;
      const diff = parseFloat(updated[index].difference) || 0;
      const fRate = bRate + diff;
      const q = parseFloat(updated[index].quantity) || 0;

      updated[index] = {
        ...updated[index],
        basicRate: val,
        finalRate: fRate.toFixed(2),
        amount: (fRate * q).toFixed(2)
      };
      return updated;
    });
  };

  const handleItemDifferenceChange = (index, val) => {
    if (mode === 'VIEW') return;
    setIsDirty(true);
    setTransactionItems(prev => {
      const updated = [...prev];
      const bRate = parseFloat(updated[index].basicRate) || 0;
      const diff = parseFloat(val) || 0;
      const fRate = bRate + diff;
      const q = parseFloat(updated[index].quantity) || 0;

      updated[index] = {
        ...updated[index],
        difference: val,
        finalRate: fRate.toFixed(2),
        amount: (fRate * q).toFixed(2)
      };
      return updated;
    });
  };

  const handleItemQuantityChange = (index, val) => {
    if (mode === 'VIEW') return;
    setIsDirty(true);
    setTransactionItems(prev => {
      const updated = [...prev];
      const q = parseFloat(val) || 0;
      const fRate = parseFloat(updated[index].finalRate) || 0;

      updated[index] = {
        ...updated[index],
        quantity: val,
        amount: (fRate * q).toFixed(2)
      };
      return updated;
    });
  };

  const handleItemDescriptionChange = (index, val) => {
    if (mode === 'VIEW') return;
    setIsDirty(true);
    setTransactionItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], description: val };
      return updated;
    });
  };

  const addTransactionRow = () => {
    if (mode === 'VIEW') return;
    setIsDirty(true);
    setTransactionItems(prev => [...prev, { ...BLANK_TRANSACTION_ROW }]);
  };

  const removeTransactionRow = (index) => {
    if (mode === 'VIEW') return;
    if (transactionItems.length <= 1) return;
    setIsDirty(true);
    setTransactionItems(prev => prev.filter((_, i) => i !== index));
  };

  // GST Dropdown / Custom handler
  const handleGstPresetChange = (preset) => {
    if (mode === 'VIEW') return;
    setIsDirty(true);
    setGstPreset(preset);
    if (preset !== 'custom') {
      setBillTaxRate(preset);
    }
  };

  const handleCustomGstChange = (val) => {
    if (mode === 'VIEW') return;
    setIsDirty(true);
    setGstPreset('custom');
    setBillTaxRate(val);
  };

  // =========================================================================
  // THE FOUR FUNCTIONAL BUTTONS: Add, Previous, Edit, Save (+ Print)
  // =========================================================================

  // BUTTON 1: ADD
  const handleAdd = async () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Discard and start a new sale voucher?');
      if (!confirmDiscard) return;
    }
    await resetToAddMode();
    setSuccessMsg('Ready for new entry. Select customer, enter products and quantities.');
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
    setMode('EDIT');
    setSuccessMsg('Edit mode active. You may now modify the voucher details.');
  };

  // BUTTON 4: SAVE
  const handleSave = async () => {
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
      if (parseFloat(item.finalRate) < 0) {
        setErrorMsg(`Row #${i + 1}: Final rate cannot be negative.`);
        return;
      }
    }

    setActionLoading(true);
    setMode('SAVING');
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. Create or Update underlying Estimate record
      let targetEstimateId = estimateId;
      const estimateItemsPayload = transactionItems.map(item => ({
        productId: item.productId ? parseInt(item.productId, 10) : null,
        productNameSnapshot: item.productName.trim(),
        productSpecificationsSnapshot: item.description ? item.description.trim() : null,
        description: item.description ? item.description.trim() : null,
        quantity: parseFloat(item.quantity) || 1,
        unit: item.unit || 'Ton',
        negotiatedRate: parseFloat(item.finalRate) || 0
      }));

      const estimatePayload = {
        organizationId: effectiveOrgId,
        customerId: parseInt(selectedCustomerId, 10),
        estimateDate: billDate,
        basic: transactionItems[0]?.basicRate || '0.00',
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

      // 2. Create or Update Bill record linked to this Estimate
      const billItemsPayload = transactionItems.map(item => ({
        productId: item.productId ? parseInt(item.productId, 10) : null,
        productNameSnapshot: item.productName.trim(),
        productSpecificationsSnapshot: item.description ? item.description.trim() : null,
        description: item.description ? item.description.trim() : null,
        quantity: parseFloat(item.quantity) || 1,
        unit: item.unit || 'Ton',
        rate: parseFloat(item.finalRate) || 0
      }));

      const billPayload = {
        organizationId: effectiveOrgId,
        customerId: parseInt(selectedCustomerId, 10),
        estimateId: targetEstimateId || null,
        billDate: billDate,
        items: billItemsPayload,
        gstPercentage: parseFloat(billTaxRate) || 0,
        transportCost: parseFloat(billTransportCost) || 0,
        notes: billRemark || null
      };

      let savedRecord = null;
      if (currentBill?.id) {
        const res = await updateBill(currentBill.id, billPayload);
        savedRecord = res.bill || res;
        setSuccessMsg(`Sale Voucher #${savedRecord.billNumber || currentBill.billNumber} successfully updated.`);
      } else {
        const res = await createBill(billPayload);
        savedRecord = res.bill || res;
        setSuccessMsg(`Sale Voucher #${savedRecord.billNumber} saved successfully.`);
      }

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
    const idToPrint = estimateId || currentBill?.estimateId;
    if (!idToPrint) {
      alert('Please save the transaction first to generate the printable estimate.');
      return;
    }
    window.open(`/estimates/${idToPrint}/print`, '_blank');
  };

  const isReadOnly = mode === 'VIEW' || mode === 'SAVING';

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 text-slate-800 font-sans text-xs">
      
      {/* ─────────────────────────────────────────────────────────────────
          TOP TITLE BAR
         ───────────────────────────────────────────────────────────────── */}
      <header className="bg-slate-800 text-white px-3 py-1.5 flex items-center justify-between shadow-sm border-b border-slate-700">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-bold tracking-wide uppercase text-sm text-slate-100">
            <Receipt className="w-4 h-4 text-amber-400" />
            <span>Sale Voucher</span>
          </div>

          <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase flex items-center gap-1 ${
            mode === 'VIEW'
              ? 'bg-blue-600 text-white'
              : mode === 'ADD'
              ? 'bg-emerald-600 text-white animate-pulse'
              : mode === 'EDIT'
              ? 'bg-amber-600 text-white'
              : 'bg-indigo-600 text-white'
          }`}>
            {mode === 'VIEW' && <Eye className="w-3 h-3" />}
            {mode === 'ADD' && <Plus className="w-3 h-3" />}
            {mode === 'EDIT' && <Edit3 className="w-3 h-3" />}
            {mode === 'SAVING' && <Loader2 className="w-3 h-3 animate-spin" />}
            {mode} MODE
          </span>
        </div>

        {/* Office Selection */}
        <div className="flex items-center space-x-2">
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') && organizations.length > 1 ? (
            <div className="flex items-center space-x-1 bg-slate-900 px-2 py-1 rounded border border-slate-700">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <label className="text-slate-300 text-[10px] uppercase font-bold">Office:</label>
              <select
                value={selectedOrgId}
                disabled={isDirty}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="bg-slate-800 text-white font-semibold text-xs rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none"
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
                {user?.Organization?.name || organizations.find(o => String(o.id) === String(effectiveOrgId))?.name || 'Office'}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Notifications */}
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

      {/* ─────────────────────────────────────────────────────────────────
          MAIN WORKSPACE BODY
         ───────────────────────────────────────────────────────────────── */}
      <main className="flex-1 p-2.5 space-y-2.5 overflow-y-auto">
        
        {/* ==============================================================
            1. SALE VOUCHER HEADER
            Only Date, Bill Number (shown only), Customer Name (dropdown), City, TIN/GSTIN
           ============================================================== */}
        <section className="bg-white rounded border border-slate-300 shadow-sm p-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* 1. Date */}
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Date</label>
              <input
                type="date"
                value={billDate}
                disabled={isReadOnly}
                onChange={(e) => {
                  setIsDirty(true);
                  setBillDate(e.target.value);
                }}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-800 disabled:bg-slate-100 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* 2. Bill Number (View-Only display of Next / Current Bill Number) */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-bold text-slate-600 uppercase">
                  Bill Number
                </label>
                <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                  View Only
                </span>
              </div>
              <input
                type="text"
                value={billNumber || 'Fetching...'}
                readOnly
                tabIndex={-1}
                className="w-full bg-slate-100 border border-slate-300 rounded px-2 py-1.5 text-xs font-mono font-bold text-slate-800 cursor-not-allowed select-none focus:outline-none"
                title="Bill Number is system-generated and view-only"
              />
            </div>

            {/* 3. Customer Name (Dropdown) */}
            <div className="md:col-span-4">
              <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCustomerId}
                disabled={isReadOnly}
                onChange={(e) => {
                  if (mode === 'VIEW') return;
                  setIsDirty(true);
                  setSelectedCustomerId(e.target.value);
                }}
                className="w-full bg-white border-2 border-blue-400 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 disabled:bg-slate-100 disabled:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* 4. City */}
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">City</label>
              <input
                type="text"
                value={selectedCustomer?.city || ''}
                readOnly
                placeholder="City"
                className="w-full bg-slate-100 border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-700 cursor-not-allowed"
              />
            </div>

            {/* 5. TIN / GSTIN */}
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">TIN / GSTIN</label>
              <input
                type="text"
                value={selectedCustomer?.tin || ''}
                readOnly
                placeholder="TIN / GSTIN"
                className="w-full bg-slate-100 border border-slate-300 rounded px-2 py-1.5 text-xs font-mono text-slate-700 cursor-not-allowed"
              />
            </div>
          </div>
        </section>

        {/* ==============================================================
            2. PRODUCT ITEMS GRID BOX
            Columns:
            - Select Product (dropdown)
            - Description
            - Basic Rate
            - Difference (manual)
            - Quantity (manual, Tons)
            - Final Rate (Basic Rate + Difference)
            - Amount (Final Rate * Quantity)
           ============================================================== */}
        <section className="bg-white rounded border border-slate-300 shadow-sm p-3">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-200">
            <span className="font-bold text-xs uppercase text-slate-700 tracking-wide">
              Product Items Grid
            </span>
            <span className="text-[11px] text-slate-500">
              Final Rate = Basic Rate + Difference | Amount = Final Rate × Quantity
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-300 rounded">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-2 px-1.5 w-8 text-center">#</th>
                  <th className="py-2 px-2 w-64">Select Product</th>
                  <th className="py-2 px-2">Description</th>
                  <th className="py-2 px-2 w-28 text-right">Basic Rate (₹)</th>
                  <th className="py-2 px-2 w-28 text-right bg-amber-50/50">Difference (₹)</th>
                  <th className="py-2 px-2 w-28 text-right bg-blue-50/50">Quantity (Ton)</th>
                  <th className="py-2 px-2 w-28 text-right bg-emerald-50/50">Final Rate (₹)</th>
                  <th className="py-2 px-2 w-32 text-right">Amount (₹)</th>
                  {!isReadOnly && <th className="py-2 px-1 w-10 text-center">Act</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {transactionItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-1 px-1.5 text-center text-slate-500 text-[11px] font-mono">{idx + 1}</td>

                    {/* 1. Select Product with Dropdown */}
                    <td className="py-1 px-2">
                      <select
                        value={item.productId}
                        disabled={isReadOnly}
                        onChange={(e) => handleItemProductChange(idx, e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-semibold text-slate-800 disabled:bg-transparent disabled:border-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">{item.productName || '-- Select Product --'}</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.price ? `(₹${p.price}/${p.unit || 'Ton'})` : ''}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* 2. Description */}
                    <td className="py-1 px-2">
                      <input
                        type="text"
                        value={item.description}
                        disabled={isReadOnly}
                        onChange={(e) => handleItemDescriptionChange(idx, e.target.value)}
                        placeholder="Specifications / Description"
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-700 disabled:bg-transparent disabled:border-none"
                      />
                    </td>

                    {/* 3. Basic Rate */}
                    <td className="py-1 px-2 text-right">
                      <input
                        type="number"
                        step="any"
                        value={item.basicRate}
                        disabled={isReadOnly}
                        onChange={(e) => handleItemBasicRateChange(idx, e.target.value)}
                        placeholder="0.00"
                        className="w-full text-right font-mono bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800 disabled:bg-transparent disabled:border-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* 4. Difference (Entered manually by user) */}
                    <td className="py-1 px-2 text-right bg-amber-50/20">
                      <input
                        type="number"
                        step="any"
                        value={item.difference}
                        disabled={isReadOnly}
                        onChange={(e) => handleItemDifferenceChange(idx, e.target.value)}
                        placeholder="0.00"
                        className="w-full text-right font-mono font-bold bg-white border border-amber-300 rounded px-1.5 py-1 text-xs text-amber-900 disabled:bg-transparent disabled:border-none focus:ring-1 focus:ring-amber-500"
                        title="Manual difference added to basic rate"
                      />
                    </td>

                    {/* 5. Quantity (Entered manually, default in Ton) */}
                    <td className="py-1 px-2 text-right bg-blue-50/20">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.quantity}
                        disabled={isReadOnly}
                        onChange={(e) => handleItemQuantityChange(idx, e.target.value)}
                        placeholder="1.000"
                        className="w-full text-right font-mono font-bold text-blue-900 bg-white border border-blue-300 rounded px-1.5 py-1 text-xs disabled:bg-transparent disabled:border-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* 6. Final Rate (Basic Rate + Difference, computed) */}
                    <td className="py-1 px-2 text-right font-mono font-bold text-emerald-800 bg-emerald-50/30">
                      ₹{parseFloat(item.finalRate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* 7. Amount (Final Rate * Quantity, computed) */}
                    <td className="py-1 px-2 text-right font-mono font-bold text-slate-900">
                      ₹{parseFloat(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Action */}
                    {!isReadOnly && (
                      <td className="py-1 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeTransactionRow(idx)}
                          disabled={transactionItems.length <= 1}
                          className="text-slate-400 hover:text-red-600 disabled:opacity-20 p-1"
                          title="Remove Row"
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

          {/* Grid Footer Controls & Subtotal */}
          <div className="flex items-center justify-between mt-2 pt-2 bg-slate-50 p-2 rounded border border-slate-200">
            {!isReadOnly ? (
              <button
                type="button"
                onClick={addTransactionRow}
                className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product Row</span>
              </button>
            ) : <div />}

            <div className="flex items-center space-x-6 font-mono text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-sans uppercase">Total Quantity: </span>
                <span className="font-bold text-blue-800 text-sm">{calculations.totalQty} Ton</span>
              </div>
              <div className="bg-slate-200/80 px-3 py-1 rounded">
                <span className="text-[10px] text-slate-600 font-sans font-bold uppercase">Subtotal / Basic: </span>
                <span className="font-bold text-slate-900 text-sm">
                  ₹{parseFloat(calculations.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ==============================================================
            3. ESTIMATE BOX & 4. BILLING BOX
           ============================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          
          {/* ───────────────────────────────────────────────────────────
              ESTIMATE BOX (Pre-tax quotation)
             ─────────────────────────────────────────────────────────── */}
          <section className="bg-sky-50/70 rounded border border-sky-300 shadow-sm p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-1.5 mb-2.5 border-b border-sky-200">
                <div className="flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-sky-700" />
                  <h3 className="font-bold text-xs uppercase text-sky-900 tracking-wide">
                    Estimate Quotation Box (Pre-Tax)
                  </h3>
                </div>
                <span className="px-2 py-0.5 bg-sky-200 text-sky-800 rounded text-[10px] font-bold">
                  {estimateNumber ? `Estimate #${estimateNumber}` : 'Quotation'}
                </span>
              </div>

              <div className="space-y-2 font-mono text-xs">
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
                  <span className="font-bold text-slate-900">
                    ₹{parseFloat(calculations.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-sky-100">
                  <span className="font-sans text-slate-600">Others / Freight Adjustment:</span>
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
                      className="w-24 text-right font-mono bg-white border border-sky-300 rounded px-1.5 py-0.5 text-xs text-slate-800 disabled:bg-transparent disabled:border-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-sky-200">
              <div className="flex justify-between items-center bg-sky-100 p-2.5 rounded border border-sky-300">
                <span className="font-sans font-bold text-xs text-sky-900 uppercase">
                  Estimate Amount:
                </span>
                <span className="font-mono font-bold text-lg text-sky-900">
                  ₹{parseFloat(calculations.estimateTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="mt-2.5 flex justify-end">
                <button
                  type="button"
                  onClick={handlePrintEstimate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-sky-100 text-sky-800 border border-sky-300 rounded text-xs font-semibold shadow-2xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Estimate</span>
                </button>
              </div>
            </div>
          </section>

          {/* ───────────────────────────────────────────────────────────
              BILLING BOX
              Exact required fields:
              - GST rate (dropdown or custom amount in percent)
              - Transport cost
              - Due date
              - Remarks or note (manual)
              - Final bill amount
             ─────────────────────────────────────────────────────────── */}
          <section className="bg-emerald-50/70 rounded border border-emerald-300 shadow-sm p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-1.5 mb-2.5 border-b border-emerald-200">
                <div className="flex items-center space-x-1.5">
                  <Receipt className="w-4 h-4 text-emerald-700" />
                  <h3 className="font-bold text-xs uppercase text-emerald-900 tracking-wide">
                    Bill Box (Tax & Final Amount)
                  </h3>
                </div>
                <span className="px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded text-[10px] font-bold">
                  Official Bill
                </span>
              </div>

              {/* Exact requested fields */}
              <div className="space-y-2.5 text-xs">
                
                {/* 1. GST Rate (Dropdown or Custom in Percent) */}
                <div>
                  <label className="block text-[10px] font-bold text-emerald-900 uppercase mb-1">
                    GST Rate (%) <span className="text-slate-500 font-normal">(Select preset or enter custom %)</span>
                  </label>
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-7">
                      <select
                        value={gstPreset}
                        disabled={isReadOnly}
                        onChange={(e) => handleGstPresetChange(e.target.value)}
                        className="w-full bg-white border border-emerald-400 rounded px-2 py-1 text-xs font-semibold text-emerald-900 disabled:bg-slate-100"
                      >
                        <option value="18">18% GST (Standard)</option>
                        <option value="12">12% GST</option>
                        <option value="5">5% GST</option>
                        <option value="0">0% (Exempt)</option>
                        <option value="custom">Custom Percent...</option>
                      </select>
                    </div>
                    <div className="col-span-5 relative">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={billTaxRate}
                        disabled={isReadOnly}
                        onChange={(e) => handleCustomGstChange(e.target.value)}
                        placeholder="%"
                        className="w-full font-mono font-bold text-right bg-white border-2 border-emerald-400 rounded px-2 pr-6 py-1 text-xs text-emerald-900 disabled:bg-slate-100 focus:ring-1 focus:ring-emerald-500"
                        title="Custom GST rate in percent"
                      />
                      <span className="absolute inset-y-0 right-0 pr-2 flex items-center text-emerald-700 font-bold text-xs pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Transport Cost */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Transport Cost (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-500 font-bold text-xs pointer-events-none">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={billTransportCost}
                      disabled={isReadOnly}
                      onChange={(e) => {
                        setIsDirty(true);
                        setBillTransportCost(e.target.value);
                      }}
                      placeholder="0.00"
                      className="w-full font-mono pl-6 pr-2.5 py-1 text-xs bg-white border border-slate-300 rounded text-slate-800 disabled:bg-slate-100 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* 3. Due Date */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={billDueDate}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      setIsDirty(true);
                      setBillDueDate(e.target.value);
                    }}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 disabled:bg-slate-100 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* 4. Remarks or Notes (Manual) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Remarks / Notes
                  </label>
                  <textarea
                    rows="2"
                    value={billRemark}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      setIsDirty(true);
                      setBillRemark(e.target.value);
                    }}
                    placeholder="Enter manual delivery notes, vehicle, or payment terms..."
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 disabled:bg-slate-100 focus:ring-1 focus:ring-emerald-500"
                  ></textarea>
                </div>

                {/* Breakdown Summary */}
                <div className="bg-white/90 p-2 rounded border border-emerald-200 font-mono text-xs space-y-1">
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-sans">Subtotal:</span>
                    <span>₹{parseFloat(calculations.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-800 font-semibold">
                    <span className="font-sans">GST Amount ({billTaxRate}%):</span>
                    <span>+ ₹{parseFloat(calculations.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {parseFloat(billTransportCost) > 0 && (
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="font-sans">Transport Cost:</span>
                      <span>+ ₹{parseFloat(billTransportCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 5. Final Bill Amount */}
            <div className="mt-3 pt-2.5 border-t border-emerald-200">
              <div className="flex justify-between items-center bg-emerald-700 text-white p-2.5 rounded shadow-sm">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider font-semibold opacity-90">
                    Final Bill Amount:
                  </span>
                  <span className="text-[11px] opacity-75 font-sans">Subtotal + GST + Transport</span>
                </div>
                <span className="font-mono font-bold text-xl text-white">
                  ₹{parseFloat(calculations.finalBillAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="mt-2.5 flex justify-end">
                <button
                  type="button"
                  onClick={handlePrintBill}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Bill</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────────
          BOTTOM ACTION TOOLBAR
          Functional Buttons: Add, Previous, Edit, Save (+ Next, Print Bill)
         ───────────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-200 border-t-2 border-slate-300 p-2 flex items-center justify-between shadow-inner">
        <div className="flex items-center space-x-2">
          {/* 1. ADD */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={actionLoading}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-400 rounded text-xs font-bold shadow-xs active:translate-y-0.5 transition-all flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Add</span>
          </button>

          {/* 3. EDIT */}
          <button
            type="button"
            onClick={handleEdit}
            disabled={actionLoading || mode === 'EDIT' || mode === 'SAVING'}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-400 rounded text-xs font-bold shadow-xs active:translate-y-0.5 transition-all flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Edit3 className="w-3.5 h-3.5 text-blue-600" />
            <span>Edit</span>
          </button>

          {/* 2. PREVIOUS */}
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

        {/* Status Indicator */}
        <div className="hidden sm:flex items-center space-x-2 text-[11px] text-slate-600 font-medium">
          {isDirty && (
            <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-bold animate-pulse">
              ● Unsaved changes
            </span>
          )}
          <span>{billNumber ? `Voucher: ${billNumber}` : 'New Voucher'}</span>
        </div>

        {/* Right Action Buttons */}
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

          {/* 4. SAVE */}
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
