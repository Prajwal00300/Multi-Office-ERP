import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Package,
  Database,
  FileText,
  Receipt,
  ShoppingCart,
  Truck,
  Scale,
  Ticket,
  CreditCard,
  Wallet,
  BarChart3,
  ClipboardList,
  Lock,
  ShieldCheck
} from 'lucide-react';

const Sidebar = ({ isOpen }) => {
  const { user, permissions } = useContext(AuthContext);

  // Define nav items and the roles allowed to see them
  const navItems = [
    { 
      name: 'Dashboard', 
      icon: LayoutDashboard, 
      path: user?.role === 'SUPER_ADMIN' ? '/super-admin/dashboard' : user?.role === 'ADMIN' ? '/admin/dashboard' : '/', 
      roles: ['SUPER_ADMIN', 'ADMIN', 'WEIGHBRIDGE_CONTROLLER', 'OPERATIONS_BILLING', 'PAYMENT_COLLECTOR'] 
    },
    { name: 'Organizations', icon: Building2, path: '/super-admin/organizations', roles: ['SUPER_ADMIN'] },
    { name: 'Duty Assignment', icon: ShieldCheck, path: '/super-admin/duty-assignment', roles: ['SUPER_ADMIN'] },
    { name: 'Customers', icon: Users, path: '/customers', roles: ['SUPER_ADMIN', 'ADMIN'], moduleKey: 'CUSTOMER_MASTER' },
    { name: 'Products', icon: Package, path: '/products', roles: ['SUPER_ADMIN', 'ADMIN'], moduleKey: 'PRODUCT_MASTER' },
    { name: 'Estimates', icon: FileText, path: '/estimates', roles: ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_BILLING'], moduleKey: 'ESTIMATES' },
    { name: 'Billing', icon: Receipt, path: '/bills', roles: ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_BILLING'], moduleKey: 'BILLING' },
    { name: 'Purchases', icon: ShoppingCart, path: '/purchases', roles: ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_BILLING'], moduleKey: 'PURCHASES' },
    { name: 'Weighbridge', icon: Scale, path: '/weighbridge', roles: ['SUPER_ADMIN', 'ADMIN', 'WEIGHBRIDGE_CONTROLLER', 'OPERATIONS_BILLING'], moduleKey: 'WEIGHBRIDGE' },
    { name: 'Gate Pass', icon: Ticket, path: '/gate-passes', roles: ['SUPER_ADMIN', 'ADMIN', 'WEIGHBRIDGE_CONTROLLER', 'OPERATIONS_BILLING'], moduleKey: 'GATE_PASS' },
    { name: 'Payments', icon: CreditCard, path: '#', disabled: true },
    { name: 'Expenses', icon: Wallet, path: '#', disabled: true },
    { name: 'Reports', icon: BarChart3, path: '#', disabled: true },
    { name: 'Audit Logs', icon: ClipboardList, path: '#', disabled: true },
    { name: 'System Lock', icon: Lock, path: '#', disabled: true, textClass: 'text-red-500' },
  ];

  // Filter items:
  // 1. Roles-based filter
  // 2. For ADMIN, dynamically filter out modules disabled via Duty Assignment
  const visibleNavItems = navItems.filter(item => {
    if (item.disabled) return true; // Show disabled items to everyone

    if (item.roles && user && !item.roles.includes(user.role)) {
      return false;
    }

    // Check duty assignment permission for ADMIN role
    if (user?.role === 'ADMIN' && item.moduleKey) {
      if (permissions && permissions[item.moduleKey] === false) {
        return false;
      }
    }

    return true;
  });

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
          {visibleNavItems.map((item, index) => (
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
