import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = () => {
  const location = useLocation();
  const isSaleVoucher = location.pathname.startsWith('/sale-voucher');
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('officeflow_sidebar_open');
      if (saved !== null) return saved === 'true';
      return window.innerWidth >= 768;
    }
    return true;
  });

  const handleToggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('officeflow_sidebar_open', String(next));
      }
      return next;
    });
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('officeflow_sidebar_open', 'false');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 z-20 md:hidden print:hidden"
          onClick={handleCloseSidebar}
        />
      )}
      
      <div className="print:hidden">
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={handleCloseSidebar} 
        />
      </div>
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible">
        <div className="print:hidden">
          <Header 
            sidebarOpen={sidebarOpen}
            toggleSidebar={handleToggleSidebar} 
          />
        </div>
        <main className={`flex-1 ${isSaleVoucher ? 'p-1 overflow-hidden' : 'overflow-y-auto p-4 sm:p-6 lg:p-8'} print:p-0 print:overflow-visible`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
