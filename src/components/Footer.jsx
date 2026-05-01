import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Plus, TrendingDown, BookOpen } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const Footer = ({ isCollapsed }) => {
    const location = useLocation();
    const { user } = useAuthStore();
    
    // Do not show icons on Settings page
    const isSettingsPage = location.pathname === '/settings';

    const adminMenuItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/add-expense', icon: Plus, label: 'Add Expense' },
        { path: '/expense-list', icon: TrendingDown, label: 'Expenses' },
        { path: '/ledger', icon: BookOpen, label: 'Ledger' },
    ];

    const employeeMenuItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/add-expense', icon: Plus, label: 'Add Expense' },
        { path: '/expense-list', icon: TrendingDown, label: 'Expenses' },
    ];

    const menuItems = user?.role === 'ADMIN' ? adminMenuItems : employeeMenuItems;

    return (
        <footer className={`fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] pb-[env(safe-area-inset-bottom)] transition-all duration-500 ${isCollapsed ? 'lg:left-20' : 'lg:left-64'}`}>
            <div className="max-w-7xl mx-auto">
                {/* Mobile Navigation Icons */}
                {!isSettingsPage && (
                    <div className="lg:hidden flex justify-around items-center px-2 pt-2 pb-1 border-b border-slate-50">
                        {menuItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => `
                                    flex flex-col items-center px-1 py-1 rounded-2xl min-w-[70px] transition-all duration-300
                                    ${isActive ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'}
                                `}
                            >
                                <item.icon size={18} className={`mb-1 transition-transform duration-300 ${location.pathname === item.path ? 'scale-110' : ''}`} />
                                <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
                            </NavLink>
                        ))}
                    </div>
                )}

                {/* Attribution Bar */}
                <div className="py-2.5 flex justify-center items-center">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                        Powered By <a 
                            href="https://www.botivate.in" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-indigo-600 font-black transition-colors"
                        >
                            Botivate
                        </a>
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
