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
  ShieldCheck,
  PanelLeftClose
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, permissions } = useContext(AuthContext);

  // Define nav items and the roles allowed to see them
  const navItems = [
    { 
      name: 'Dashboard', 
      icon: LayoutDashboard, 
      path: user?.role === 'SUPER_ADMIN' ? '/super-admin/dashboard' : user?.role === 'CEO' ? '/ceo/dashboard' : user?.role === 'ADMIN' ? '/admin/dashboard' : '/', 
      roles: ['SUPER_ADMIN', 'CEO', 'ADMIN', 'WEIGHBRIDGE_CONTROLLER', 'OPERATIONS_BILLING', 'PAYMENT_COLLECTOR'] 
    },
    { 
      name: 'Organizations', 
      icon: Building2, 
      path: '#', 
      roles: ['SUPER_ADMIN'], 
      disabled: true,
      badge: 'Disabled'
    },
    { name: 'My Offices', icon: Building2, path: '/ceo/offices', roles: ['CEO'] },
    { name: 'My Employees', icon: Users, path: '/ceo/employees', roles: ['CEO'] },
    { 
      name: 'Duty Assignment', 
      icon: ShieldCheck, 
      path: user?.role === 'SUPER_ADMIN' ? '#' : '/super-admin/duty-assignment', 
      roles: ['SUPER_ADMIN', 'CEO'], 
      disabled: user?.role === 'SUPER_ADMIN',
      badge: 'Disabled'
    },
    { name: 'Customers', icon: Users, path: '/customers', roles: ['SUPER_ADMIN', 'CEO', 'ADMIN'], moduleKey: 'CUSTOMER_MASTER' },
    { name: 'Products', icon: Package, path: '/products', roles: ['SUPER_ADMIN', 'CEO', 'ADMIN'], moduleKey: 'PRODUCT_MASTER' },
    { name: 'Estimates', icon: FileText, path: '/estimates', roles: ['SUPER_ADMIN', 'CEO', 'ADMIN', 'OPERATIONS_BILLING'], moduleKey: 'ESTIMATES' },
    { name: 'Billing', icon: Receipt, path: '/bills', end: true, roles: ['SUPER_ADMIN', 'CEO', 'ADMIN', 'OPERATIONS_BILLING'], moduleKey: 'BILLING' },
    { name: 'Sale Voucher', icon: Receipt, path: '/sale-voucher', roles: ['SUPER_ADMIN', 'CEO', 'ADMIN', 'OPERATIONS_BILLING'], moduleKey: 'BILLING' },
    { name: 'Purchases', icon: ShoppingCart, path: '/purchases', roles: ['SUPER_ADMIN', 'CEO', 'ADMIN', 'OPERATIONS_BILLING'], moduleKey: 'PURCHASES' },
    { name: 'Weighbridge', icon: Scale, path: '/weighbridge', roles: ['SUPER_ADMIN', 'CEO', 'ADMIN', 'WEIGHBRIDGE_CONTROLLER', 'OPERATIONS_BILLING'], moduleKey: 'WEIGHBRIDGE' },
    { name: 'Gate Pass', icon: Ticket, path: '/gate-passes', roles: ['SUPER_ADMIN', 'CEO', 'ADMIN', 'WEIGHBRIDGE_CONTROLLER', 'OPERATIONS_BILLING'], moduleKey: 'GATE_PASS' },
    { name: 'Payments', icon: CreditCard, path: '#', disabled: true },
    { name: 'Expenses', icon: Wallet, path: '#', disabled: true },
    { name: 'Reports', icon: BarChart3, path: '#', disabled: true },
    { name: 'Audit Logs', icon: ClipboardList, path: '#', disabled: true },
    { name: 'System Lock', icon: Lock, path: '#', disabled: true, textClass: 'text-red-500' },
  ];

  // Filter items:
  // 1. Roles-based filter (checked first so role-specific items do not leak)
  // 2. For ADMIN, dynamically filter out modules disabled via Duty Assignment
  const visibleNavItems = navItems.filter(item => {
    if (item.roles && user && !item.roles.includes(user.role)) {
      return false;
    }

    if (item.disabled) return true; // Show disabled items for matching roles / general

    // Check duty assignment permission for ADMIN role
    if (user?.role === 'ADMIN' && item.moduleKey) {
      if (permissions && permissions[item.moduleKey] === false) {
        return false;
      }
    }

    return true;
  });

  // Separate active modules and disabled modules so active modules come first and disabled modules appear at the bottom
  const activeNavItems = visibleNavItems.filter(item => !item.disabled);
  const disabledNavItems = visibleNavItems.filter(item => item.disabled);

  return (
    <aside 
      className={`
        fixed inset-y-0 left-0 z-30 md:static md:z-auto
        w-64 h-screen bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0
        transition-all duration-300 ease-in-out
        ${isOpen 
          ? 'translate-x-0 md:ml-0' 
          : '-translate-x-full md:-ml-64'
        }
      `}
    >
      {/* Sidebar Header with Hide Button */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 bg-slate-950 shrink-0">
        <span className="text-xl font-bold text-white tracking-wider">ERP SYSTEM</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
          title="Hide Sidebar"
          aria-label="Hide Sidebar"
        >
          <PanelLeftClose size={20} />
        </button>
      </div>
      
      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        <ul className="space-y-1 px-3">
          {/* Active Navigation Modules */}
          {activeNavItems.map((item, index) => (
            <li key={`active-${index}`}>
              <NavLink
                to={item.path}
                end={item.end || false}
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
            </li>
          ))}

          {/* Disabled Modules at the Bottom */}
          {disabledNavItems.length > 0 && (
            <>
              <li className="pt-3 pb-1 px-3">
                <div className="border-t border-slate-800 mb-2"></div>
                <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                  Inactive / Upcoming
                </span>
              </li>
              {disabledNavItems.map((item, index) => (
                <li key={`disabled-${index}`}>
                  <div 
                    className="flex items-center px-3 py-2.5 rounded-lg text-slate-500 cursor-not-allowed opacity-75 select-none"
                    title={`${item.name} is disabled`}
                  >
                    <item.icon size={20} className="mr-3 shrink-0 text-slate-500" />
                    <span className="flex-1 text-sm font-medium">{item.name}</span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-medium">
                      {item.badge || 'Soon'}
                    </span>
                  </div>
                </li>
              ))}
            </>
          )}
        </ul>
      </div>

      {/* Bottom Hide Sidebar Button */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Hide Sidebar"
        >
          <PanelLeftClose size={16} />
          <span>Hide Sidebar</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
