import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Wallet, ArrowUpRight, ArrowDownRight, RotateCcw } from 'lucide-react';
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
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Petty Cash Ledger</h1>
          <p className="text-gray-500 mt-1 text-sm">Track daily cash inflows and outflows</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm shadow-blue-200 transition w-fit"
        >
          <Plus size={20} /> Add Transaction
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-2xl flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600 uppercase tracking-wider">Current Balance</p>
            <h2 className="text-3xl font-bold text-blue-900 mt-2">{formatCurrency(currentBalance)}</h2>
          </div>
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <Wallet size={24} />
          </div>
        </div>

        <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-2xl flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-600 uppercase tracking-wider">Total Received</p>
            <h2 className="text-3xl font-bold text-emerald-900 mt-2">{formatCurrency(totalReceived)}</h2>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
            <ArrowUpRight size={24} />
          </div>
        </div>

        <div className="bg-rose-50/50 border border-rose-100 p-6 rounded-2xl flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-rose-600 uppercase tracking-wider">Total Expense</p>
            <h2 className="text-3xl font-bold text-rose-900 mt-2">{formatCurrency(totalExpense)}</h2>
          </div>
          <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
            <ArrowDownRight size={24} />
          </div>
        </div>

        <div className="bg-amber-50/50 border border-amber-100 p-6 rounded-2xl flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-amber-600 uppercase tracking-wider">Cash Returned</p>
            <h2 className="text-3xl font-bold text-amber-900 mt-2">{formatCurrency(cashReturned)}</h2>
          </div>
          <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
            <RotateCcw size={24} />
          </div>
        </div>
      </div>

      {/* New Transaction Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6 animate-in slide-in-from-top duration-300">
          <h3 className="text-lg font-bold text-gray-900">New Cash Transaction</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 shadow-sm text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800 shadow-sm text-sm font-medium"
                required
              >
                <option value="Cash Received">Cash Received</option>
                <option value="Expense">Expense</option>
                <option value="Cash Returned">Cash Returned</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Amount (INR)</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 shadow-sm text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 shadow-sm text-sm"
                required
              />
            </div>

            <div className="md:col-span-2 flex gap-3 pt-2">
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition text-sm"
              >
                Add Transaction
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs font-bold tracking-wider uppercase border-b border-gray-200">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-right">In</th>
                <th className="px-6 py-4 text-right">Out</th>
                <th className="px-6 py-4 text-right">Balance</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {fetching ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-500 mt-3 text-sm font-medium">Loading ledger...</p>
                  </td>
                </tr>
              ) : displayTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors font-medium">
                  <td className="px-6 py-4 text-gray-600 font-normal">{formatDate(t.date)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                      t.type === 'Cash Received'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : t.type === 'Expense'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-900">{t.description}</td>
                  
                  {/* In Column */}
                  <td className="px-6 py-4 text-right text-emerald-600 font-bold">
                    {(t.type === 'Cash Received' || t.type === 'Cash Returned') ? formatCurrency(t.amount) : '-'}
                  </td>
                  
                  {/* Out Column */}
                  <td className="px-6 py-4 text-right text-rose-600 font-bold">
                    {t.type === 'Expense' ? formatCurrency(t.amount) : '-'}
                  </td>
                  
                  {/* Balance Column */}
                  <td className="px-6 py-4 text-right text-gray-900 font-bold">
                    {formatCurrency(t.balance)}
                  </td>

                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-gray-400 hover:text-rose-600 transition-colors p-1"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {transactions.length === 0 && (
          <div className="text-center py-12 text-gray-400 font-medium">
            No transactions logged yet.
          </div>
        )}
      </div>
    </div>
  );
}
