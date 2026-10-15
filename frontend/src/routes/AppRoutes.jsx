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
import CustomersList from '../pages/customers/CustomersList';
import ProductsList from '../pages/products/ProductsList';
import EstimatesList from '../pages/estimates/EstimatesList';
import EstimateForm from '../pages/estimates/EstimateForm';
import EstimateDetail from '../pages/estimates/EstimateDetail';
import EstimatePrint from '../pages/estimates/EstimatePrint';
import BillsList from '../pages/billing/BillsList';
import BillForm from '../pages/billing/BillForm';
import BillDetail from '../pages/billing/BillDetail';
import BillPrint from '../pages/billing/BillPrint';
import PurchasesList from '../pages/purchases/PurchasesList';
import PurchaseForm from '../pages/purchases/PurchaseForm';
import PurchaseDetail from '../pages/purchases/PurchaseDetail';

const AppRoutes = () => {
  const { isAuthenticated, user, loading } = useContext(AuthContext);

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
          <Route path="/super-admin/organizations" element={<OrganizationsList />} />
          <Route path="/super-admin/organizations/new" element={<OrganizationForm />} />
          <Route path="/super-admin/organizations/:id/edit" element={<OrganizationForm />} />
          <Route path="/super-admin/organizations/:id/users" element={<OrganizationUsers />} />
        </Route>
      </Route>

      {/* Mixed Access Routes (Temporarily SUPER_ADMIN only for customer & product master) */}
      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
        <Route element={<Layout />}>
          <Route path="/customers" element={<CustomersList />} />
          <Route path="/products" element={<ProductsList />} />
        </Route>
      </Route>

      {/* Protected Estimate & Billing Routes (SUPER_ADMIN, ADMIN, OPERATIONS_BILLING) */}
      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_BILLING']} />}>
        <Route element={<Layout />}>
          <Route path="/estimates" element={<EstimatesList />} />
          <Route path="/estimates/new" element={<EstimateForm />} />
          <Route path="/estimates/:id" element={<EstimateDetail />} />
          <Route path="/estimates/:id/edit" element={<EstimateForm />} />
          <Route path="/estimates/:id/print" element={<EstimatePrint />} />
          <Route path="/bills" element={<BillsList />} />
          <Route path="/bills/new" element={<BillForm />} />
          <Route path="/bills/:id" element={<BillDetail />} />
          <Route path="/bills/:id/edit" element={<BillForm />} />
          <Route path="/bills/:id/print" element={<BillPrint />} />
          <Route path="/purchases" element={<PurchasesList />} />
          <Route path="/purchases/new" element={<PurchaseForm />} />
          <Route path="/purchases/:id" element={<PurchaseDetail />} />
          <Route path="/purchases/:id/edit" element={<PurchaseForm />} />
        </Route>
      </Route>

      {/* Root redirect based on auth state */}
      <Route 
        path="/" 
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : user?.role === 'SUPER_ADMIN' ? (
            <Navigate to="/super-admin/dashboard" replace />
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
