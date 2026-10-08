import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Unauthorized = () => {
  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-sm border border-gray-100 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-6">You do not have permission to access the requested page.</p>
        <button
          onClick={handleLogout}
          className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          Log Out & Go Back
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;
