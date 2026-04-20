import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Plus, TrendingDown, BookOpen } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const Footer = () => {
    const location = useLocation();
    const { user } = useAuthStore();
    
    // Do not show icons on Settings page
    const isSettingsPage = location.pathname === '/settings';

    const adminMenuItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/add-case', icon: Plus, label: 'Add Cash' },
        { path: '/expenses', icon: TrendingDown, label: 'Expenses' },
        { path: '/ledger', icon: BookOpen, label: 'Ledger' },
    ];

    const employeeMenuItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/add-case', icon: Plus, label: 'Add Cash' },
        { path: '/expenses', icon: TrendingDown, label: 'Expenses' },
    ];

    const menuItems = user?.role === 'ADMIN' ? adminMenuItems : employeeMenuItems;

    return (
        <>
            {/* Bottom Navigation Icons - Shows above the botivate footer on mobile */}
            {!isSettingsPage && (
                <div className="lg:hidden fixed bottom-[36px] left-0 right-0 bg-white border-t border-sky-100 flex justify-around items-center py-1.5 z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] pb-[env(safe-area-inset-bottom)]">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `
                                flex flex-col items-center px-3 py-1 rounded-lg min-w-[64px] transition-colors
                                ${isActive ? 'text-sky-600 bg-sky-50' : 'text-gray-500 hover:text-sky-600 hover:bg-sky-50'}
                            `}
                        >
                            <item.icon size={20} className="mb-0.5" />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </NavLink>
                    ))}
                </div>
            )}

            {/* Original Footer */}
            <footer className="fixed bottom-0 left-0 lg:left-56 right-0 py-3 md:py-2 border-t border-sky-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-50">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-[13px] md:text-sm font-bold md:font-medium text-sky-700">
                        Powered By <a 
                            href="https://www.botivate.in" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sky-700 md:text-sky-600 hover:text-sky-800 font-black md:font-bold hover:underline transition-all"
                        >
                            Botivate
                        </a>
                    </p>
                </div>
            </footer>
        </>
    );
};

export default Footer;
