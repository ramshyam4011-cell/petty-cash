import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Wallet, ArrowUpRight, ArrowDownRight, RotateCcw, Calendar } from 'lucide-react';
import { formatCurrency, formatDate, getTodayDate } from '../utils/helpers';

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;
const PETTY_CASH_SHEET = 'PettyCash';

const INITIAL_DATA = [
  { id: 'pt-1', date: '2026-04-22', type: 'Cash Received', description: 'Opening cash balance received from accounts', amount: 10000 },
  { id: 'pt-2', date: '2026-04-23', type: 'Expense', description: 'Printer repair (VCH-2024-008)', amount: 1800 },
  { id: 'pt-3', date: '2026-04-24', type: 'Expense', description: 'Tea & coffee (VCH-2024-001)', amount: 350 },
  { id: 'pt-4', date: '2026-04-25', type: 'Cash Received', description: 'Top-up from accounts department', amount: 5000 },
  { id: 'pt-5', date: '2026-04-26', type: 'Expense', description: 'Courier charges (VCH-2024-007)', amount: 650 },
  { id: 'pt-6', date: '2026-04-27', type: 'Cash Returned', description: 'Excess cash returned', amount: 500 },
];

export default function PettyCash() {
  const [transactions, setTransactions] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    date: getTodayDate(),
    type: 'Cash Received',
    amount: '',
    description: ''
  });

  const fetchTransactions = async () => {
    try {
      setFetching(true);
      const res = await fetch(APPSCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'readPettyCash'
        })
      });
      const json = await res.json();
      if (json.success) {
        const mapped = (json.data || []).map((t, idx) => {
          const d = {};
          Object.keys(t).forEach(k => { d[k.trim()] = t[k]; });
          return {
            id: d.Timestamp || `pt-${idx}`,
            date: d.Date || '-',
            type: d.Type || '-',
            amount: parseFloat(d.Amount) || 0,
            description: d.Description || '-',
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


  // Calculations
  const totalReceived = transactions
    .filter(t => t.type === 'Cash Received')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const totalExpense = transactions
    .filter(t => t.type === 'Expense')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const cashReturned = transactions
    .filter(t => t.type === 'Cash Returned')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const currentBalance = totalReceived - totalExpense + cashReturned;

  // Process transactions for running balance
  let runningBalance = 0;
  const transactionsWithBalance = transactions
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(t => {
      if (t.type === 'Cash Received' || t.type === 'Cash Returned') {
        runningBalance += parseFloat(t.amount || 0);
      } else if (t.type === 'Expense') {
        runningBalance -= parseFloat(t.amount || 0);
      }
      return { ...t, balance: runningBalance };
    });

  // Sort descending for the table view (newest first)
  const displayTransactions = [...transactionsWithBalance].reverse();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!formData.description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    try {
      toast.loading('Saving transaction...', { id: 'save-toast' });
      const res = await fetch(APPSCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'createPettyCash',
          data: {
            Date: formData.date,
            Type: formData.type,
            Amount: parseFloat(formData.amount),
            Description: formData.description.trim()
          }
        })
      });
      const json = await res.json();
      
      if (json.success) {
        toast.success('Transaction added successfully!', { id: 'save-toast' });
        fetchTransactions();
        // Reset form
        setFormData({
          date: getTodayDate(),
          type: 'Cash Received',
          amount: '',
          description: ''
        });
        setShowForm(false);
      } else {
        toast.error('Failed to save: ' + json.error, { id: 'save-toast' });
      }
    } catch (err) {
      toast.error('Network error during submission', { id: 'save-toast' });
    }
  };

  const handleDelete = async (timestamp) => {
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
        toast.error('Failed to delete: ' + json.error, { id: 'delete-toast' });
      }
    } catch (err) {
      toast.error('Network error during deletion', { id: 'delete-toast' });
    }
  };

  return (
    <div className="p-0 md:p-8 space-y-8 md:space-y-12 animate-in fade-in duration-1000">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 px-4 md:px-0">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold text-[10px] uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full mb-3 shadow-sm">
            <Wallet size={12} />
            <span>Liquid Capital Tracker</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-none mb-2">Petty Cash Ledger</h1>
          <p className="text-slate-500 font-medium italic">Track daily cash inflows and outflows with precision</p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className={`w-full md:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-sm font-black shadow-xl transition-all active:scale-95 group whitespace-nowrap ${
            showForm 
              ? 'bg-rose-50 text-rose-600 border border-rose-100 shadow-rose-50' 
              : 'bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800'
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

      {/* Industrial Grade Summary Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 px-4 md:px-0">
        {/* Current Balance */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-xl transition-all duration-500">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-500 opacity-50"></div>
          <div className="relative">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl w-fit shadow-lg shadow-indigo-100 mb-4">
              <Wallet size={20} strokeWidth={2.5} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Available Balance</p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(currentBalance).replace('INR', '₹')}</h2>
          </div>
        </div>

        {/* Total Received */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-xl transition-all duration-500">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-500 opacity-50"></div>
          <div className="relative">
            <div className="p-3 bg-emerald-600 text-white rounded-2xl w-fit shadow-lg shadow-emerald-100 mb-4">
              <ArrowUpRight size={20} strokeWidth={2.5} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Inflow</p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight text-emerald-600">{formatCurrency(totalReceived).replace('INR', '₹')}</h2>
          </div>
        </div>

        {/* Total Expense */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-xl transition-all duration-500">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-500 opacity-50"></div>
          <div className="relative">
            <div className="p-3 bg-rose-600 text-white rounded-2xl w-fit shadow-lg shadow-rose-100 mb-4">
              <ArrowDownRight size={20} strokeWidth={2.5} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Outflow</p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight text-rose-600">{formatCurrency(totalExpense).replace('INR', '₹')}</h2>
          </div>
        </div>

        {/* Cash Returned */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-xl transition-all duration-500">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-500 opacity-50"></div>
          <div className="relative">
            <div className="p-3 bg-amber-500 text-white rounded-2xl w-fit shadow-lg shadow-amber-100 mb-4">
              <RotateCcw size={20} strokeWidth={2.5} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cash Returned</p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight text-amber-600">{formatCurrency(cashReturned).replace('INR', '₹')}</h2>
          </div>
        </div>
      </div>

      {/* Transaction Entry Form */}
      {showForm && (
        <div className="mx-4 md:mx-0 bg-white rounded-[2rem] border border-slate-200 shadow-2xl p-6 md:p-10 space-y-8 animate-in slide-in-from-top duration-500 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500"></div>
          <div className="flex items-center gap-4">
             <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Plus size={24} strokeWidth={3} />
             </div>
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Record Cash Transaction</h3>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Value Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Transaction Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all appearance-none cursor-pointer shadow-sm"
                required
              >
                <option value="Cash Received">Cash Received (+)</option>
                <option value="Expense">Expense (-)</option>
                <option value="Cash Returned">Cash Returned (+)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount (INR)</label>
              <div className="relative group">
                 <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                 <input
                   type="number"
                   step="0.01"
                   value={formData.amount}
                   onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                   placeholder="0.00"
                   className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-5 py-4 text-lg font-black text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                   required
                 />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description / Memo</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Nature of transaction..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                required
              />
            </div>

            <div className="md:col-span-2 pt-4 flex flex-col sm:flex-row gap-4">
              <button
                type="submit"
                className="flex-1 bg-slate-900 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-100"
              >
                Commit to Ledger
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-95 border border-slate-200"
              >
                Discard
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-white rounded-[2rem] md:border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        {fetching ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-indigo-600 border-t-transparent mx-auto"></div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Syncing Financial Records...</p>
          </div>
        ) : displayTransactions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-slate-50/50">
            <div className="p-6 bg-white rounded-full shadow-sm mb-4">
               <RotateCcw className="text-slate-300 animate-spin-slow" size={48} />
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No ledger entries found</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col gap-5 p-2 pb-48 bg-slate-50/50">
               {displayTransactions.map((t) => (
                 <div key={t.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col gap-5 group relative overflow-hidden active:scale-[0.98] transition-transform">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-100 group-hover:bg-indigo-500 transition-colors"></div>
                    
                    <div className="flex justify-between items-start">
                       <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                             <Calendar size={12} className="text-slate-400" />
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDate(t.date)}</span>
                          </div>
                          <h3 className="font-black text-slate-900 text-lg leading-tight uppercase line-clamp-2 pr-4 tracking-tight">{t.description}</h3>
                       </div>
                       <button 
                         onClick={() => handleDelete(t.timestamp || t.id)} 
                         className="p-2.5 bg-slate-50 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                       >
                          <Trash2 size={18} strokeWidth={2.5} />
                       </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-100/50">
                       <div className="space-y-1.5">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Transaction Type</span>
                          <div className="flex">
                             <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                t.type === 'Cash Received' ? 'bg-emerald-100 text-emerald-700' :
                                t.type === 'Expense' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                             }`}>
                                {t.type}
                             </span>
                          </div>
                       </div>
                       <div className="text-right space-y-1.5 border-l border-slate-200 pl-3">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Running Balance</span>
                          <p className="text-[13px] font-black text-slate-900 tracking-tight">{formatCurrency(t.balance).replace('INR', '₹')}</p>
                       </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Settlement Amount</span>
                       <span className={`text-2xl font-black tracking-tighter ${
                          t.type === 'Expense' ? 'text-rose-600' : 'text-emerald-600'
                       }`}>
                          {t.type === 'Expense' ? '-' : '+'}{formatCurrency(t.amount).replace('INR', '₹')}
                       </span>
                    </div>
                 </div>
               ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Value Date</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Inflow (+)</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Outflow (-)</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5 text-center">
                        <button
                          onClick={() => handleDelete(t.timestamp || t.id)}
                          className="p-2.5 bg-slate-100 text-slate-400 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-95"
                          title="Delete Transaction"
                        >
                          <Trash2 size={16} strokeWidth={3} />
                        </button>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-[13px] font-bold text-slate-600">{formatDate(t.date)}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                          t.type === 'Cash Received' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          t.type === 'Expense' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-6 py-5 max-w-[300px]">
                        <span className="text-[13px] font-black text-slate-900 uppercase tracking-tight truncate block" title={t.description}>{t.description}</span>
                      </td>
                      <td className="px-6 py-5 text-right font-black text-emerald-600 tracking-tight">
                        {(t.type === 'Cash Received' || t.type === 'Cash Returned') ? formatCurrency(t.amount).replace('INR', '₹') : '-'}
                      </td>
                      <td className="px-6 py-5 text-right font-black text-rose-600 tracking-tight">
                        {t.type === 'Expense' ? formatCurrency(t.amount).replace('INR', '₹') : '-'}
                      </td>
                      <td className="px-6 py-5 text-right">
                         <span className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[13px] font-black shadow-lg shadow-slate-100">
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
    </div>
  );
}
