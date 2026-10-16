import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ allowedRoles = [], requiredModule = null }) => {
  const { isAuthenticated, user, permissions, permissionsLoading, loading } = useContext(AuthContext);

  if (loading || (user?.role === 'ADMIN' && permissionsLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check module permission for ADMIN role
  if (user?.role === 'ADMIN' && requiredModule) {
    if (permissions && permissions[requiredModule] === false) {
      return (
        <Navigate 
          to="/unauthorized" 
          state={{ 
            reason: `Access to the ${requiredModule.replace(/_/g, ' ')} module has been disabled for your account by the Super Admin.` 
          }} 
          replace 
        />
      );
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
