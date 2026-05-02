import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Calendar, Wallet, Clock, AlertTriangle, TrendingUp, 
  ChevronRight, Activity, Loader2, X, Download
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
  
  // Dashboard Filters
  const [dateRange, setDateRange] = useState({ from: '', to: getTodayDate() });
  const [reportType, setReportType] = useState('All Expenses');

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
  // Filtered datasets based on selected date range and report type
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchDateFrom = !dateRange.from || e.date >= dateRange.from;
      const matchDateTo = !dateRange.to || e.date <= dateRange.to;
      const matchType = reportType === 'All Expenses' || e.status.toUpperCase() === reportType.toUpperCase();
      return matchDateFrom && matchDateTo && matchType;
    });
  }, [expenses, dateRange, reportType]);

  // CSV Export Functionality
  const exportCSV = () => {
    if (filteredExpenses.length === 0) {
      toast.error('No data to export');
      return;
    }
    const headers = ['VOUCHER', 'DATE', 'CATEGORY', 'DESCRIPTION', 'AMOUNT', 'STATUS'];
    const rows = filteredExpenses.map(e => [
      e.sn,
      e.date,
      `"${e.groupHead}"`,
      `"${e.remarks ? String(e.remarks).replace(/"/g, '""') : ''}"`,
      e.amount,
      e.status
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PettyCash_Report_${dateRange.from || 'Start'}_to_${dateRange.to || 'End'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Report Exported!');
  };
  const stats = useMemo(() => {
    const today = getTodayDate();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Today's Expense (From Filtered List)
    // If 'All Expenses' is selected, we focus on APPROVED items for primary metrics.
    // Otherwise, we show the totals for the selected status filter.
    const todaysSelection = reportType === 'All Expenses'
      ? filteredExpenses.filter(e => e.date === today && e.status.toUpperCase() === 'APPROVED')
      : filteredExpenses.filter(e => e.date === today);
    
    const todaysExpense = todaysSelection.reduce((sum, e) => sum + e.amount, 0);
    const todaysEntries = todaysSelection.length;

    // Month's Expense (From Filtered List)
    const monthsSelection = reportType === 'All Expenses'
      ? filteredExpenses.filter(e => {
          if (!e.date || e.date === '-') return false;
          const d = new Date(e.date);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear && e.status.toUpperCase() === 'APPROVED';
        })
      : filteredExpenses.filter(e => {
          if (!e.date || e.date === '-') return false;
          const d = new Date(e.date);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

    const monthsExpense = monthsSelection.reduce((sum, e) => sum + e.amount, 0);
    const monthsEntries = monthsSelection.length;

    // Cash in Hand (From Petty Cash Ledger) - Independent of expense status filters
    const totalReceived = pettyCash
      .filter(t => t.type === 'Cash Received' || t.type === 'Cash Returned')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalSpent = pettyCash
      .filter(t => t.type === 'Expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const cashInHand = totalReceived - totalSpent;

    // Pending Approvals (Relative to filter)
    const pendingApprovals = filteredExpenses.filter(e => e.status.toUpperCase() === 'PENDING').length;

    // Missing Bills (Relative to filter)
    const missingBills = filteredExpenses.filter(e => e.status.toUpperCase() === 'APPROVED' && !e.billUrl).length;

    return {
      todaysExpense,
      todaysEntries,
      monthsExpense,
      monthsEntries,
      cashInHand,
      pendingApprovals,
      missingBills
    };
  }, [filteredExpenses, pettyCash, reportType]);

  const chartData = useMemo(() => {
    // Daily Expense (Last 7 Days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
      
      const daySelection = reportType === 'All Expenses'
        ? filteredExpenses.filter(e => e.date === dateStr && e.status.toUpperCase() === 'APPROVED')
        : filteredExpenses.filter(e => e.date === dateStr);

      const dayAmount = daySelection.reduce((sum, e) => sum + e.amount, 0);
      
      last7Days.push({ name: dayName, amount: dayAmount });
    }

    // Expense by Group
    const groupMap = {};
    const groupSelection = reportType === 'All Expenses'
      ? filteredExpenses.filter(e => e.status.toUpperCase() === 'APPROVED')
      : filteredExpenses;

    groupSelection.forEach(e => {
        const group = e.groupHead || 'Other';
        groupMap[group] = (groupMap[group] || 0) + e.amount;
      });
    
    const groupData = Object.entries(groupMap).map(([name, value]) => ({ name, value }));

    return { daily: last7Days, groups: groupData };
  }, [filteredExpenses, reportType]);

  const recentExpenses = useMemo(() => {
    return [...filteredExpenses]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  }, [filteredExpenses]);

  if (fetching) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 size={40} className="text-indigo-600 animate-spin" />
        <p className="text-gray-500 font-medium animate-pulse">Syncing with Google Sheets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-10  p-2 md:p-0">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="">
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 font-semibold text-[10px]   px-3.5 py-1.5 rounded-full mb-3 shadow-sm">
            <Activity size={12} className="animate-pulse" />
            <span>Real-time Analytics</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold text-slate-900  leading-none mb-2">Dashboard</h1>
          <p className="text-slate-500 font-medium">
            Welcome, <span className="text-indigo-600 font-semibold">{user?.name || 'Administrator'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1 ">
          <button
            onClick={exportCSV}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2.5 bg-white border border-slate-200 text-slate-700 px-4 md:px-5 py-3 rounded-2xl text-sm font-semibold shadow-sm hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-all duration-300 active:scale-95 group whitespace-nowrap"
          >
            <Download size={18} className="group-hover:translate-y-0.5 transition-transform duration-300 text-emerald-600" />
            <span className="hidden sm:inline">Export Data</span>
            <span className="sm:hidden">Export</span>
          </button>
          <button
            onClick={fetchDashboardData}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2.5 bg-slate-900 text-white px-4 md:px-5 py-3 rounded-2xl text-sm font-semibold shadow-sm shadow-sm hover:bg-slate-800 transition-all duration-300 active:scale-95 group whitespace-nowrap"
          >
            <Activity size={18} className={`${fetching ? 'animate-spin' : 'group-hover:animate-pulse'} text-indigo-400`} />
            <span className="hidden sm:inline">Sync System</span>
            <span className="sm:hidden">Sync</span>
          </button>
        </div>
      </div>

      {/* Industrial Grade Filter Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-500 hover:shadow-sm ">
        <div className="px-5 py-5 md:px-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6 md:gap-8">
            
            {/* Status Segmented Selection */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-semibold text-slate-400   ml-1">View Focus</span>
              <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/30">
                {['All Expenses', 'Approved', 'Pending', 'Hold', 'Rejected'].map((opt) => {
                  const isActive = reportType === opt;
                  const colorMap = {
                    'Approved':   'bg-emerald-500 text-white shadow-sm',
                    'Pending':    'bg-amber-500  text-white shadow-sm',
                    'Hold':       'bg-sky-500    text-white shadow-sm',
                    'Rejected':   'bg-rose-500   text-white shadow-sm',
                    'All Expenses':'bg-indigo-600 text-white shadow-sm',
                  };
                  return (
                    <button
                      key={opt}
                      onClick={() => setReportType(opt)}
                      className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-[14px] text-[10px] md:text-[11px] font-semibold  transition-all duration-300  whitespace-nowrap ${
                        isActive
                          ? `${colorMap[opt]} shadow-sm scale-105`
                          : 'text-slate-500 hover:text-slate-900 hover:bg-white/80'
                      }`}
                    >
                      {opt === 'All Expenses' ? 'All' : opt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="hidden lg:block w-px h-12 bg-slate-100" />

            {/* High-Precision Timeline Cluster */}
            <div className="flex flex-col gap-3 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400   ml-1">Time Horizon</span>
                {(reportType !== 'All Expenses' || dateRange.from || dateRange.to) && (
                  <button 
                    onClick={() => { setReportType('All Expenses'); setDateRange({ from: '', to: getTodayDate() }); }}
                    className="text-[10px] font-semibold text-rose-500   hover:text-rose-700 transition-colors flex items-center gap-1.5"
                  >
                    <X size={12} strokeWidth={3} /> Clear
                  </button>
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 md:gap-3">
                <div className="w-full sm:flex-1 flex items-center gap-3 bg-slate-50/80 hover:bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl px-4 py-2 transition-all duration-300 group cursor-pointer shadow-sm">
                  <Calendar size={14} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[8px] font-semibold text-slate-400  leading-none mb-1">Start Date</span>
                    <input
                      type="date"
                      value={dateRange.from}
                      onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                      className="text-[12px] font-semibold text-slate-800 bg-transparent border-none p-0 focus:ring-0 cursor-pointer w-full"
                    />
                  </div>
                </div>

                <div className="hidden sm:block text-slate-300 font-semibold">→</div>

                <div className="w-full sm:flex-1 flex items-center gap-3 bg-slate-50/80 hover:bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl px-4 py-2 transition-all duration-300 group cursor-pointer shadow-sm">
                  <Calendar size={14} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[8px] font-semibold text-slate-400  leading-none mb-1">End Date</span>
                    <input
                      type="date"
                      value={dateRange.to}
                      onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                      className="text-[12px] font-semibold text-slate-800 bg-transparent border-none p-0 focus:ring-0 cursor-pointer w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-5">
        {/* Today's Expense */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 hover:shadow-md transition-all duration-300 group">
          <div className="flex items-start justify-between mb-3 md:mb-5">
            <div className="bg-blue-500 p-2 md:p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm shadow-sm">
              <Calendar className="text-white" size={20} />
            </div>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-lg md:text-2xl font-semibold text-gray-900 ">
              {formatCurrency(stats.todaysExpense).replace('INR', '₹')}
            </h3>
            <p className="text-[10px] md:text-sm font-semibold text-gray-500">Today</p>
            <p className="text-[9px] md:text-[11px] font-medium text-gray-400  ">{stats.todaysEntries} entries</p>
          </div>
        </div>

        {/* Month's Expense */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 hover:shadow-md transition-all duration-300 group">
          <div className="flex items-start justify-between mb-3 md:mb-5">
            <div className="bg-indigo-500 p-2 md:p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm shadow-sm">
              <TrendingUp className="text-white" size={20} />
            </div>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-lg md:text-2xl font-semibold text-gray-900 ">
              {formatCurrency(stats.monthsExpense).replace('INR', '₹')}
            </h3>
            <p className="text-[10px] md:text-sm font-semibold text-gray-500">Month</p>
            <p className="text-[9px] md:text-[11px] font-medium text-gray-400  ">{stats.monthsEntries} entries</p>
          </div>
        </div>

        {/* Cash in Hand */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 hover:shadow-md transition-all duration-300 group">
          <div className="flex items-start justify-between mb-3 md:mb-5">
            <div className="bg-emerald-500 p-2 md:p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm shadow-sm">
              <Wallet className="text-white" size={20} />
            </div>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-lg md:text-2xl font-semibold text-gray-900 ">
              {formatCurrency(stats.cashInHand).replace('INR', '₹')}
            </h3>
            <p className="text-[10px] md:text-sm font-semibold text-gray-500">Cash in Hand</p>
            <p className="text-[9px] md:text-[11px] font-medium text-gray-400   line-clamp-1 text-gray-400">Ledger balance</p>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 hover:shadow-md transition-all duration-300 group">
          <div className="flex items-start justify-between mb-3 md:mb-5">
            <div className="bg-amber-500 p-2 md:p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm shadow-sm">
              <Clock className="text-white" size={20} />
            </div>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-lg md:text-2xl font-semibold text-gray-900 ">{stats.pendingApprovals}</h3>
            <p className="text-[10px] md:text-sm font-semibold text-gray-500">Pending</p>
            <p className="text-[9px] md:text-[11px] font-medium text-gray-400   line-clamp-1 text-gray-400">Review required</p>
          </div>
        </div>

        {/* Missing Bills */}
        <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 hover:shadow-md transition-all duration-300 group">
          <div className="flex items-start justify-between mb-3 md:mb-5">
            <div className="bg-rose-500 p-2 md:p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm shadow-sm">
              <AlertTriangle className="text-white" size={20} />
            </div>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-lg md:text-2xl font-semibold text-gray-900 ">{stats.missingBills}</h3>
            <p className="text-[10px] md:text-sm font-semibold text-gray-500">Bills Missing</p>
            <p className="text-[9px] md:text-[11px] font-medium text-gray-400   line-clamp-1 text-gray-400">No attachments</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Expense Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <h3 className="text-lg font-semibold text-gray-900 ">Daily Trends (Last 7 Days)</h3>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span className="text-[10px] font-semibold text-gray-500  ">Approved (₹)</span>
            </div>
          </div>
          <div className="h-[250px] md:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.daily} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar 
                  dataKey="amount" 
                  fill="#3b82f6" 
                  radius={[6, 6, 0, 0]} 
                  barSize={window.innerWidth < 640 ? 20 : 40}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense by Group Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900  mb-8">Group Distribution</h3>
          <div className="flex-1 min-h-[250px] md:min-h-[300px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.groups}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={85}
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
                  formatter={(value) => <span className="text-[10px] font-semibold text-gray-600 ml-1 ">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Expenses Table / Mobile Card List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between bg-white">
          <h3 className="text-lg font-semibold text-gray-900 ">Recent Activity</h3>
          <Link 
            to="/expense-list" 
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 group"
          >
            View All <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Mobile-Friendly List (Hidden on desktop) */}
        <div className="md:hidden flex flex-col divide-y divide-gray-50">
          {recentExpenses.length > 0 ? (
            recentExpenses.map((expense) => (
              <div key={expense.id} className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-semibold border border-indigo-100  ">{expense.sn}</span>
                    <h4 className="text-sm font-semibold text-gray-900 line-clamp-1 mt-1.5">{expense.remarks || 'No description'}</h4>
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-semibold   ${
                    expense.status.toUpperCase() === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                    expense.status.toUpperCase() === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {expense.status}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                   <span className="text-gray-500 font-medium">{expense.date}</span>
                   <span className="text-base font-semibold text-slate-900">{formatCurrency(expense.amount).replace('INR', '₹')}</span>
                </div>
              </div>
            ))
          ) : (
             <div className="p-8 text-center text-gray-400 text-sm font-medium italic">No recent expenses</div>
          )}
        </div>

        {/* Desktop Table (Hidden on mobile) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[11px] font-semibold text-gray-400  ">Voucher</th>
                <th className="px-6 py-4 text-[11px] font-semibold text-gray-400  ">Date</th>
                <th className="px-6 py-4 text-[11px] font-semibold text-gray-400  ">Description</th>
                <th className="px-6 py-4 text-[11px] font-semibold text-gray-400   text-right">Amount</th>
                <th className="px-6 py-4 text-[11px] font-semibold text-gray-400   text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentExpenses.length > 0 ? (
                recentExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-[12px] font-semibold border border-indigo-100 shadow-sm">{expense.sn}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-500">{expense.date}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900 line-clamp-1">{expense.remarks || 'No description'}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-base font-semibold text-gray-900">
                        {formatCurrency(expense.amount).replace('INR', '₹')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span className={`px-3 py-1 rounded-lg text-[11px] font-semibold   ${
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
