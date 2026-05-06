import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, Wallet, ArrowUpRight, ArrowDownRight, RotateCcw,
  Calendar, Printer, Filter, Search, X, ArrowUpDown, ChevronUp,
  ChevronDown, FileUp, Paperclip, Minus, FileText, Image
} from 'lucide-react';
import { formatCurrency, formatDate, getTodayDate, fileToBase64 } from '../utils/helpers';

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const UPLOAD_FOLDER_ID = import.meta.env.VITE_PETTY_CASH_UPLOAD;

export default function PettyCash() {
  const [transactions, setTransactions] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const createDefaultEntry = () => ({
    date: getTodayDate(),
    type: 'Cash Received',
    amount: '',
    description: '',
    attachments: []
  });

  const [formEntries, setFormEntries] = useState([createDefaultEntry()]);

  // Filters & Sorting
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    type: '',
    searchQuery: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });

  const fetchTransactions = async () => {
    try {
      setFetching(true);
      const res = await fetch(APPSCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'readPettyCash' })
      });
      const json = await res.json();

      if (json.success) {
        const mapped = (json.data || []).map((t, idx) => {
          // Trim all keys & values
          const d = {};
          Object.keys(t).forEach(k => { d[k.trim()] = t[k] ? String(t[k]).trim() : ''; });

          // Collect document links from any column whose name contains 'upload' or 'doc' (case insensitive)
          const docLinks = [];
          Object.keys(d).forEach(key => {
            const lowerKey = key.toLowerCase();
            if ((lowerKey.includes('upload') || lowerKey.includes('doc')) && d[key] !== '') {
              docLinks.push(d[key]);
            }
          });

          return {
            id: d.Timestamp || `pt-${idx}`,
            date: d.Date || '-',
            type: d.Type || '-',
            amount: parseFloat(d.Amount) || 0,
            description: d.Description || '-',
            attachments: docLinks.join(','),
            timestamp: d.Timestamp
          };
        });
        setTransactions(mapped);
      } else {
        toast.error('Failed to load transactions');
      }
    } catch (err) {
      toast.error('Network error while loading transactions');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const requestSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Calculations
  const totalReceived = transactions
    .filter(t => t.type === 'Cash Received')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const cashReturned = transactions
    .filter(t => t.type === 'Cash Returned')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const totalExpense = transactions
    .filter(t => t.type === 'Expense')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const currentBalance = totalReceived + cashReturned - totalExpense;

  // Process transactions: filters → running balance → sort
  const displayTransactions = useMemo(() => {
    const filtered = transactions.filter(t => {
      if (filters.fromDate && t.date < filters.fromDate) return false;
      if (filters.toDate && t.date > filters.toDate) return false;
      if (filters.type && t.type !== filters.type) return false;
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        return (
          t.description.toLowerCase().includes(q) ||
          t.type.toLowerCase().includes(q) ||
          String(t.amount).includes(q)
        );
      }
      return true;
    });

    const chronological = [...filtered].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
    });

    let bal = 0;
    const withBal = chronological.map(t => {
      const amt = parseFloat(t.amount || 0);
      if (t.type === 'Cash Received' || t.type === 'Cash Returned') {
        bal += amt;
      } else {
        bal -= amt;
      }
      return { ...t, balance: bal };
    });

    if (!sortConfig.key) return withBal;

    return [...withBal].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (sortConfig.key === 'date') {
        const aDate = new Date(a.date), bDate = new Date(b.date);
        return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
      }
      if (sortConfig.key === 'amount' || sortConfig.key === 'balance') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      aVal = String(aVal || '').toLowerCase();
      bVal = String(bVal || '').toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [transactions, filters, sortConfig]);

  // Print Functionality
  const handlePrint = () => {
    if (displayTransactions.length === 0) {
      toast.error('No data to print');
      return;
    }
    window.print();
  };

  // Form handlers
  const addFormEntry = () => setFormEntries([...formEntries, createDefaultEntry()]);
  const removeFormEntry = (index) => {
    if (formEntries.length > 1) {
      const newEntries = [...formEntries];
      newEntries.splice(index, 1);
      setFormEntries(newEntries);
    }
  };
  const updateEntry = (index, field, value) => {
    const newEntries = [...formEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setFormEntries(newEntries);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const invalid = formEntries.some(e => !e.amount || parseFloat(e.amount) <= 0 || !e.description.trim());
    if (invalid) {
      toast.error('Please fill in all required fields for all forms');
      return;
    }

    try {
      toast.loading('Processing batch submission...', { id: 'save-toast' });
      const results = await Promise.all(formEntries.map(async (entry) => {
        const base64Files = await Promise.all(
          entry.attachments.map(async (file) => {
            const base64 = await fileToBase64(file);
            return { name: file.name, type: file.type, data: base64 };
          })
        );

        const res = await fetch(APPSCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'createPettyCash',
            data: {
              Date: entry.date,
              Type: entry.type,
              Amount: parseFloat(entry.amount),
              Description: entry.description.trim(),
              Attachments: base64Files,
              FolderId: UPLOAD_FOLDER_ID
            }
          })
        });
        return await res.json();
      }));

      const allSuccess = results.every(r => r.success);
      if (allSuccess) {
        toast.success(`${formEntries.length} transactions saved successfully!`, { id: 'save-toast' });
        fetchTransactions();
        setFormEntries([createDefaultEntry()]);
        setShowForm(false);
      } else {
        toast.error('Some transactions failed to save', { id: 'save-toast' });
      }
    } catch (err) {
      toast.error('Network error during batch submission', { id: 'save-toast' });
    }
  };

  const handleDelete = async (timestamp) => {
    if (!timestamp || String(timestamp).includes('pt-')) {
      toast.error('Cannot delete this entry: Missing original record reference');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    try {
      toast.loading('Deleting transaction...', { id: 'delete-toast' });
      const res = await fetch(APPSCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'deletePettyCash',
          timestamp: timestamp
        })
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Transaction deleted', { id: 'delete-toast' });
        fetchTransactions();
      } else {
        toast.error('Failed to delete: ' + (json.error || 'Unknown error'), { id: 'delete-toast' });
      }
    } catch (err) {
      toast.error('Network error during deletion', { id: 'delete-toast' });
    }
  };

  return (
    <div className="p-0 md:p-8 space-y-8 md:space-y-12 print-container">
      {/* Print Only Header */}
      <div className="hidden print-title">
        Petty Cash Ledger Report
        <div className="text-xs font-normal mt-2 text-slate-500">
          Generated on {new Date().toLocaleDateString()} | {filters.fromDate || 'Start'} to {filters.toDate || 'End'}
        </div>
      </div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 px-4 md:px-0 no-print">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 font-semibold text-xs px-3.5 py-1.5 rounded-full mb-3 shadow-sm">
            <Wallet size={12} />
            <span>Liquid Capital Tracker</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 leading-none mb-2">Petty Cash Ledger</h1>
          <p className="text-slate-500 font-medium italic">Track daily cash inflows and outflows with precision</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handlePrint}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2.5 bg-white border border-slate-100 text-slate-700 px-6 py-4 rounded-2xl text-sm font-semibold shadow-sm hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-all active:scale-95 group whitespace-nowrap no-print"
          >
            <Printer size={18} className="text-indigo-600" />
            <span>Print Ledger</span>
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`flex-1 md:flex-none inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-sm font-semibold shadow-sm transition-all active:scale-95 group whitespace-nowrap ${
              showForm
                ? 'bg-rose-50 text-rose-600 border border-rose-100 shadow-rose-50'
                : 'bg-slate-800 text-white shadow-slate-200 hover:bg-slate-800'
            }`}
          >
            {showForm ? (
              <>
                <RotateCcw size={18} strokeWidth={3} />
                Cancel Entry
              </>
            ) : (
              <>
                <Plus size={18} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
                New Transaction
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm mx-4 md:mx-0 overflow-hidden no-print">
        <div className="p-3.5 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6">
          <div className="w-full lg:max-w-md relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search description or amount..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl pl-11 md:pl-12 pr-4 py-2.5 md:py-3.5 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-semibold text-slate-700 transition-all"
            />
          </div>
          <div className="hidden lg:block w-px h-8 bg-slate-100" />
          <div className="grid grid-cols-2 lg:flex items-center gap-2 md:gap-4 w-full lg:w-auto">
            <div className="flex items-center gap-2 md:gap-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl px-3 md:px-4 py-1.5 md:py-2 w-full md:w-auto">
              <Calendar size={16} className="text-slate-400" />
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-slate-400 leading-none mb-1">Start Date</span>
                <input
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                  className="bg-transparent border-none p-0 focus:ring-0 text-xs font-semibold text-slate-700 cursor-pointer"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl px-3 md:px-4 py-1.5 md:py-2 w-full md:w-auto">
              <Calendar size={16} className="text-slate-400" />
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-slate-400 leading-none mb-1">End Date</span>
                <input
                  type="date"
                  value={filters.toDate}
                  onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                  className="bg-transparent border-none p-0 focus:ring-0 text-xs font-semibold text-slate-700 cursor-pointer"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl px-3 md:px-4 py-1.5 md:py-2 w-full md:w-auto">
              <Filter size={16} className="text-slate-400" />
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-slate-400 leading-none mb-1">Type</span>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  className="bg-transparent border-none p-0 focus:ring-0 text-xs font-semibold text-slate-700 cursor-pointer appearance-none pr-4"
                >
                  <option value="">All Types</option>
                  <option value="Cash Received">Inflow</option>
                  <option value="Expense">Outflow</option>
                  <option value="Cash Returned">Returned</option>
                </select>
              </div>
            </div>
            <div
              className="flex items-center gap-2 md:gap-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl px-3 md:px-4 py-1.5 md:py-2 cursor-pointer hover:bg-slate-100 transition-colors w-full md:w-auto"
              onClick={() => requestSort('date')}
            >
              <ArrowUpDown size={16} className={`text-slate-400 ${sortConfig.key === 'date' && sortConfig.direction === 'desc' ? 'rotate-180' : ''} transition-transform`} />
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-slate-400 leading-none mb-1">Timeline</span>
                <span className="text-xs font-semibold text-slate-700">
                  {sortConfig.key === 'date' && sortConfig.direction === 'asc' ? 'Oldest First' : 'Newest First'}
                </span>
              </div>
            </div>
            {(filters.fromDate || filters.toDate || filters.type || filters.searchQuery) && (
              <button
                onClick={() => setFilters({ fromDate: '', toDate: '', type: '', searchQuery: '' })}
                className="col-span-2 md:col-auto p-2.5 bg-rose-50 text-rose-500 rounded-xl md:rounded-2xl hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
                title="Clear Filters"
              >
                <X size={18} />
                <span className="md:hidden text-xs font-bold uppercase tracking-wider">Clear Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 px-4 md:px-0 no-print">
        <div className="bg-white border border-slate-100 p-3.5 md:p-6 rounded-xl shadow-sm relative overflow-hidden group hover:shadow-sm transition-all duration-500">
          <div className="relative">
            <div className="p-2 md:p-3 bg-slate-800 text-white rounded-xl md:rounded-2xl w-fit shadow-sm mb-2 md:mb-4">
              <Wallet className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2.5} />
            </div>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Available Balance</p>
            <h2 className="text-base md:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(currentBalance).replace('INR', '₹')}</h2>
          </div>
        </div>
        <div className="bg-white border border-slate-100 p-3.5 md:p-6 rounded-xl shadow-sm relative overflow-hidden group hover:shadow-sm transition-all duration-500">
          <div className="relative">
            <div className="p-2 md:p-3 bg-emerald-600 text-white rounded-xl md:rounded-2xl w-fit shadow-sm mb-2 md:mb-4">
              <ArrowUpRight className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2.5} />
            </div>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Total Inflow</p>
            <h2 className="text-base md:text-2xl lg:text-3xl font-black text-emerald-600 tracking-tight">{formatCurrency(totalReceived).replace('INR', '₹')}</h2>
          </div>
        </div>
        <div className="bg-white border border-slate-100 p-3.5 md:p-6 rounded-xl shadow-sm relative overflow-hidden group hover:shadow-sm transition-all duration-500">
          <div className="relative">
            <div className="p-2 md:p-3 bg-rose-600 text-white rounded-xl md:rounded-2xl w-fit shadow-sm mb-2 md:mb-4">
              <ArrowDownRight className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2.5} />
            </div>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Total Outflow</p>
            <h2 className="text-base md:text-2xl lg:text-3xl font-black text-rose-600 tracking-tight">{formatCurrency(totalExpense).replace('INR', '₹')}</h2>
          </div>
        </div>
        <div className="bg-white border border-slate-100 p-3.5 md:p-6 rounded-xl shadow-sm relative overflow-hidden group hover:shadow-sm transition-all duration-500">
          <div className="relative">
            <div className="p-2 md:p-3 bg-amber-500 text-white rounded-xl md:rounded-2xl w-fit shadow-sm mb-2 md:mb-4">
              <RotateCcw className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2.5} />
            </div>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Cash Returned</p>
            <h2 className="text-base md:text-2xl lg:text-3xl font-black text-amber-600 tracking-tight">{formatCurrency(cashReturned).replace('INR', '₹')}</h2>
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div className={`${showForm ? 'block' : 'hidden'} ${
        showForm 
          ? 'fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md p-4 md:p-0 overflow-y-auto md:static md:bg-transparent md:backdrop-blur-none md:z-auto md:overflow-visible animate-in fade-in duration-300' 
          : ''
      }`}>
        <div className="min-h-full flex flex-col md:block py-10 md:py-0">
          {/* Mobile Header for Form */}
          <div className="flex items-center justify-between mb-4 md:hidden px-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg">
                <Plus size={20} />
              </div>
              <h2 className="text-xl font-bold text-white">New Transaction</h2>
            </div>
            <button 
              onClick={() => {
                setShowForm(false);
                setFormEntries([createDefaultEntry()]);
              }} 
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white backdrop-blur-sm transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
          {formEntries.map((entry, index) => (
            <div key={index} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-10 space-y-8 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <span className="text-sm font-semibold">#{index + 1}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">Transaction Entry</h3>
                </div>
                {formEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFormEntry(index)}
                    className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors"
                    title="Remove this form"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 ml-1">Value Date</label>
                  <input
                    type="date"
                    value={entry.date}
                    onChange={(e) => updateEntry(index, 'date', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-semibold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 ml-1">Transaction Type</label>
                  <select
                    value={entry.type}
                    onChange={(e) => updateEntry(index, 'type', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-semibold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all appearance-none cursor-pointer shadow-sm"
                    required
                  >
                    <option value="Cash Received">Cash Received (+)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 ml-1">Amount (INR)</label>
                  <div className="relative group flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateEntry(index, 'amount', Math.max(0, (parseFloat(entry.amount) || 0) - 100))}
                      className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-90"
                    >
                      <Minus size={20} strokeWidth={3} />
                    </button>
                    <div className="relative flex-1">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        value={entry.amount}
                        onChange={(e) => updateEntry(index, 'amount', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-10 pr-5 py-4 text-lg font-semibold text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => updateEntry(index, 'amount', (parseFloat(entry.amount) || 0) + 100)}
                      className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all active:scale-90"
                    >
                      <Plus size={20} strokeWidth={3} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 ml-1">Description / Memo</label>
                  <input
                    type="text"
                    value={entry.description}
                    onChange={(e) => updateEntry(index, 'description', e.target.value)}
                    placeholder="Nature of transaction..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-semibold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                    required
                  />
                </div>
                <div className="md:col-span-2 space-y-3">
                  <label className="text-xs font-semibold text-slate-400 ml-1">Attachments (Max 5 Documents)</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="cursor-pointer group flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-slate-100 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all relative overflow-hidden">
                      <input
                        type="file"
                        multiple
                        onChange={(e) => {
                          const selected = Array.from(e.target.files);
                          if (entry.attachments.length + selected.length > 5) {
                            toast.error('Max 5 documents per form');
                            return;
                          }
                          updateEntry(index, 'attachments', [...entry.attachments, ...selected]);
                        }}
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx"
                      />
                      <FileUp size={24} className="text-slate-400 group-hover:text-indigo-600 mb-2 transition-colors" />
                      <span className="text-xs font-semibold text-slate-400 group-hover:text-indigo-600">Upload</span>
                    </label>
                    {entry.attachments.map((file, fIdx) => (
                      <div key={fIdx} className="relative w-32 h-32 bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col items-center justify-center text-center gap-2 group">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...entry.attachments];
                            updated.splice(fIdx, 1);
                            updateEntry(index, 'attachments', updated);
                          }}
                          className="absolute -top-2 -right-2 p-1.5 bg-rose-500 text-white rounded-full shadow-lg hover:bg-rose-600 transition-colors z-10"
                        >
                          <X size={12} strokeWidth={3} />
                        </button>
                        <div className="p-2.5 bg-white rounded-xl shadow-sm">
                          <Paperclip size={16} className="text-indigo-500" />
                        </div>
                        <span className="text-[9px] font-semibold text-slate-600 truncate w-full px-2">{file.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              type="button"
              onClick={addFormEntry}
              className="flex-1 bg-white border-2 border-dashed border-indigo-200 text-indigo-600 px-8 py-4 rounded-2xl text-sm font-semibold hover:border-indigo-400 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={20} strokeWidth={3} />
              Add Another Transaction
            </button>
            <button
              type="submit"
              className="flex-1 bg-slate-800 text-white px-8 py-4 rounded-2xl text-sm font-semibold hover:bg-slate-800 transition-all active:scale-95 shadow-sm flex items-center justify-center gap-2"
            >
              Commit All to Ledger ({formEntries.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormEntries([createDefaultEntry()]);
              }}
              className="px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl text-sm font-semibold hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-95 border border-slate-100"
            >
              Discard
            </button>
          </div>
        </form>
      </div>
    </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl md:border border-slate-100 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        {fetching ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-indigo-600 border-t-transparent mx-auto"></div>
            <p className="text-slate-400 font-semibold text-xs">Syncing Financial Records...</p>
          </div>
        ) : displayTransactions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white">
            <div className="p-6 bg-white rounded-full shadow-sm mb-4">
              <RotateCcw className="text-slate-300 animate-spin-slow" size={48} />
            </div>
            <p className="text-slate-400 font-semibold text-xs">No ledger entries found</p>
          </div>
        ) : (
          <>
            {/* Mobile View - Industrial Minimal */}
            <div className="md:hidden flex flex-col gap-4 p-4 pb-20 no-print">
              {displayTransactions.map((t) => (
                <div key={t.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 relative overflow-hidden active:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <Calendar size={12} className="text-slate-300" />
                        <span>{formatDate(t.date)}</span>
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 leading-snug line-clamp-2">{t.description}</h3>
                    </div>
                    <button
                      onClick={() => handleDelete(t.timestamp || t.id)}
                      className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                      title="Delete Entry"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4 py-3 border-y border-slate-50">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Type</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border w-fit ${
                        t.type === 'Cash Received' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        t.type === 'Expense' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {t.type}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 text-right">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Balance</span>
                      <span className="text-xs font-bold text-slate-600">{formatCurrency(t.balance).replace('INR', '₹')}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {t.attachments && t.attachments.trim() !== '' ? (
                        <div className="flex gap-1.5">
                          {t.attachments.split(',').map((link, lIdx) => (
                            <a 
                              key={lIdx} 
                              href={link.trim()} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                            >
                              <Paperclip size={14} />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-300 italic">No attachments</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-xl font-bold ${
                        (t.type === 'Expense' || t.type === 'Cash Returned') ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {(t.type === 'Expense' || t.type === 'Cash Returned') ? '-' : '+'}{formatCurrency(t.amount).replace('INR', '₹').replace(/\.00$/, '')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block print:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-white">
                    <th className="px-6 py-5 text-xs font-semibold text-slate-400 text-center no-print">Actions</th>
                    <th
                      className="px-6 py-5 text-xs font-semibold text-slate-400 cursor-pointer hover:text-indigo-600 transition-colors group/h"
                      onClick={() => requestSort('date')}
                    >
                      <div className="flex items-center gap-2">
                        Value Date
                        <div className="flex flex-col no-print">
                          <ChevronUp size={10} className={`${sortConfig.key === 'date' && sortConfig.direction === 'asc' ? 'text-indigo-600' : 'text-slate-300'}`} />
                          <ChevronDown size={10} className={`${sortConfig.key === 'date' && sortConfig.direction === 'desc' ? 'text-indigo-600' : 'text-slate-300'}`} />
                        </div>
                      </div>
                    </th>
                    <th
                      className="px-6 py-5 text-xs font-semibold text-slate-400 cursor-pointer hover:text-indigo-600 transition-colors group/h"
                      onClick={() => requestSort('type')}
                    >
                      <div className="flex items-center gap-2">
                        Transaction
                        <div className="flex flex-col no-print">
                          <ChevronUp size={10} className={`${sortConfig.key === 'type' && sortConfig.direction === 'asc' ? 'text-indigo-600' : 'text-slate-300'}`} />
                          <ChevronDown size={10} className={`${sortConfig.key === 'type' && sortConfig.direction === 'desc' ? 'text-indigo-600' : 'text-slate-300'}`} />
                        </div>
                      </div>
                    </th>
                    <th
                      className="px-6 py-5 text-xs font-semibold text-slate-400 cursor-pointer hover:text-indigo-600 transition-colors group/h"
                      onClick={() => requestSort('description')}
                    >
                      <div className="flex items-center gap-2">
                        Description
                        <div className="flex flex-col no-print">
                          <ChevronUp size={10} className={`${sortConfig.key === 'description' && sortConfig.direction === 'asc' ? 'text-indigo-600' : 'text-slate-300'}`} />
                          <ChevronDown size={10} className={`${sortConfig.key === 'description' && sortConfig.direction === 'desc' ? 'text-indigo-600' : 'text-slate-300'}`} />
                        </div>
                      </div>
                    </th>
                    <th
                      className="px-6 py-5 text-xs font-semibold text-slate-400 cursor-pointer hover:text-indigo-600 transition-colors group/h text-right"
                      onClick={() => requestSort('amount')}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Settlement
                        <div className="flex flex-col no-print">
                          <ChevronUp size={10} className={`${sortConfig.key === 'amount' && sortConfig.direction === 'asc' ? 'text-indigo-600' : 'text-slate-300'}`} />
                          <ChevronDown size={10} className={`${sortConfig.key === 'amount' && sortConfig.direction === 'desc' ? 'text-indigo-600' : 'text-slate-300'}`} />
                        </div>
                      </div>
                    </th>
                    <th className="px-6 py-5 text-xs font-semibold text-slate-400 text-center">Docs</th>
                    <th
                      className="px-6 py-5 text-xs font-semibold text-slate-400 cursor-pointer hover:text-indigo-600 transition-colors group/h text-right"
                      onClick={() => requestSort('balance')}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Balance
                        <div className="flex flex-col no-print">
                          <ChevronUp size={10} className={`${sortConfig.key === 'balance' && sortConfig.direction === 'asc' ? 'text-indigo-600' : 'text-slate-300'}`} />
                          <ChevronDown size={10} className={`${sortConfig.key === 'balance' && sortConfig.direction === 'desc' ? 'text-indigo-600' : 'text-slate-300'}`} />
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-white transition-colors group">
                      <td className="px-6 py-5 text-center no-print">
                        <button
                          onClick={() => handleDelete(t.timestamp || t.id)}
                          className="p-2.5 bg-slate-100 text-slate-400 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-95"
                          title="Delete Transaction"
                        >
                          <Trash2 size={16} strokeWidth={3} />
                        </button>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-[13px] font-semibold text-slate-600">{formatDate(t.date)}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                          t.type === 'Cash Received' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          t.type === 'Expense' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-6 py-5 max-w-[300px]">
                        <span className="text-[13px] font-semibold text-slate-900 truncate block" title={t.description}>{t.description}</span>
                      </td>
                      <td className={`px-6 py-5 text-right font-semibold ${
                        (t.type === 'Cash Received' || t.type === 'Cash Returned') ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {(t.type === 'Cash Received' || t.type === 'Cash Returned') ? '+' : '-'}{formatCurrency(t.amount).replace('INR', '₹')}
                      </td>
                      <td className="px-6 py-5 text-center">
                        {t.attachments && t.attachments.trim() !== '' ? (
                          <div className="flex items-center justify-center gap-2">
                            {t.attachments.split(',').map((link, lIdx) => {
                              const url = link.trim();
                              const isPdf = url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf');
                              const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                              const isDrive = url.includes('drive.google.com');
                              
                              return (
                                <a
                                  key={lIdx}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="group relative"
                                  title={`View Document ${lIdx + 1}`}
                                >
                                  <div className={`w-10 h-10 rounded-xl overflow-hidden border-2 shadow-sm transition-all flex flex-col items-center justify-center text-center leading-none ${
                                    isPdf ? 'bg-rose-50 border-rose-100 group-hover:border-rose-400 group-hover:shadow-rose-100' :
                                    isImage ? 'bg-emerald-50 border-emerald-100 group-hover:border-emerald-400 group-hover:shadow-emerald-100' :
                                    'bg-indigo-50 border-indigo-100 group-hover:border-indigo-400 group-hover:shadow-indigo-100'
                                  }`}>
                                    {isPdf ? (
                                      <>
                                        <FileText size={14} className="text-rose-500 mb-0.5" />
                                        <span className="text-[7px] font-semibold text-rose-500 ">PDF</span>
                                      </>
                                    ) : isImage ? (
                                      <>
                                        <Image size={14} className="text-emerald-500 mb-0.5" />
                                        <span className="text-[7px] font-semibold text-emerald-500 ">IMG</span>
                                      </>
                                    ) : (
                                      <>
                                        <Paperclip size={14} className="text-indigo-500 mb-0.5" />
                                        <span className="text-[7px] font-semibold text-indigo-400 ">DOC</span>
                                      </>
                                    )}
                                    {/* Subtle Overlay */}
                                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
                                  </div>
                                </a>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg text-slate-300 text-[9px] font-semibold italic border border-slate-100/50 print:bg-transparent print:border-none print:text-slate-400">
                            <span className="no-print"><X size={8} /></span>
                            <span className="print:hidden">No Docs</span>
                            <span className="hidden print:inline">None</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="px-3 py-1.5 bg-slate-800 text-white rounded-xl text-[13px] font-semibold shadow-sm">
                          {formatCurrency(t.balance).replace('INR', '₹')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {/* Mobile Floating Action Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="md:hidden fixed bottom-6 right-6 p-5 bg-slate-800 text-white rounded-full shadow-2xl shadow-slate-400 z-40 active:scale-90 transition-all border-4 border-white animate-in zoom-in slide-in-from-bottom-10 duration-500"
          title="New Transaction"
        >
          <Plus size={28} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
