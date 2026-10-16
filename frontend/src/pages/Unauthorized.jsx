import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';

const Unauthorized = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useContext(AuthContext);

  const customReason = location.state?.reason;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleGoDashboard = () => {
    if (user?.role === 'SUPER_ADMIN') {
      navigate('/super-admin/dashboard');
    } else {
      navigate('/bills');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Access Restricted</h1>
        <p className="text-slate-600 text-sm leading-relaxed">
          {customReason || 'You do not have permission to access the requested module or page. Please contact your Super Admin.'}
        </p>
        <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={handleGoDashboard}
            className="inline-flex items-center justify-center gap-1.5 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            <ArrowLeft size={16} /> Return to Dashboard
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-1.5 py-2 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
