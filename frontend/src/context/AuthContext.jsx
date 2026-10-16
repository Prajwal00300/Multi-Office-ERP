import React, { createContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  const fetchUserPermissions = useCallback(async () => {
    try {
      setPermissionsLoading(true);
      const res = await api.get('/duty-assignments/my-permissions');
      setPermissions(res.data?.permissions || {});
    } catch (err) {
      console.error('Failed to load user permissions:', err);
      setPermissions({});
    } finally {
      setPermissionsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('auth_user');

      if (storedToken && storedUser) {
        try {
          // Verify token is still valid with backend
          const response = await api.get('/auth/me');
          setToken(storedToken);
          setUser(response.data.user);
          setIsAuthenticated(true);

          // Fetch fresh module permissions for this user
          const permRes = await api.get('/duty-assignments/my-permissions');
          setPermissions(permRes.data?.permissions || {});
        } catch (error) {
          console.error("Token verification failed", error);
          logout();
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (jwtToken, userData) => {
    localStorage.setItem('auth_token', jwtToken);
    localStorage.setItem('auth_user', JSON.stringify(userData));
    setToken(jwtToken);
    setUser(userData);
    setIsAuthenticated(true);

    try {
      setPermissionsLoading(true);
      const permRes = await api.get('/duty-assignments/my-permissions');
      setPermissions(permRes.data?.permissions || {});
    } catch (err) {
      console.error('Failed to load permissions on login:', err);
      setPermissions({});
    } finally {
      setPermissionsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
    setPermissions({});
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      isAuthenticated, 
      permissions,
      permissionsLoading,
      refreshPermissions: fetchUserPermissions,
      login, 
      logout, 
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
