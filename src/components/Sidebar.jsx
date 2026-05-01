import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Plus,
  TrendingDown,
  Settings,
  LogOut as LogOutIcon,
  X,
  User,
  Wallet,
  Database,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const adminMenuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/add-expense', icon: Plus, label: 'Add Expenses' },
    { path: '/approval-panel', icon: FileText, label: 'Approval Panel' },
    { path: '/expense-list', icon: FileText, label: 'Expense List' },
    { path: '/petty-cash', icon: Wallet, label: 'Petty Cash' },
    { path: '/reports', icon: TrendingDown, label: 'Reports' },
    { path: '/head-master', icon: Database, label: 'Head Master' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const employeeMenuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/add-expense', icon: Plus, label: 'Add Expenses' },
    { path: '/expense-list', icon: FileText, label: 'Expense List' },
    { path: '/petty-cash', icon: Wallet, label: 'Petty Cash' },
  ];

  const isPageAllowed = (label) => {
    // If ADMIN, show everything unless they specifically want to test limits
    if (user?.role?.toUpperCase() === 'ADMIN') return true;
    
    // If user has defined pageAccess, check it
    if (user?.pageAccess && user.pageAccess.length > 0) {
      return user.pageAccess.includes(label);
    }
    
    // Fallback: If no pageAccess defined, show defaults based on role
    return user?.role?.toUpperCase() === 'USER' 
      ? employeeMenuItems.some(m => m.label === label)
      : true;
  };

  const menuItems = adminMenuItems.filter(item => isPageAllowed(item.label));

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 z-50 transform transition-all duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} shadow-xl lg:shadow-none`}>
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform duration-200">
                <Wallet size={20} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-slate-900 tracking-tight leading-none">PettyCash</span>
                <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-widest mt-0.5">Enterprise</span>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5 scrollbar-hide">
            <div className="px-2 mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Main Menu</p>
            </div>
            {menuItems.map((item, idx) => (
              <React.Fragment key={idx}>
                {item.isNested ? (
                  <div className="space-y-1">
                    <button
                      onClick={item.onToggle}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group hover:bg-slate-50 text-slate-600"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={20} className="group-hover:text-indigo-600 transition-colors" />
                        <span className="font-medium text-sm">{item.label}</span>
                      </div>
                      {item.isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    
                    {item.isOpen && (
                      <div className="pl-10 space-y-1 mt-1">
                        {item.subItems.map((sub) => (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            onClick={onClose}
                            className={({ isActive }) => `
                              flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200
                              ${isActive 
                                ? 'text-indigo-600 font-semibold' 
                                : 'text-slate-500 hover:text-indigo-600 hover:translate-x-1'}
                            `}
                          >
                            <span className="text-sm">{sub.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                      ${isActive 
                        ? 'bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}
                    `}
                  >
                    <div className={`p-1.5 rounded-lg transition-colors duration-200 ${
                      item.path === window.location.pathname ? 'bg-white shadow-sm' : 'group-hover:bg-white'
                    }`}>
                      <item.icon size={18} className="transition-transform duration-200 group-hover:scale-110" />
                    </div>
                    <span className="font-medium text-sm">{item.label}</span>
                    {window.location.pathname === item.path && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    )}
                  </NavLink>
                )}
              </React.Fragment>
            ))}
          </nav>

          {/* User Profile Section */}
          <div className="p-4 mt-auto">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-100">
                    {user?.name?.charAt(0) || <User size={20} />}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{user?.name || 'Guest User'}</p>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    {user?.role === 'ADMIN' ? 'Administrator' : 'Employee'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all duration-200 font-medium text-sm group"
              >
                <LogOutIcon size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                <span>Sign Out</span>
              </button>
            </div>
            
            <div className="mt-4 text-center">
              <p className="text-[10px] text-slate-400 font-medium italic">v2.4.0 • Secure Session</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;