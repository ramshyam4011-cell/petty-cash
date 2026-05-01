import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Search, Plus, Calendar, Check, AlertTriangle, Eye, Trash2, AlertCircle, FileText, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { formatCurrency, formatDateForInput, formatDateTime } from '../utils/helpers';
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
    <div className="p-2 md:p-8 space-y-6 md:space-y-10 animate-in fade-in duration-1000">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold text-[10px] uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full mb-3 shadow-sm">
            <FileText size={12} />
            <span>Master Ledger</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-none mb-2">Expense List</h1>
          <p className="text-slate-500 font-medium italic">Viewing {filteredExpenses.length} of {expenses.length} total entries</p>
        </div>

        <Link 
          to="/add-expense" 
          className="w-full md:w-auto inline-flex items-center justify-center gap-2.5 bg-slate-900 text-white px-6 py-4 rounded-2xl text-sm font-black shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 group whitespace-nowrap"
        >
          <Plus size={18} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
          Create New Entry
        </Link>
      </div>

      {/* Industrial Grade Filter Panel */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all duration-500 hover:shadow-[0_8px_40px_rgb(0,0,0,0.06)] animate-in fade-in zoom-in duration-700">
        <div className="px-5 py-5 md:px-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row gap-4 items-end">
              {/* Global Search */}
              <div className="w-full lg:flex-1 space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Universal Search</span>
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search voucher, description, vendor..." 
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-300 shadow-sm"
                  />
                </div>
              </div>

              {/* Status Focus */}
              <div className="w-full lg:w-48 space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Status Focus</span>
                <select 
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all appearance-none cursor-pointer shadow-sm"
                >
                  <option value="All">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Hold">Hold</option>
                </select>
              </div>

              {/* Action: Clear */}
              <button 
                onClick={handleClearFilters}
                className="w-full lg:w-auto px-6 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 hover:text-rose-500 transition-all active:scale-95 whitespace-nowrap shadow-sm"
              >
                Clear Filters
              </button>
            </div>

            {/* Date Horizons */}
            <div className="flex flex-col sm:flex-row gap-4">
               <div className="flex-1 space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Start Horizon</span>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                    <input 
                      type="date" 
                      value={filters.fromDate}
                      onChange={(e) => setFilters({...filters, fromDate: e.target.value})}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                    />
                  </div>
               </div>
               <div className="flex-1 space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">End Horizon</span>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                    <input 
                      type="date" 
                      value={filters.toDate}
                      onChange={(e) => setFilters({...filters, toDate: e.target.value})}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                    />
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        {fetching ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-indigo-600 border-t-transparent mx-auto"></div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Syncing Records...</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-slate-50/50">
            <div className="p-6 bg-white rounded-full shadow-sm mb-4">
               <AlertTriangle className="text-amber-400" size={48} />
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No records match your criteria</p>
          </div>
        ) : (
          <>
            {/* Mobile View (Hidden on Desktop) */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100">
              {filteredExpenses.map((expense) => (
                <div key={expense.id} className="p-4 flex flex-col gap-4">
                   <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-1.5">
                         <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black border border-indigo-100 uppercase tracking-widest w-fit">{expense.sn}</span>
                         <h3 className="font-black text-slate-900 text-lg leading-tight uppercase">{expense.remarks || 'No Description'}</h3>
                         <span className="text-[11px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg w-fit uppercase tracking-wider">{expense.groupHead}</span>
                      </div>
                      <div className="text-right">
                         <p className="text-xl font-black text-slate-900">{formatCurrency(expense.amount).replace('INR', '₹')}</p>
                         <div className="mt-1">{getStatusPill(expense.status)}</div>
                      </div>
                   </div>

                   <div className="bg-slate-50 p-3 rounded-2xl space-y-2">
                      <div className="flex justify-between text-[11px] font-bold">
                         <span className="text-slate-400 uppercase">Paid To</span>
                         <span className="text-slate-600">{expense.date}</span>
                      </div>
                      <p className="text-xs text-slate-700 font-black uppercase tracking-tight">{expense.paidTo}</p>
                   </div>

                   <div className="flex gap-2">
                      <button onClick={() => openViewModal(expense)} className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-600 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 border border-slate-200">
                         <Eye size={16} strokeWidth={3} /> Details
                      </button>
                      <button onClick={() => handleDelete(expense.sn)} className="p-3 bg-rose-50 text-rose-600 rounded-2xl font-black transition-all active:scale-95 border border-rose-100">
                         <Trash2 size={20} strokeWidth={3} />
                      </button>
                   </div>
                </div>
              ))}
            </div>

            {/* Desktop View (Hidden on Mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Voucher</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Recipient</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5">
                        <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-[12px] font-black border border-indigo-100 shadow-sm">{expense.sn}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-[13px] font-bold text-slate-600">{expense.date}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-black text-slate-900 uppercase tracking-tight">{expense.groupHead}</span>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{expense.subHead || expense.expenseHead}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 max-w-[280px]">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-slate-900 truncate uppercase" title={expense.remarks}>{expense.remarks || 'No Description'}</span>
                          <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider truncate" title={expense.paidTo}>{expense.paidTo}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex flex-col items-end">
                           <span className="text-base font-black text-slate-900 tracking-tight">{formatCurrency(expense.amount).replace('INR', '₹')}</span>
                           <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{expense.paymentMode}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        {getStatusPill(expense.status)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-center gap-3">
                          <button onClick={() => openViewModal(expense)} className="p-2.5 bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white rounded-xl transition-all shadow-sm active:scale-95" title="View Details">
                            <Eye size={18} strokeWidth={3} />
                          </button>
                          <button onClick={() => handleDelete(expense.sn)} className="p-2.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-95" title="Delete">
                            <Trash2 size={18} strokeWidth={3} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      
      {/* View Expense Modal */}
      {isViewModalOpen && selectedExpense && (
        <div className="fixed inset-0 lg:left-64 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
            
            {/* Modal Header */}
            <div className="px-8 py-7 border-b border-slate-100 flex items-start justify-between bg-white relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2.5">
                   <span className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[12px] font-black shadow-lg shadow-indigo-100 uppercase tracking-widest">{selectedExpense.sn}</span>
                   {getStatusPill(selectedExpense.status)}
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar size={14} className="text-indigo-400" />
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em]">Submission Date:</span>
                  <span className="text-[13px] font-black text-slate-900 tracking-tight">{selectedExpense.date}</span>
                </div>
              </div>
              <button 
                onClick={closeViewModal}
                className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all p-2.5 rounded-2xl border border-slate-100 shadow-sm bg-white"
              >
                <X size={22} strokeWidth={3} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Group Head</span>
                    <p className="text-sm font-black text-slate-900 uppercase leading-tight">{selectedExpense.groupHead || '-'}</p>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense Head</span>
                    <p className="text-sm font-black text-slate-900 uppercase leading-tight">{selectedExpense.expenseHead || '-'}</p>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub Head</span>
                    <p className="text-sm font-black text-slate-900 uppercase leading-tight">{selectedExpense.subHead || '-'}</p>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Mode</span>
                    <p className="text-sm font-black text-slate-900 uppercase leading-tight">{selectedExpense.paymentMode || 'Cash'}</p>
                 </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                 <div className="flex justify-between items-center border-b border-slate-200/50 pb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Amount</span>
                    <span className="text-2xl font-black text-indigo-600">{formatCurrency(selectedExpense.amount).replace('INR', '₹')}</span>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description / Reason</span>
                    <p className="text-sm font-bold text-slate-700 leading-relaxed">{selectedExpense.remarks || 'No detailed reason provided.'}</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paid To</span>
                    <p className="text-sm font-black text-slate-900 uppercase">{selectedExpense.paidTo || '-'}</p>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Branch</span>
                    <p className="text-sm font-black text-slate-900 uppercase">{selectedExpense.branch || 'HO'}</p>
                 </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-4">
                 {selectedExpense.billUrl ? (
                    <a href={selectedExpense.billUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border border-emerald-100 hover:bg-emerald-100 transition-all">
                       <Check size={14} strokeWidth={3} /> View Attachment
                    </a>
                 ) : (
                    <div className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border border-rose-100">
                       <AlertCircle size={14} strokeWidth={3} /> No Bill Attached
                    </div>
                 )}
              </div>

              {(selectedExpense.approvalTimestamp || selectedExpense.approvalRemarks) && (
                <div className="mt-8 p-6 bg-slate-900 rounded-3xl space-y-4">
                   <div className="flex justify-between items-center text-white">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Audit Trail</span>
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{formatDateTime(selectedExpense.approvalTimestamp)}</span>
                   </div>
                   {selectedExpense.approvalRemarks && (
                     <div className="space-y-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Admin Remarks</span>
                        <p className="text-sm font-bold text-slate-200 leading-relaxed italic">"{selectedExpense.approvalRemarks}"</p>
                     </div>
                   )}
                </div>
              )}
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
               <button onClick={closeViewModal} className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-100">
                  Dismiss Detail
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
