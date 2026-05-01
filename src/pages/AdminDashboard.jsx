import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Calendar, Wallet, Clock, AlertTriangle, TrendingUp, 
  ChevronRight, Activity, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  formatCurrency, 
  getTodayDate,
  formatDateForInput
} from '../utils/helpers';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [expenses, setExpenses] = useState([]);
  const [pettyCash, setPettyCash] = useState([]);
  const [fetching, setFetching] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setFetching(true);
      
      // Fetch both datasets in parallel
      const [expRes, pcRes] = await Promise.all([
        fetch(APPSCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'read' }) }),
        fetch(APPSCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'readPettyCash' }) })
      ]);

      const [expJson, pcJson] = await Promise.all([expRes.json(), pcRes.json()]);

      if (expJson.success) {
        const mappedExp = (expJson.data || []).map((e, idx) => {
          const d = {};
          Object.keys(e).forEach(k => { d[k.trim()] = e[k]; });
          return {
            id: d.SN || `exp-${idx}`,
            sn: d.SN,
            date: d.Date ? formatDateForInput(d.Date) : '-',
            groupHead: d['Group Head'],
            amount: parseFloat(d['Amount (INR)']) || 0,
            remarks: d['Description / Reason'],
            billUrl: d['Bill / Receipt'],
            status: (d.Status || 'Pending').trim()
          };
        });
        setExpenses(mappedExp);
      }

      if (pcJson.success) {
        const mappedPC = (pcJson.data || []).map((t, idx) => {
          const d = {};
          Object.keys(t).forEach(k => { d[k.trim()] = t[k]; });
          return {
            id: d.Timestamp || `pc-${idx}`,
            type: d.Type,
            amount: parseFloat(d.Amount) || 0,
            date: d.Date
          };
        });
        setPettyCash(mappedPC);
      }

    } catch (err) {
      console.error(err);
      toast.error('Error connecting to sheets');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const stats = useMemo(() => {
    const today = getTodayDate();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Today's Expense (From Expense List - Approved)
    const todaysApprovedExpenses = expenses.filter(e => e.date === today && e.status.toUpperCase() === 'APPROVED');
    const todaysExpense = todaysApprovedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const todaysEntries = todaysApprovedExpenses.length;

    // Month's Expense (From Expense List - Approved)
    const monthsApprovedExpenses = expenses.filter(e => {
      if (!e.date || e.date === '-') return false;
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && e.status.toUpperCase() === 'APPROVED';
    });
    const monthsExpense = monthsApprovedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const monthsEntries = monthsApprovedExpenses.length;

    // Cash in Hand (From Petty Cash Ledger)
    const totalReceived = pettyCash
      .filter(t => t.type === 'Cash Received' || t.type === 'Cash Returned')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalSpent = pettyCash
      .filter(t => t.type === 'Expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const cashInHand = totalReceived - totalSpent;

    // Pending Approvals
    const pendingApprovals = expenses.filter(e => e.status.toUpperCase() === 'PENDING').length;

    // Missing Bills (Approved without receipt)
    const missingBills = expenses.filter(e => e.status.toUpperCase() === 'APPROVED' && !e.billUrl).length;

    return {
      todaysExpense,
      todaysEntries,
      monthsExpense,
      monthsEntries,
      cashInHand,
      pendingApprovals,
      missingBills
    };
  }, [expenses, pettyCash]);

  const chartData = useMemo(() => {
    // Daily Expense (Last 7 Days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
      
      const dayExpense = expenses
        .filter(e => e.date === dateStr && e.status.toUpperCase() === 'APPROVED')
        .reduce((sum, e) => sum + e.amount, 0);
      
      last7Days.push({ name: dayName, amount: dayExpense });
    }

    // Expense by Group (Approved)
    const groupMap = {};
    expenses
      .filter(e => e.status.toUpperCase() === 'APPROVED')
      .forEach(e => {
        const group = e.groupHead || 'Other';
        groupMap[group] = (groupMap[group] || 0) + e.amount;
      });
    
    const groupData = Object.entries(groupMap).map(([name, value]) => ({ name, value }));

    return { daily: last7Days, groups: groupData };
  }, [expenses]);

  const recentExpenses = useMemo(() => {
    return [...expenses]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  }, [expenses]);

  if (fetching) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 size={40} className="text-indigo-600 animate-spin" />
        <p className="text-gray-500 font-medium animate-pulse">Syncing with Google Sheets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest mb-1">
            <Activity size={14} />
            <span>Real-time Analytics</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 mt-2 font-medium">
            Welcome back, <span className="text-indigo-600 font-bold">{user?.name || 'Admin'}</span>. Here's a summary of your operations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchDashboardData}
            className="flex items-center gap-2 bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-all active:scale-95 group"
          >
            <Activity size={18} className="text-indigo-600 group-hover:animate-pulse" />
            <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-600">Sync Sheets</span>
          </button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {/* Today's Expense */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all duration-300 group">
          <div className="flex items-start justify-between">
            <div className="bg-blue-500 p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-200">
              <Calendar className="text-white" size={24} />
            </div>
          </div>
          <div className="mt-5 space-y-1">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">
              {formatCurrency(stats.todaysExpense).replace('INR', '₹')}
            </h3>
            <p className="text-sm font-bold text-gray-500">Today's Expense</p>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{stats.todaysEntries} entries</p>
          </div>
        </div>

        {/* Month's Expense */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all duration-300 group">
          <div className="flex items-start justify-between">
            <div className="bg-indigo-500 p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-indigo-200">
              <TrendingUp className="text-white" size={24} />
            </div>
          </div>
          <div className="mt-5 space-y-1">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">
              {formatCurrency(stats.monthsExpense).replace('INR', '₹')}
            </h3>
            <p className="text-sm font-bold text-gray-500">Month's Expense</p>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{stats.monthsEntries} entries</p>
          </div>
        </div>

        {/* Cash in Hand */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all duration-300 group">
          <div className="flex items-start justify-between">
            <div className="bg-emerald-500 p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-emerald-200">
              <Wallet className="text-white" size={24} />
            </div>
          </div>
          <div className="mt-5 space-y-1">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">
              {formatCurrency(stats.cashInHand).replace('INR', '₹')}
            </h3>
            <p className="text-sm font-bold text-gray-500">Cash in Hand</p>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Petty cash balance</p>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all duration-300 group">
          <div className="flex items-start justify-between">
            <div className="bg-amber-500 p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-amber-200">
              <Clock className="text-white" size={24} />
            </div>
          </div>
          <div className="mt-5 space-y-1">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">{stats.pendingApprovals}</h3>
            <p className="text-sm font-bold text-gray-500">Pending Approvals</p>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Awaiting review</p>
          </div>
        </div>

        {/* Missing Bills */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all duration-300 group">
          <div className="flex items-start justify-between">
            <div className="bg-rose-500 p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-rose-200">
              <AlertTriangle className="text-white" size={24} />
            </div>
          </div>
          <div className="mt-5 space-y-1">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">{stats.missingBills}</h3>
            <p className="text-sm font-bold text-gray-500">Missing Bills</p>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Without attachments</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Expense Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">Daily Expense (Last 7 Days)</h3>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Amount (₹)</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.daily} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar 
                  dataKey="amount" 
                  fill="#3b82f6" 
                  radius={[6, 6, 0, 0]} 
                  barSize={40}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense by Group Chart */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 flex flex-col">
          <h3 className="text-lg font-extrabold text-gray-900 tracking-tight mb-8">Expense by Group (Approved)</h3>
          <div className="flex-1 min-h-[300px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.groups}
                  cx="50%"
                  cy="45%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  animationDuration={1500}
                >
                  {chartData.groups.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend 
                  verticalAlign="bottom" 
                  iconType="circle"
                  formatter={(value) => <span className="text-[12px] font-bold text-gray-600 ml-1">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Expenses Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between bg-white">
          <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">Recent Expenses</h3>
          <Link 
            to="/expense-list" 
            className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 group"
          >
            View All <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Voucher</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Description</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentExpenses.length > 0 ? (
                recentExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-700 tracking-tight">{expense.sn}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-500">{expense.date}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900 line-clamp-1">{expense.remarks || 'No description'}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-base font-black text-gray-900">
                        {formatCurrency(expense.amount).replace('INR', '₹')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider ${
                          expense.status.toUpperCase() === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                          expense.status.toUpperCase() === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {expense.status}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Activity size={32} />
                      <p className="text-sm font-medium">No recent expenses found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
