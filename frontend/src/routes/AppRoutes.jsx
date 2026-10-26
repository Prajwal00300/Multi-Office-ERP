import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Login from '../pages/Login';
import Signup from '../pages/Signup';
import Unauthorized from '../pages/Unauthorized';
import ProtectedRoute from './ProtectedRoute';
import Layout from '../components/layout/Layout';
import SuperAdminDashboard from '../pages/super-admin/SuperAdminDashboard';
import OrganizationsList from '../pages/super-admin/OrganizationsList';
import OrganizationForm from '../pages/super-admin/OrganizationForm';
import OrganizationUsers from '../pages/super-admin/OrganizationUsers';
import DutyAssignment from '../pages/super-admin/DutyAssignment';
import CeoDetails from '../pages/super-admin/CeoDetails';
import CeoDashboard from '../pages/ceo/CeoDashboard';
import CeoOffices from '../pages/ceo/CeoOffices';
import CeoEmployees from '../pages/ceo/CeoEmployees';
import AdminDashboard from '../pages/admin/AdminDashboard';
import CustomersList from '../pages/customers/CustomersList';
import ProductsList from '../pages/products/ProductsList';
import EstimatesList from '../pages/estimates/EstimatesList';
import EstimateForm from '../pages/estimates/EstimateForm';
import EstimateDetail from '../pages/estimates/EstimateDetail';
import EstimatePrint from '../pages/estimates/EstimatePrint';
import EstimateVoucherWorkspace from '../pages/estimates/EstimateVoucherWorkspace';
import BillsList from '../pages/billing/BillsList';
import BillForm from '../pages/billing/BillForm';
import BillDetail from '../pages/billing/BillDetail';
import BillPrint from '../pages/billing/BillPrint';
import CombinedTransactionWorkspace from '../pages/billing/CombinedTransactionWorkspace';
import PurchasesList from '../pages/purchases/PurchasesList';
import PurchaseForm from '../pages/purchases/PurchaseForm';
import OrderReceived from '../pages/purchases/OrderReceived';
import PurchaseDetail from '../pages/purchases/PurchaseDetail';
import WeighbridgeList from '../pages/weighbridge/WeighbridgeList';
import WeighbridgeForm from '../pages/weighbridge/WeighbridgeForm';
import WeighbridgeDetail from '../pages/weighbridge/WeighbridgeDetail';
import GatePassesList from '../pages/gate-passes/GatePassesList';
import GatePassForm from '../pages/gate-passes/GatePassForm';
import GatePassDetail from '../pages/gate-passes/GatePassDetail';
import GatePassPrint from '../pages/gate-passes/GatePassPrint';

const getAdminHomeRoute = (perms) => {
  if (!perms) return '/bills';
  const order = [
    { key: 'BILLING', path: '/bills' },
    { key: 'ESTIMATES', path: '/estimates' },
    { key: 'PURCHASES', path: '/purchases' },
    { key: 'CUSTOMER_MASTER', path: '/customers' },
    { key: 'PRODUCT_MASTER', path: '/products' },
    { key: 'WEIGHBRIDGE', path: '/weighbridge' },
    { key: 'GATE_PASS', path: '/gate-passes' }
  ];
  const found = order.find(item => perms[item.key] !== false);
  return found ? found.path : '/unauthorized';
};

