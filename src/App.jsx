import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import AddExpense from './pages/AddExpense';
import Settings from './pages/Settings';
import Ledger from './pages/Ledger';
import ApprovalPanel from './pages/ApprovalPanel';
import PettyCash from './pages/PettyCash';
import ExpenseList from './pages/ExpenseList';
import Report from './pages/Report';
import HeadMaster from './pages/HeadMaster';
import ProtectedRoute from './components/ProtectedRoute';
import { initializeStorage } from './utils/storageManager';

function App() {
  useEffect(() => {
    initializeStorage();
  }, []);

  return (
    <div className="gradient-bg min-h-screen">
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<ProtectedRoute requiredPage="Dashboard"><AdminDashboard /></ProtectedRoute>} />
            <Route path="dashboard" element={<ProtectedRoute requiredPage="Dashboard"><AdminDashboard /></ProtectedRoute>} />
            <Route path="add-expense" element={<ProtectedRoute requiredPage="Add Expenses"><AddExpense /></ProtectedRoute>} />
            <Route path="expense-list" element={<ProtectedRoute requiredPage="Expense List"><ExpenseList /></ProtectedRoute>} />
            <Route path="petty-cash" element={<ProtectedRoute requiredPage="Petty Cash"><PettyCash /></ProtectedRoute>} />
            
            {/* Admin/Permission Restricted Routes */}
            <Route path="settings" element={<ProtectedRoute requiredPage="Settings" allowedRoles={['ADMIN']}><Settings /></ProtectedRoute>} />
            <Route path="head-master" element={<ProtectedRoute requiredPage="Head Master" allowedRoles={['ADMIN']}><HeadMaster /></ProtectedRoute>} />
            <Route path="ledger" element={<ProtectedRoute allowedRoles={['ADMIN']}><Ledger /></ProtectedRoute>} />
            <Route path="approval-panel" element={<ProtectedRoute requiredPage="Approval Panel" allowedRoles={['ADMIN']}><ApprovalPanel /></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute requiredPage="Reports" allowedRoles={['ADMIN']}><Report /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;