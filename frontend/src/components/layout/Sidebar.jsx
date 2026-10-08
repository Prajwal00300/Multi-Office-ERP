import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Database,
  FileText,
  Receipt,
  ShoppingCart,
  Truck,
  Ticket,
  CreditCard,
  Wallet,
  BarChart3,
  ClipboardList,
  Lock
} from 'lucide-react';

const Sidebar = ({ isOpen }) => {
  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/super-admin/dashboard', active: true },
    { name: 'Organizations', icon: Building2, path: '/super-admin/organizations' },
    { name: 'Users & Roles', icon: Users, path: '#', disabled: true },
    { name: 'Master Data', icon: Database, path: '#', disabled: true },
    { name: 'Estimates', icon: FileText, path: '#', disabled: true },
    { name: 'Billing', icon: Receipt, path: '#', disabled: true },
    { name: 'Purchases', icon: ShoppingCart, path: '#', disabled: true },
    { name: 'Dispatch', icon: Truck, path: '#', disabled: true },
    { name: 'Gate Pass', icon: Ticket, path: '#', disabled: true },
    { name: 'Payments', icon: CreditCard, path: '#', disabled: true },
    { name: 'Expenses', icon: Wallet, path: '#', disabled: true },
    { name: 'Reports', icon: BarChart3, path: '#', disabled: true },
    { name: 'Audit Logs', icon: ClipboardList, path: '#', disabled: true },
    { name: 'System Lock', icon: Lock, path: '#', disabled: true, textClass: 'text-red-500' },
  ];

  return (
    <aside 
      className={`${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        fixed md:static md:translate-x-0 z-20 w-64 h-[calc(100vh-4rem)] md:h-screen transition-transform duration-300 ease-in-out bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0`}
    >
      <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950 md:flex hidden">
        <span className="text-xl font-bold text-white tracking-wider">ERP SYSTEM</span>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        <ul className="space-y-1 px-3">
          {navItems.map((item, index) => (
            <li key={index}>
              {item.disabled ? (
                <div className="flex items-center px-3 py-2.5 rounded-lg text-slate-500 cursor-not-allowed opacity-75">
                  <item.icon size={20} className="mr-3 shrink-0" />
                  <span className="flex-1 text-sm font-medium">{item.name}</span>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">Soon</span>
                </div>
              ) : (
                <NavLink
                  to={item.path}
                  className={({ isActive }) => 
                    `flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-blue-600 text-white' 
                        : 'hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <item.icon size={20} className="mr-3 shrink-0" />
                  <span className={`text-sm font-medium ${item.textClass || ''}`}>{item.name}</span>
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