const AppRoutes = () => {
  const { isAuthenticated, user, permissions, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/signup" element={isAuthenticated ? <Navigate to="/" replace /> : <Signup />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Protected Super Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
        <Route element={<Layout />}>
          <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
          <Route path="/super-admin/ceos/:id" element={<CeoDetails />} />
          <Route path="/super-admin/organizations" element={<OrganizationsList />} />
          <Route path="/super-admin/organizations/new" element={<OrganizationForm />} />
          <Route path="/super-admin/organizations/:id/edit" element={<OrganizationForm />} />
          <Route path="/super-admin/organizations/:id/users" element={<OrganizationUsers />} />
        </Route>
      </Route>

      {/* Duty Assignment (Super Admin and CEO) */}
      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'CEO']} />}>
        <Route element={<Layout />}>
          <Route path="/super-admin/duty-assignment" element={<DutyAssignment />} />
          <Route path="/ceo/duty-assignment" element={<DutyAssignment />} />
        </Route>
      </Route>

      {/* Protected CEO Console Routes */}
      <Route element={<ProtectedRoute allowedRoles={['CEO']} />}>
        <Route element={<Layout />}>
          <Route path="/ceo/dashboard" element={<CeoDashboard />} />
          <Route path="/ceo/offices" element={<CeoOffices />} />
          <Route path="/ceo/employees" element={<CeoEmployees />} />
        </Route>
      </Route>

      {/* Protected Admin Console Routes */}
      <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']} />}>
        <Route element={<Layout />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Route>
      </Route>

      {/* Customer Master Routes */}
      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'CEO', 'ADMIN']} requiredModule="CUSTOMER_MASTER" />}>
        <Route element={<Layout />}>
          <Route path="/customers" element={<CustomersList />} />
        </Route>
      </Route>

      {/* Product Master Routes */}
      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'CEO', 'ADMIN']} requiredModule="PRODUCT_MASTER" />}>
        <Route element={<Layout />}>
          <Route path="/products" element={<ProductsList />} />
        </Route>
      </Route>

      {/* Estimate Management Routes */}
      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'CEO', 'ADMIN', 'OPERATIONS_BILLING']} requiredModule="ESTIMATES" />}>
        <Route element={<Layout />}>
          <Route path="/estimates" element={<EstimatesList />} />
          <Route path="/estimate-voucher" element={<EstimateVoucherWorkspace />} />
          <Route path="/estimates/new" element={<Navigate to="/estimate-voucher" replace />} />
          <Route path="/estimates/:id" element={<EstimateDetail />} />
          <Route path="/estimates/:id/edit" element={<EstimateForm />} />
          <Route path="/estimates/:id/print" element={<EstimatePrint />} />
        </Route>
      </Route>

      {/* Billing / Sale Voucher Routes */}
      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'CEO', 'ADMIN', 'OPERATIONS_BILLING']} requiredModule="BILLING" />}>
        <Route element={<Layout />}>
          <Route path="/bills" element={<BillsList />} />
          <Route path="/bills/new" element={<BillForm />} />
          <Route path="/sale-voucher" element={<CombinedTransactionWorkspace />} />
          <Route path="/bills/transaction" element={<Navigate to="/sale-voucher" replace />} />
          <Route path="/bills/:id" element={<BillDetail />} />
          <Route path="/bills/:id/edit" element={<BillForm />} />
          <Route path="/bills/:id/print" element={<BillPrint />} />
        </Route>
      </Route>

      {/* Purchase Management Routes */}
      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'CEO', 'ADMIN', 'OPERATIONS_BILLING']} requiredModule="PURCHASES" />}>
        <Route element={<Layout />}>
          <Route path="/purchases" element={<PurchasesList />} />
          <Route path="/purchases/new" element={<PurchaseForm />} />
          <Route path="/purchases/receive" element={<OrderReceived />} />
          <Route path="/purchases/:id" element={<PurchaseDetail />} />
          <Route path="/purchases/:id/edit" element={<PurchaseForm />} />
        </Route>
      </Route>

      {/* Weighbridge Management Routes */}
      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'CEO', 'ADMIN', 'WEIGHBRIDGE_CONTROLLER', 'OPERATIONS_BILLING']} requiredModule="WEIGHBRIDGE" />}>
        <Route element={<Layout />}>
          <Route path="/weighbridge" element={<WeighbridgeList />} />
          <Route path="/weighbridge/new" element={<WeighbridgeForm />} />
          <Route path="/weighbridge/:id" element={<WeighbridgeDetail />} />
        </Route>
      </Route>

      {/* Gate Pass Management Routes */}
      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'CEO', 'ADMIN', 'WEIGHBRIDGE_CONTROLLER', 'OPERATIONS_BILLING']} requiredModule="GATE_PASS" />}>
        <Route element={<Layout />}>
          <Route path="/gate-passes" element={<GatePassesList />} />
          <Route path="/gate-passes/new" element={<GatePassForm />} />
          <Route path="/gate-passes/:id" element={<GatePassDetail />} />
          <Route path="/gate-passes/:id/print" element={<GatePassPrint />} />
        </Route>
      </Route>

      {/* Root redirect based on auth state and role */}
      <Route 
        path="/" 
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : user?.role === 'SUPER_ADMIN' ? (
            <Navigate to="/super-admin/dashboard" replace />
          ) : user?.role === 'CEO' ? (
            <Navigate to="/ceo/dashboard" replace />
          ) : user?.role === 'ADMIN' ? (
            <Navigate to="/admin/dashboard" replace />
          ) : user?.role === 'OPERATIONS_BILLING' ? (
            <Navigate to="/bills" replace />
          ) : user?.role === 'WEIGHBRIDGE_CONTROLLER' ? (
            <Navigate to="/weighbridge" replace />
          ) : (
            <Navigate to="/unauthorized" replace />
          )
        } 
      />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
