import React, { useContext, useState } from 'react';
import { Menu, User, LogOut, ChevronDown, PanelLeftClose } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Header = ({ sidebarOpen, toggleSidebar }) => {
  const { user, logout } = useContext(AuthContext);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0">
      <div className="flex items-center">
        <button 
          onClick={toggleSidebar}
          className="mr-3 p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none transition-colors"
          title={sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
          aria-label={sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
        >
          {sidebarOpen ? <PanelLeftClose size={20} /> : <Menu size={22} />}
        </button>
        <h1 className="text-xl font-semibold text-gray-800 hidden sm:block">
          {user?.role === 'SUPER_ADMIN' 
            ? 'Super Admin Dashboard' 
            : user?.role === 'ADMIN' 
              ? `${user?.organization?.name || 'Office'} Admin Console` 
              : 'OfficeFlow ERP'}
        </h1>
        <h1 className="text-lg font-bold text-gray-800 sm:hidden">ERP</h1>
      </div>

      <div className="flex items-center relative">
        <button 
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 focus:outline-none transition-colors"
        >
          <div className="hidden md:flex flex-col text-right">
            <span className="text-sm font-medium text-gray-700">{user?.username}</span>
            <span className="text-xs text-blue-600 font-semibold">{user?.role?.replace('_', ' ')}</span>
          </div>
          <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 border border-blue-200">
            <User size={18} />
          </div>
          <ChevronDown size={16} className="text-gray-400 hidden sm:block" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg py-1 border border-gray-100">
            <div className="px-4 py-3 border-b border-gray-100 md:hidden">
              <p className="text-sm font-medium text-gray-800">{user?.username}</p>
              <p className="text-xs text-gray-500">{user?.role}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
            >
              <LogOut size={16} className="mr-2" />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
