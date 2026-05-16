import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, Wallet, Clock, TrendingUp, TrendingDown,
  ArrowUpDown, RefreshCcw, Download, Filter, ChevronRight, BarChart3, PieChart as PieIcon, LineChart as LineIcon, Search, FilterX, Home, HandCoins
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { 
  formatCurrency, 
  formatDate,
  formatDateForInput
} from '../utils/helpers';
import { useAuthStore } from '../store/authStore';

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [filters, setFilters] = useState({ from: '', to: '', group: '', expense: '', sub: '' });
  const [homeSubFilter, setHomeSubFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const fetchDashboardData = async () => {
    try {
      setFetching(true);
      const res = await fetch(APPSCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'read' }) });
      const json = await res.json();
      if (json.success) setRecords(json.data || []);
    } catch { toast.error('Network error'); } finally { setFetching(false); }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  const scopedRecords = useMemo(() => {
    const role = user?.role?.toUpperCase();
    const userId = user?.id || '';

    return records.filter(r => {
      // --- Role-based data scoping ---
      if (role === 'SUPER_ADMIN') return true;
      if (role === 'ADMIN') {
        return r['user'] === userId || r['Reported by'] === userId;
      }
      return r['user'] === userId;
    });
  }, [records, user]);

  const filteredRecords = useMemo(() => {
    return scopedRecords.filter(r => {
      const date = formatDateForInput(r.Date);
      const matchDateFrom = !filters.from || date >= filters.from;
      const matchDateTo = !filters.to || date <= filters.to;
      
      const matchGroup = !filters.group || r['Group Head'] === filters.group;
      const matchExpense = !filters.expense || r['Expense Head'] === filters.expense;
      const matchSub = !filters.sub || r['Sub Head'] === filters.sub;

      return matchDateFrom && matchDateTo && matchGroup && matchExpense && matchSub;
    });
  }, [scopedRecords, filters]);

  const groupHeads = useMemo(() => [...new Set(records.map(r => r['Group Head']).filter(Boolean))].sort(), [records]);
  const expenseHeads = useMemo(() => [...new Set(records.map(r => r['Expense Head']).filter(Boolean))].sort(), [records]);
  const subHeads = useMemo(() => [...new Set(records.map(r => r['Sub Head']).filter(Boolean))].sort(), [records]);

  const homeSubHeads = useMemo(() => {
    return [...new Set(
      records
        .filter(r => r['Expense Head'] === 'Cash at Home')
        .map(r => r['Sub Head'])
        .filter(Boolean)
    )].sort();
  }, [records]);

  const setPeriod = (months) => {
    const to = new Date().toISOString().split('T')[0];
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - months);
    const from = fromDate.toISOString().split('T')[0];
    setFilters({ ...filters, from, to });
  };

  const stats = useMemo(() => {
    // Only approved/active for income/expense/balance
    const activeApproved = filteredRecords.filter(r => r['Delete Status'] === 'ACTIVE' && r.Status === 'APPROVED');
    const totalIn = activeApproved.filter(r => r.Flow === 'IN').reduce((s, r) => s + (parseFloat(r['Amount (INR)']) || 0), 0);
    const totalOut = activeApproved.filter(r => r.Flow === 'OUT').reduce((s, r) => s + (parseFloat(r['Amount (INR)']) || 0), 0);
    const totalPending = filteredRecords.filter(r => r.Status === 'PENDING' && r['Delete Status'] === 'ACTIVE').reduce((s, r) => s + (parseFloat(r['Amount (INR)']) || 0), 0);
    const totalPendingDelete = filteredRecords.filter(r => r['Delete Status'] === 'PENDING_DELETE').reduce((s, r) => s + (parseFloat(r['Amount (INR)']) || 0), 0);

    const cashAtHomeSent = activeApproved
      .filter(r => r.Flow === 'OUT' && r['Expense Head'] === 'Cash at Home' && (!homeSubFilter || r['Sub Head'] === homeSubFilter))
      .reduce((s, r) => s + (parseFloat(r['Amount (INR)']) || 0), 0);
    const cashAtHomeReturned = activeApproved
      .filter(r => r.Flow === 'IN' && r['Expense Head'] === 'Cash at Home' && (!homeSubFilter || r['Sub Head'] === homeSubFilter))
      .reduce((s, r) => s + (parseFloat(r['Amount (INR)']) || 0), 0);
    const cashAtHome = cashAtHomeSent - cashAtHomeReturned;

    const cashApprovalCount = filteredRecords.filter(r => r.Flow === 'IN' && r.Status === 'PENDING' && r['Payment mode'] === 'Cash to Receive' && r['Delete Status'] === 'ACTIVE').length;
    const cashApprovalAmount = filteredRecords.filter(r => r.Flow === 'IN' && r.Status === 'PENDING' && r['Payment mode'] === 'Cash to Receive' && r['Delete Status'] === 'ACTIVE').reduce((s, r) => s + (parseFloat(r['Amount (INR)']) || 0), 0);

    // Cash to Receive Net (OUT - IN)
    const ctrOut = activeApproved.filter(r => r.Flow === 'OUT' && r['Payment mode'] === 'Cash to Receive').reduce((s, r) => s + (parseFloat(r['Amount (INR)']) || 0), 0);
    const ctrIn = activeApproved.filter(r => r.Flow === 'IN' && r['Payment mode'] === 'Cash to Receive').reduce((s, r) => s + (parseFloat(r['Amount (INR)']) || 0), 0);
    const ctrNet = ctrOut - ctrIn;

    return { 
      totalIn, totalOut, balance: totalIn - totalOut, totalPending, totalPendingDelete, 
      cashAtHome, cashAtHomeSent, cashAtHomeReturned,
      cashApprovalCount, cashApprovalAmount,
      ctrOut, ctrIn, ctrNet
    };
  }, [filteredRecords, homeSubFilter]);

  const cashAtHomeRecords = useMemo(() => {
    return filteredRecords
      .filter(r => r['Expense Head'] === 'Cash at Home' && r['Delete Status'] === 'ACTIVE' && r.Status === 'APPROVED' && (!homeSubFilter || r['Sub Head'] === homeSubFilter))
      .sort((a, b) => {
        const dateCmp = (b.Date || '').localeCompare(a.Date || '');
        if (dateCmp !== 0) return dateCmp;
        return (b.SN || '').localeCompare(a.SN || '');  // same date → latest SN (time) first
      })
      .slice(0, 10);
  }, [filteredRecords, homeSubFilter]);

  const cashToReceiveRecords = useMemo(() => {
    return filteredRecords
      .filter(r => r['Payment mode'] === 'Cash to Receive' && r['Delete Status'] === 'ACTIVE' && r.Status === 'APPROVED')
      .sort((a, b) => {
        const dateCmp = (b.Date || '').localeCompare(a.Date || '');
        if (dateCmp !== 0) return dateCmp;
        return (b.SN || '').localeCompare(a.SN || '');
      })
      .slice(0, 10);
  }, [filteredRecords]);

  // Chart Data Preparation
  const trendData = useMemo(() => {
    const dailyMap = {};
    filteredRecords.filter(r => r.Status === 'APPROVED' && r['Delete Status'] === 'ACTIVE').forEach(r => {
      const d = r.Date || 'N/A';
      if (!dailyMap[d]) dailyMap[d] = { date: d, income: 0, expense: 0 };
      if (r.Flow === 'IN') dailyMap[d].income += parseFloat(r['Amount (INR)']) || 0;
      else dailyMap[d].expense += parseFloat(r['Amount (INR)']) || 0;
    });
    return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)).slice(-15);
  }, [filteredRecords]);

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) { toast.error('No data to export'); return; }
    
    const headers = Object.keys(filteredRecords[0]);
    const csvContent = [
      headers.join(','),
      ...filteredRecords.map(row => headers.map(h => {
        let val = row[h] === undefined || row[h] === null ? '' : String(row[h]);
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Ace_Ledger_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const categoryData = useMemo(() => {
    const catMap = {};
    filteredRecords.filter(r => r.Flow === 'OUT' && r.Status === 'APPROVED').forEach(r => {
      const cat = r['Group Head'] || 'Other';
      catMap[cat] = (catMap[cat] || 0) + (parseFloat(r['Amount (INR)']) || 0);
    });
    return Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [filteredRecords]);

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (fetching) return (
    <div className="h-[60vh] flex flex-col items-center justify-center">
      <RefreshCcw size={32} className="text-blue-400 animate-spin mb-4" />
      <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Compiling Statistics...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-2">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500">Financial insights and performance analytics</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={handleExportCSV} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-[10px] sm:text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-sm">
            <Download size={14} /> Export
          </button>
          <button onClick={fetchDashboardData} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-[10px] sm:text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
            <RefreshCcw size={14} className={fetching ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden no-print">
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between px-4 py-3 sm:hidden bg-white text-[10px] font-bold uppercase text-slate-500 tracking-wider"
        >
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-blue-500" />
            {showFilters ? 'Hide Filters' : 'Show Data Filters'}
          </div>
          <ChevronRight size={16} className={`transition-transform duration-300 ${showFilters ? 'rotate-90' : ''}`} />
        </button>

        <div className={`${showFilters ? 'block' : 'hidden'} sm:block p-4 space-y-4`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[140px] flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase">From</span>
              <input type="date" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} className="text-xs font-bold text-slate-700 bg-transparent border-none outline-none p-0 w-full focus:ring-0" />
            </div>
            <div className="flex-1 min-w-[140px] flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase">To</span>
              <input type="date" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} className="text-xs font-bold text-slate-700 bg-transparent border-none outline-none p-0 w-full focus:ring-0" />
            </div>
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              {[1, 2, 3].map(m => (
                <button key={m} onClick={() => setPeriod(m)} className="flex-1 sm:flex-none px-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm">
                  {m}M
                </button>
              ))}
              {(filters.from || filters.to || filters.group || filters.expense || filters.sub) && (
                <button 
                  onClick={() => setFilters({ from: '', to: '', group: '', expense: '', sub: '' })} 
                  className="p-2 text-rose-500 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
                  title="Reset"
                >
                  <FilterX size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={filters.group} onChange={e => setFilters({...filters, group: e.target.value, expense: '', sub: ''})} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10">
              <option value="">All Group Heads</option>
              {groupHeads.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={filters.expense} onChange={e => setFilters({...filters, expense: e.target.value, sub: ''})} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10">
              <option value="">All Expense Heads</option>
              {expenseHeads.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <select value={filters.sub} onChange={e => setFilters({...filters, sub: e.target.value})} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10">
              <option value="">All Sub Heads</option>
              {subHeads.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group min-h-[120px] flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingUp size={48}/></div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Income</p>
          <p className="text-lg font-bold text-emerald-600">+{formatCurrency(stats.totalIn)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group min-h-[120px] flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingDown size={48}/></div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Expense</p>
          <p className="text-lg font-bold text-rose-600">-{formatCurrency(stats.totalOut)}</p>
        </div>
        <div className="bg-slate-900 p-6 rounded-xl shadow-lg relative overflow-hidden group border border-slate-800 min-h-[120px] flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-white"><Wallet size={48}/></div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Net Balance</p>
          <p className="text-lg font-bold text-white">{formatCurrency(stats.balance)}</p>
        </div>
        <div className="bg-amber-50 p-6 rounded-xl border border-amber-100 shadow-sm relative overflow-hidden group min-h-[120px] flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-amber-500"><Clock size={48}/></div>
          <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mb-1">Unapproved Expense</p>
          <p className="text-lg font-bold text-amber-700">{formatCurrency(stats.totalPending)}</p>
        </div>
        <div className="bg-rose-50 p-6 rounded-xl border border-rose-100 shadow-sm relative overflow-hidden group min-h-[120px] flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-rose-500"><ArrowUpDown size={48}/></div>
          <p className="text-[9px] font-bold text-rose-600 uppercase tracking-widest mb-1">Pending Del.</p>
          <p className="text-lg font-bold text-rose-700">{stats.totalPendingDelete}</p>
        </div>
        <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100 shadow-sm relative overflow-hidden group min-h-[120px] flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-emerald-500"><TrendingUp size={48}/></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Cash to Approval</p>
              <p className="text-lg font-bold text-emerald-700">{formatCurrency(stats.cashApprovalAmount)}</p>
            </div>
            <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm">
              {stats.cashApprovalCount} PENDING
            </span>
          </div>
        </div>
        <div className="bg-indigo-50 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden group lg:col-span-3">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-indigo-500"><HandCoins size={48}/></div>
          <div className="relative z-10 p-6 flex flex-col justify-center">
            <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Cash to Receive (Net)</p>
            <p className="text-2xl font-black text-indigo-700 mb-3">{formatCurrency(stats.ctrNet)}</p>
            
            <div className="flex gap-6 border-t border-indigo-100 pt-3 w-full justify-start">
              <div className="text-left">
                <p className="text-[8px] font-black text-slate-400 uppercase">Total Out</p>
                <p className="text-xs font-bold text-slate-600">{formatCurrency(stats.ctrOut)}</p>
              </div>
              <div className="text-left border-l border-indigo-100 pl-6">
                <p className="text-[8px] font-black text-slate-400 uppercase">Total In</p>
                <p className="text-xs font-bold text-slate-600">{formatCurrency(stats.ctrIn)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cash at Home Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home size={14} className="text-slate-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Cash at Home</span>
          </div>
          <select 
            value={homeSubFilter} 
            onChange={e => setHomeSubFilter(e.target.value)}
            className="text-[9px] font-bold text-slate-500 bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/10 min-w-[120px]"
          >
            <option value="">All Sub Heads</option>
            {homeSubHeads.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5">

          {/* Left: Balance Summary */}
          <div className="sm:col-span-2 p-6 border-b sm:border-b-0 sm:border-r border-slate-100 flex flex-col justify-between gap-4">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Balance</p>
              <p className={`text-3xl font-black tracking-tight ${stats.cashAtHome > 0 ? 'text-slate-900' : 'text-emerald-600'}`}>
                {formatCurrency(stats.cashAtHome)}
              </p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">
                {stats.cashAtHome > 0 ? 'Outstanding — not yet returned' : '✓ Fully reconciled'}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  <span className="text-[10px] font-bold text-slate-500">Dispatched</span>
                </div>
                <span className="text-xs font-black text-slate-700">{formatCurrency(stats.cashAtHomeSent ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="text-[10px] font-bold text-slate-500">Returned</span>
                </div>
                <span className="text-xs font-black text-slate-700">{formatCurrency(stats.cashAtHomeReturned ?? 0)}</span>
              </div>
            </div>
          </div>

          {/* Right: Recent Entries */}
          <div className="sm:col-span-3 p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-2 mb-2">Recent Entries</p>
            {cashAtHomeRecords.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-slate-300">
                <p className="text-[10px] font-bold uppercase">No entries found</p>
              </div>
            ) : (
              <div className="space-y-0.5 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                {cashAtHomeRecords.map((r, i) => {
                  const isIN = r.Flow === 'IN';
                  return (
                    <div key={i} className="flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isIN ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                          {isIN
                            ? <TrendingUp size={10} className="text-emerald-500" />
                            : <TrendingDown size={10} className="text-rose-500" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{r['Sub Head'] || r['Description / Reason'] || r['Paid To'] || '—'}</p>
                          <p className="text-[9px] font-bold text-slate-400">{formatDate(r.Date)} · {r['user']}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-black shrink-0 ml-3 ${isIN ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isIN ? '+' : '-'}{formatCurrency(r['Amount (INR)'])}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Graphs Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <LineIcon size={16} className="text-blue-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Flow Analysis (Last 15 Records)</h3>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Income</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Expense</div>
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" fontSize={10} tickFormatter={v => v.split('-').slice(1).join('/')} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIn)" />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorOut)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <PieIcon size={16} className="text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top Expense Distributions</h3>
          </div>
          <div className="h-[250px] w-full flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingLeft: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-slate-400" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recent Activity</h3>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-slate-400 border-b border-slate-100 uppercase text-[9px] tracking-widest font-bold">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Categorization / Memo</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-center">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[...filteredRecords].sort((a, b) => {
                const dateCmp = (b.Date || '').localeCompare(a.Date || '');
                return dateCmp !== 0 ? dateCmp : (b.SN || '').localeCompare(a.SN || '');
              }).slice(0, 8).map((r, idx) => {
                const isIN = r.Flow === 'IN';
                return (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 font-bold text-[11px]">{formatDate(r.Date)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${isIN ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {r.Flow}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-xs">{r['Group Head'] || 'General Inflow'}</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[250px]">{r['Description / Reason']}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-black text-xs ${isIN ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isIN ? '+' : '-'}{formatCurrency(r['Amount (INR)'])}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                        r.Status === 'APPROVED' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                        r.Status === 'REJECTED' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                        'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        {r.Status || 'PENDING'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden divide-y divide-slate-100">
          {[...filteredRecords].sort((a, b) => {
            const dateCmp = (b.Date || '').localeCompare(a.Date || '');
            return dateCmp !== 0 ? dateCmp : (b.SN || '').localeCompare(a.SN || '');
          }).slice(0, 5).map((r, idx) => {
            const isIN = r.Flow === 'IN';
            return (
              <div key={idx} className="p-4 space-y-3 active:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{formatDate(r.Date)}</p>
                    <p className="font-bold text-slate-900 text-sm">{r['Group Head'] || 'General'}</p>
                    <p className="text-xs text-slate-500 line-clamp-1">{r['Description / Reason']}</p>
                  </div>
                  <div className="text-right space-y-2">
                    <p className={`font-black text-sm ${isIN ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isIN ? '+' : '-'}{formatCurrency(r['Amount (INR)'])}
                    </p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${
                      r.Status === 'APPROVED' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                      r.Status === 'REJECTED' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                      'bg-slate-50 border-slate-200 text-slate-400'
                    }`}>
                      {r.Status || 'PENDING'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
