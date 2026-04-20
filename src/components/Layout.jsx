import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;

  return (
    <div className="flex min-h-screen bg-white">
      
      {/* Sidebar - Fixed on desktop, sliding on mobile */}
      <Sidebar 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-56 transition-all">
        
        {/* Header - Sticky */}
        <Header 
          onMenuClick={() => setSidebarOpen(true)} 
          user={user}
        />
        
        <main className="flex-1 p-2 sm:p-2 lg:p-2 overflow-y-auto pb-28 lg:pb-14">
          <div className="max-w-7xl mx-auto w-full animate-in fade-in duration-500">
            <Outlet />
          </div>
        </main>

        <Footer />

      </div>
    </div>
  );
};

export default Layout;