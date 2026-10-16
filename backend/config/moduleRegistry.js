/**
 * Centralized Module Registry for OfficeFlow ERP
 *
 * Each module has a stable identifier (moduleKey), display name,
 * description, default path, and implementation status.
 */

const MODULES = [
  {
    id: 'CUSTOMER_MASTER',
    name: 'Customer Master',
    category: 'Master Data',
    description: 'Manage customer accounts, billing details, GSTIN/TIN, and addresses',
    path: '/customers',
    isImplemented: true
  },
  {
    id: 'PRODUCT_MASTER',
    name: 'Product Master',
    category: 'Master Data',
    description: 'Product catalog, categories, specifications, and standard units',
    path: '/products',
    isImplemented: true
  },
  {
    id: 'ESTIMATES',
    name: 'Estimate Management',
    category: 'Sales & Invoicing',
    description: 'Create price estimates, generate quotations, and review estimate audits',
    path: '/estimates',
    isImplemented: true
  },
  {
    id: 'BILLING',
    name: 'Billing / Sale Voucher',
    category: 'Sales & Invoicing',
    description: 'Create and finalize official sale vouchers, calculate GST, and record payments',
    path: '/bills',
    isImplemented: true
  },
  {
    id: 'PURCHASES',
    name: 'Purchase Management',
    category: 'Procurement',
    description: 'Manage purchase vouchers, track supplier orders, and CEO/Admin approvals',
    path: '/purchases',
    isImplemented: true
  },
  {
    id: 'WEIGHBRIDGE',
    name: 'Weighbridge Management',
    category: 'Logistics & Dispatch',
    description: 'Record manual vehicle tare & gross weights, and detect weight discrepancies',
    path: '/weighbridge',
    isImplemented: true
  },
  {
    id: 'GATE_PASS',
    name: 'Gate Pass Management',
    category: 'Logistics & Dispatch',
    description: 'Generate gate passes, enforce 10-minute validity rule, and confirm gate exit',
    path: '/gate-passes',
    isImplemented: true
  },
  // Future unimplemented modules (marked isImplemented: false so access cannot be granted yet)
  {
    id: 'PAYMENTS',
    name: 'Payment Collection',
    category: 'Finance',
    description: 'Customer payment receipts, multi-mode collections, and ledger reconciliations',
    path: '/payments',
    isImplemented: false
  },
  {
    id: 'EXPENSES',
    name: 'Expense Management',
    category: 'Finance',
    description: 'Office expenditure tracking, petty cash management, and expense approvals',
    path: '/expenses',
    isImplemented: false
  },
  {
    id: 'REPORTS',
    name: 'Reports & Analytics',
    category: 'Reports',
    description: 'Comprehensive financial, dispatch, and tax reporting summaries',
    path: '/reports',
    isImplemented: false
  }
];

const VALID_MODULE_IDS = MODULES.map(m => m.id);
const IMPLEMENTED_MODULE_IDS = MODULES.filter(m => m.isImplemented).map(m => m.id);

module.exports = {
  MODULES,
  VALID_MODULE_IDS,
  IMPLEMENTED_MODULE_IDS
};
