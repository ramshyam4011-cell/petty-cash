import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Download, Calendar } from 'lucide-react';
import { formatCurrency, formatDateForInput } from '../utils/helpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;

export default function Report() {
  const [expenses, setExpenses] = useState([]);
  const [fetching, setFetching] = useState(true);

  // Filters
  const [filters, setFilters] = useState({
    reportType: 'All Expenses',
    fromDate: '',
    toDate: ''
  });

  const fetchExpenses = async () => {
    try {
      setFetching(true);
      const res = await fetch(APPSCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'read' })
      });
      const json = await res.json();
      if (json.success) {
        const mapped = (json.data || []).map((e, idx) => {
          const d = {};
          Object.keys(e).forEach(k => { d[k.trim()] = e[k]; });
          return {
            id: d.SN || `exp-${idx}`,
            sn: d.SN,
            date: d.Date ? formatDateForInput(d.Date) : '-',
            paymentMode: d['Payment mode'],
            groupHead: d['Group Head'],
            expenseHead: d['Expense Head'],
            subHead: d['Sub Head'],
            amount: parseFloat(d['Amount (INR)']) || 0,
            remarks: d['Description / Reason'],
            user: d.user || d.User,
            status: (d.Status || 'Pending').trim(),
          };
        });
        setExpenses(mapped.reverse()); // Show newest first
      } else {
        toast.error('Failed to load expenses');
      }
    } catch (err) {
      toast.error('Network error while loading expenses');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  // Filter Logic
  const filteredExpenses = expenses.filter(e => {
    if (filters.reportType !== 'All Expenses') {
      const type = filters.reportType.toUpperCase();
      if (e.status.toUpperCase() !== type) return false;
    }
    if (filters.fromDate && e.date < filters.fromDate) return false;
    if (filters.toDate && e.date > filters.toDate) return false;
    return true;
  });

  // Metrics Calculation
  const totalEntries = filteredExpenses.length;
  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const approvedAmount = filteredExpenses
    .filter(e => e.status.toUpperCase() === 'APPROVED')
    .reduce((sum, e) => sum + e.amount, 0);
  const pendingCount = filteredExpenses
    .filter(e => e.status.toUpperCase() === 'PENDING')
    .length;

  // Chart Data Preparation
  const groupWiseData = {};
  filteredExpenses.forEach(e => {
    const group = e.groupHead || 'Other';
    if (!groupWiseData[group]) {
      groupWiseData[group] = 0;
    }
    groupWiseData[group] += e.amount;
  });

  const chartData = Object.keys(groupWiseData).map(key => ({
    name: key,
    amount: groupWiseData[key]
  })).sort((a, b) => b.amount - a.amount); // Sort descending by amount

  // CSV Export
  const exportCSV = () => {
    if (filteredExpenses.length === 0) {
      toast.error('No data to export');
      return;
    }
    const headers = ['VOUCHER', 'DATE', 'CATEGORY', 'DESCRIPTION', 'AMOUNT', 'MODE', 'STATUS', 'BY'];
    const rows = filteredExpenses.map(e => [
      e.sn,
      e.date,
      `"${e.groupHead} - ${e.subHead || e.expenseHead}"`,
      `"${e.remarks ? String(e.remarks).replace(/"/g, '""') : ''}"`,
      e.amount,
      e.paymentMode || 'Cash',
      e.status,
      e.user || 'Admin'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Expense_Report_${filters.fromDate || 'All'}_to_${filters.toDate || 'All'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusPill = (status) => {
    const s = status.toLowerCase();
    if (s === 'approved') return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[11px] font-medium tracking-wide">Approved</span>;
    if (s === 'rejected') return <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-[11px] font-medium tracking-wide">Rejected</span>;
    if (s === 'hold') return <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-[11px] font-medium tracking-wide">Hold</span>;
    return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[11px] font-medium tracking-wide">Pending</span>; // Default
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reports</h1>
          <p className="text-gray-500 text-sm mt-0.5">Analyze and export expense data</p>
        </div>
        <button 
          onClick={exportCSV}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition shadow-sm whitespace-nowrap text-sm"
        >
          <Download size={16} strokeWidth={2.5} /> Export CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center shadow-sm">
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-gray-500 mb-1">Report Type</label>
          <select 
            value={filters.reportType}
            onChange={(e) => setFilters({...filters, reportType: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
          >
            <option value="All Expenses">All Expenses</option>
            <option value="Approved">Approved</option>
            <option value="Pending">Pending</option>
            <option value="Hold">Hold</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
          <div className="relative">
            <input 
              type="date" 
              value={filters.fromDate}
              onChange={(e) => setFilters({...filters, fromDate: e.target.value})}
              className="w-full border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 appearance-none"
            />
            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>
        </div>

        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
          <div className="relative">
            <input 
              type="date" 
              value={filters.toDate}
              onChange={(e) => setFilters({...filters, toDate: e.target.value})}
              className="w-full border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 appearance-none"
            />
            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900">{totalEntries}</h2>
          <p className="text-sm font-medium text-gray-500 mt-1">Total Entries</p>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900">{formatCurrency(totalAmount)}</h2>
          <p className="text-sm font-medium text-gray-500 mt-1">Total Amount</p>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900">{formatCurrency(approvedAmount)}</h2>
          <p className="text-sm font-medium text-gray-500 mt-1">Approved Amount</p>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900">{pendingCount}</h2>
          <p className="text-sm font-medium text-gray-500 mt-1">Pending Count</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Group-wise Spending</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={(value) => value} 
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value) => [`₹${value}`, 'Amount']}
              />
              <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50">
          <h3 className="text-sm font-bold text-gray-700">{totalEntries} records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Voucher</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Mode</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fetching ? (
                <tr>
                  <td colSpan="8" className="px-5 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-500 mt-3 text-sm">Loading data...</p>
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-5 py-12 text-center text-gray-500 text-sm">
                    No entries found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50/50 transition-colors group">
                    {/* VOUCHER */}
                    <td className="px-5 py-4">
                      <span className="text-[13px] font-mono text-gray-500">{expense.sn}</span>
                    </td>
                    
                    {/* DATE */}
                    <td className="px-5 py-4">
                      <span className="text-[13px] text-gray-600">{expense.date}</span>
                    </td>
                    
                    {/* CATEGORY */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold text-gray-900">{expense.groupHead}</span>
                        <span className="text-[12px] text-gray-400">{expense.subHead || expense.expenseHead}</span>
                      </div>
                    </td>
                    
                    {/* DESCRIPTION */}
                    <td className="px-5 py-4 max-w-[200px]">
                      <span className="text-[13px] font-medium text-gray-900 line-clamp-2" title={expense.remarks}>{expense.remarks || '-'}</span>
                    </td>
                    
                    {/* AMOUNT */}
                    <td className="px-5 py-4 text-right">
                      <span className="text-[14px] font-bold text-gray-900">{formatCurrency(expense.amount)}</span>
                    </td>
                    
                    {/* MODE */}
                    <td className="px-5 py-4 text-center">
                      <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-[11px] font-medium border border-gray-200 uppercase tracking-wide">
                        {expense.paymentMode || 'Cash'}
                      </span>
                    </td>
                    
                    {/* STATUS */}
                    <td className="px-5 py-4 text-center">
                      {getStatusPill(expense.status)}
                    </td>
                    
                    {/* BY */}
                    <td className="px-5 py-4">
                      <span className="text-[13px] text-gray-500">{expense.user || 'Admin'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
