import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Search, Plus, Calendar, Check, AlertTriangle, Eye, Trash2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { formatCurrency, formatDateForInput } from '../utils/helpers';
import { Link } from 'react-router-dom';

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;

export default function ExpenseList() {
  const { user } = useAuthStore();
  const [expenses, setExpenses] = useState([]);
  const [fetching, setFetching] = useState(true);
  
  // Modal State
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    status: 'All',
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
            paidTo: d['Paid To'],
            branch: d.Branch,
            remarks: d['Description / Reason'],
            billUrl: d['Bill / Receipt'],
            user: d.user || d.User,
            status: (d.Status || 'Pending').trim(),
            planned: d['Planned'],
            approvalTimestamp: d['Approval Timestamp'],
            approvalRemarks: d['Approval / Reject - Remark'] || d['Approval Remark'] || ''
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

  const handleClearFilters = () => {
    setFilters({ search: '', status: 'All', fromDate: '', toDate: '' });
  };

  const handleDelete = async (sn) => {
    if (!window.confirm(`Are you sure you want to delete ${sn}?`)) return;
    
    try {
      toast.loading(`Deleting ${sn}...`, { id: 'delete-toast' });
      const res = await fetch(APPSCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', sn })
      });
      const json = await res.json();
      
      if (json.success) {
        toast.success(`${sn} deleted successfully!`, { id: 'delete-toast' });
        fetchExpenses();
      } else {
        toast.error('Failed to delete: ' + json.error, { id: 'delete-toast' });
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error during deletion', { id: 'delete-toast' });
    }
  };

  const openViewModal = (expense) => {
    setSelectedExpense(expense);
    setIsViewModalOpen(true);
  };

  const closeViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedExpense(null);
  };

  // Filter Logic
  const filteredExpenses = expenses.filter(e => {
    if (filters.status !== 'All' && e.status.toLowerCase() !== filters.status.toLowerCase()) return false;
    if (filters.fromDate && e.date < filters.fromDate) return false;
    if (filters.toDate && e.date > filters.toDate) return false;
    
    if (filters.search) {
      const q = filters.search.toLowerCase();
      return (
        (e.sn && e.sn.toLowerCase().includes(q)) ||
        (e.remarks && e.remarks.toLowerCase().includes(q)) ||
        (e.paidTo && e.paidTo.toLowerCase().includes(q))
      );
    }
    return true;
  });

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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Expense List</h1>
          <p className="text-gray-500 text-sm mt-0.5">{filteredExpenses.length} of {expenses.length} entries</p>
        </div>
        <Link to="/add-expense" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition shadow-sm whitespace-nowrap text-sm">
          <Plus size={16} strokeWidth={2.5} /> Add Expense
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col lg:flex-row gap-3 items-center shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Search voucher, description, vendor..." 
            value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>
        
        <div className="flex flex-wrap lg:flex-nowrap gap-3 w-full lg:w-auto">
          <select 
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 flex-1 min-w-[120px]"
          >
            <option value="All">All</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Hold">Hold</option>
          </select>

          <div className="relative flex-1 min-w-[140px]">
            <input 
              type="date" 
              value={filters.fromDate}
              onChange={(e) => setFilters({...filters, fromDate: e.target.value})}
              className="w-full border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 appearance-none"
            />
            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>

          <div className="relative flex-1 min-w-[140px]">
            <input 
              type="date" 
              value={filters.toDate}
              onChange={(e) => setFilters({...filters, toDate: e.target.value})}
              className="w-full border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 appearance-none"
            />
            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>

          <button 
            onClick={handleClearFilters}
            className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Voucher</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">By</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Mode</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Bill</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fetching ? (
                <tr>
                  <td colSpan="10" className="px-5 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-500 mt-3 text-sm">Loading expenses...</p>
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-5 py-12 text-center text-gray-500 text-sm">
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
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-gray-900 truncate" title={expense.remarks}>{expense.remarks || '-'}</span>
                        <span className="text-[12px] text-gray-400 truncate" title={expense.paidTo}>{expense.paidTo}</span>
                      </div>
                      {expense.approvalRemarks && (
                        <div className="mt-1 text-[11px] text-rose-600 flex items-start gap-1">
                          <AlertCircle size={12} className="mt-[2px] flex-shrink-0" />
                          <span className="line-clamp-2" title={expense.approvalRemarks}>{expense.approvalRemarks}</span>
                        </div>
                      )}
                    </td>
                    
                    {/* BY */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="text-[13px] text-gray-500">{expense.user || user?.name || 'Admin'}</span>
                        <span className="text-[12px] text-gray-400">{expense.branch || 'HO'}</span>
                      </div>
                    </td>
                    
                    {/* AMOUNT */}
                    <td className="px-5 py-4 text-right">
                      <span className="text-[14px] font-bold text-gray-900">{formatCurrency(expense.amount)}</span>
                    </td>
                    
                    {/* MODE */}
                    <td className="px-5 py-4 text-center">
                      <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-[11px] font-medium border border-gray-200 uppercase tracking-wide">
                        {expense.paymentMode || 'CASH'}
                      </span>
                    </td>
                    
                    {/* BILL */}
                    <td className="px-5 py-4 text-center">
                      {expense.billUrl ? (
                        <Check size={16} strokeWidth={3} className="text-emerald-500 mx-auto" />
                      ) : (
                        <AlertTriangle size={16} strokeWidth={2.5} className="text-amber-500 mx-auto" />
                      )}
                    </td>
                    
                    {/* STATUS */}
                    <td className="px-5 py-4 text-center">
                      {getStatusPill(expense.status)}
                    </td>
                    
                    {/* ACTIONS */}
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button 
                          onClick={() => openViewModal(expense)}
                          className="text-blue-500 hover:text-blue-700 transition"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(expense.sn)}
                          className="text-rose-400 hover:text-rose-600 transition"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* View Expense Modal */}
      {isViewModalOpen && selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">{selectedExpense.sn}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{selectedExpense.date}</p>
              </div>
              <div className="flex items-center gap-4">
                {getStatusPill(selectedExpense.status)}
                <button 
                  onClick={closeViewModal}
                  className="text-gray-400 hover:text-gray-600 transition p-1"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-3.5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Group Head</span>
                <span className="text-sm font-semibold text-gray-900 text-right">{selectedExpense.groupHead || '-'}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Expense Head</span>
                <span className="text-sm font-semibold text-gray-900 text-right">{selectedExpense.expenseHead || '-'}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Sub Head</span>
                <span className="text-sm font-semibold text-gray-900 text-right">{selectedExpense.subHead || '-'}</span>
              </div>
              
              <div className="flex justify-between items-center pt-1">
                <span className="text-sm text-gray-500">Amount</span>
                <span className="text-sm font-bold text-gray-900 text-right">{formatCurrency(selectedExpense.amount)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Payment Mode</span>
                <span className="text-sm font-semibold text-gray-900 text-right">{selectedExpense.paymentMode || 'Cash'}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Paid To</span>
                <span className="text-sm font-semibold text-gray-900 text-right">{selectedExpense.paidTo || '-'}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Branch</span>
                <span className="text-sm font-semibold text-gray-900 text-right">{selectedExpense.branch || 'HO'}</span>
              </div>
              
              <div className="flex justify-between items-start pt-1 gap-4">
                <span className="text-sm text-gray-500 whitespace-nowrap">Description</span>
                <span className="text-sm font-semibold text-gray-900 text-right">{selectedExpense.remarks || '-'}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Bill Attached</span>
                {selectedExpense.billUrl ? (
                  <a href={selectedExpense.billUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline text-right">
                    Yes (View)
                  </a>
                ) : (
                  <span className="text-sm font-semibold text-gray-900 text-right">No</span>
                )}
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm text-gray-500">Entered By</span>
                <span className="text-sm font-semibold text-gray-900 text-right">{selectedExpense.user || user?.name || 'Admin'}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Actioned By</span>
                <span className="text-sm font-semibold text-gray-900 text-right">
                  {selectedExpense.status === 'PENDING' ? '-' : (user?.name || 'Admin')}
                </span>
              </div>

              {selectedExpense.planned && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Planned Date</span>
                  <span className="text-sm font-semibold text-indigo-600 text-right">{selectedExpense.planned}</span>
                </div>
              )}

              {selectedExpense.approvalTimestamp && (
                <div className="flex justify-between items-center pt-1">
                  <span className="text-sm text-gray-500">Action Timestamp</span>
                  <span className="text-sm font-semibold text-emerald-600 text-right">{selectedExpense.approvalTimestamp}</span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
