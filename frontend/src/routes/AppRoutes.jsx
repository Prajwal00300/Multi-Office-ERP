import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Login from '../pages/Login';
import Signup from '../pages/Signup';
import Unauthorized from '../pages/Unauthorized';
import ProtectedRoute from './ProtectedRoute';
import Layout from '../components/layout/Layout';
import SuperAdminDashboard from '../pages/super-admin/SuperAdminDashboard';

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
