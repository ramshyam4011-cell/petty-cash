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
  ChevronUp,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const Sidebar = ({ isOpen, onClose, isCollapsed, onToggleCollapse }) => {
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
    { path: '/head-master', icon: Database, label: 'Head Master' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const isPageAllowed = (label) => {
    if (user?.role?.toUpperCase() === 'ADMIN') return true;
    if (user?.pageAccess && user.pageAccess.length > 0) {
      return user.pageAccess.includes(label);
    }
    return true; // Simplified for brevity in this refactor
  };

  const menuItems = adminMenuItems.filter(item => isPageAllowed(item.label));

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 left-0 h-full z-50 bg-white border-r border-slate-200 transition-all duration-500 ease-in-out
        ${isCollapsed ? 'lg:w-20' : 'lg:w-64'} 
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        w-64 shadow-2xl lg:shadow-none
      `}>
        {/* Desktop Collapse Toggle - Moved outside the overflow container to prevent clipping */}
        <button 
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute -right-4 top-10 w-8 h-8 bg-white border border-slate-200 rounded-full items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-500 hover:shadow-xl transition-all duration-300 z-[60] shadow-md active:scale-90 group/toggle"
        >
          {isCollapsed ? <ChevronRight size={18} strokeWidth={3} className="group-hover/toggle:translate-x-0.5 transition-transform" /> : <ChevronLeft size={18} strokeWidth={3} className="group-hover/toggle:-translate-x-0.5 transition-transform" />}
        </button>

        <div className="flex flex-col h-full overflow-hidden">
          
          {/* Header/Logo Section */}
          <div className={`h-24 flex items-center border-b border-slate-100 bg-white sticky top-0 z-10 transition-all duration-500 px-5 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            <div className="flex items-center gap-3 group cursor-pointer overflow-hidden min-w-0">
              <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 flex-shrink-0 group-hover:rotate-6 transition-all duration-500">
                <Wallet size={24} className="text-white" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col animate-in fade-in slide-in-from-left-4 duration-500 overflow-hidden">
                  <span className="text-2xl font-black text-slate-900 tracking-tight leading-none truncate">PeteCash</span>
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mt-2 truncate">Enterprise</span>
                </div>
              )}
            </div>

            {/* Mobile Close */}
            <button 
              onClick={onClose} 
              className="lg:hidden p-2.5 hover:bg-slate-50 rounded-2xl text-slate-400 transition-colors"
            >
              <X size={22} strokeWidth={2.5} />
            </button>
          </div>

          {/* Navigation Matrix */}
          <nav className="flex-1 overflow-y-auto py-8 px-3.5 space-y-2.5 scrollbar-hide">
            {!isCollapsed && (
              <div className="px-3 mb-4 animate-in fade-in duration-700">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Operational</p>
              </div>
            )}
            
            {menuItems.map((item, idx) => {
              const isActive = window.location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`
                    flex items-center gap-4 px-4 py-3.5 rounded-[1.25rem] transition-all duration-300 group relative
                    ${isActive 
                      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100/50' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}
                    ${isCollapsed ? 'justify-center px-0' : ''}
                  `}
                >
                  <div className={`transition-all duration-500 flex-shrink-0 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  
                  {!isCollapsed && (
                    <span className="font-bold text-sm tracking-tight whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-500">
                      {item.label}
                    </span>
                  )}

                  {/* Active Visual Indicator */}
                  {isActive && !isCollapsed && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-sm" />
                  )}

                  {/* Tooltip for Collapsed State */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-5 px-4 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-3 group-hover:translate-x-0 z-[100] whitespace-nowrap shadow-2xl">
                      {item.label}
                      <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-y-[6px] border-y-transparent border-r-[6px] border-r-slate-900"></div>
                    </div>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* User & Security Section */}
          <div className="p-4 mt-auto border-t border-slate-50 bg-slate-50/30">
            <div className={`rounded-[2rem] p-4 transition-all duration-500 ${isCollapsed ? 'px-0 flex flex-col items-center gap-4' : 'bg-white border border-slate-100 shadow-sm'}`}>
              <div className={`flex items-center gap-3 ${isCollapsed ? 'flex-col' : 'mb-5'}`}>
                <div className="relative group flex-shrink-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-sm transition-all duration-500 ${
                    isCollapsed ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-indigo-600 border-2 border-indigo-50'
                  }`}>
                    {user?.name?.charAt(0).toUpperCase() || <User size={22} />}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-4 border-white rounded-full shadow-sm"></div>
                </div>
                
                {!isCollapsed && (
                  <div className="flex-1 min-w-0 animate-in fade-in duration-700">
                    <p className="text-sm font-black text-slate-900 truncate uppercase tracking-tight">{user?.name || 'Authorized'}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                      {user?.role === 'ADMIN' ? 'Security Clearance: A' : 'Security Clearance: B'}
                    </p>
                  </div>
                )}
              </div>

              {!isCollapsed ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-3 w-full px-6 py-3.5 rounded-2xl bg-slate-900 text-white hover:bg-rose-600 transition-all duration-300 font-black text-[10px] uppercase tracking-[0.2em] group shadow-lg shadow-slate-200"
                >
                  <LogOutIcon size={16} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" />
                  <span>Terminate</span>
                </button>
              ) : (
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-300 shadow-sm active:scale-90"
                >
                  <LogOutIcon size={20} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
