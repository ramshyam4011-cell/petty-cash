import React, { useState, useRef, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
 Plus, Filter, Search, ChevronLeft, ChevronRight, X, Eye, Calendar, Check, AlertTriangle, Download, ArrowUpDown
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { formatDate, formatCurrency, getTodayDate } from '../utils/helpers';

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;

export default function AddExpense() {
 const { user } = useAuthStore();

 // ---- State ----
 const [expenses, setExpenses] = useState([]);
 const [fetching, setFetching] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [isUploading, setIsUploading] = useState(false);
 const [masterData, setMasterData] = useState([]); // Dynamic master data

 // Form
 const [formData, setFormData] = useState({
  date: getTodayDate(),
  paymentMode: 'Cash',
  groupHead: '',
  expenseHead: '',
  subHead: '',
  amount: '',
  paidTo: '',
  branch: 'Head Office',
  description: '',
  billUrl: ''  // <-- Bill / Receipt link (paste URL)
 });

 // UI toggles
 const [showFormModal, setShowFormModal] = useState(false);
 const [showMobileFilters, setShowMobileFilters] = useState(false);

 // Filters & Pagination
 const [filters, setFilters] = useState({
  fromDate: '',
  toDate: '',
  paidTo: '',
  mode: '',
  searchQuery: '',
  sortOrder: 'desc'
 });
 const [currentPage, setCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(15);

 // ---- Fetch Master Data (Group/Expense/Sub Heads) ----
 const fetchMasterData = async () => {
  try {
   const res = await fetch(APPSCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'readMaster' })
   });
   const json = await res.json();
   if (json.success) {
    setMasterData(json.data || []);
   }
  } catch (err) {
   console.error('Error fetching master data:', err);
  }
 };

 const groupHeads = useMemo(() => 
  [...new Set(masterData.map(d => d['Group Head'] || d['Group Heads']).filter(Boolean))].sort(), 
  [masterData]
 );

 const expenseHeads = useMemo(() => 
  [...new Set(masterData.map(d => d['Expense Head'] || d['Expense Heads']).filter(Boolean))].sort(), 
  [masterData]
 );

 const subHeads = useMemo(() => 
  [...new Set(masterData.map(d => d['Sub Head'] || d['Sub Heads']).filter(Boolean))].sort(), 
  [masterData]
 );

 // ---- Fetch expenses from Apps Script ----
 const fetchExpenses = async () => {
  try {
   setFetching(true);
   const res = await fetch(APPSCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'read' })
   });
   const json = await res.json();
   if (json.success) {
    setExpenses(json.data || []);
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
  fetchMasterData();
 }, []);
 useEffect(() => { setCurrentPage(1); }, [filters]);

 // ---- Client‑side filtering & pagination ----
 const filteredExpenses = expenses.filter(e => {
  if (filters.fromDate && e.Date < filters.fromDate) return false;
  if (filters.toDate && e.Date > filters.toDate) return false;
  if (filters.paidTo && e['Paid To'] !== filters.paidTo) return false;
  if (filters.mode && e['Payment mode'] !== filters.mode) return false;
  if (filters.searchQuery) {
   const q = filters.searchQuery.toLowerCase();
   const match =
    (e.SN && String(e.SN).toLowerCase().includes(q)) ||
    (e['Paid To'] && e['Paid To'].toLowerCase().includes(q)) ||
    (e.Date && String(e.Date).includes(q)) ||
    (e['Amount (INR)'] && String(e['Amount (INR)']).toLowerCase().includes(q)) ||
    (e['Payment mode'] && e['Payment mode'].toLowerCase().includes(q)) ||
    (e['Description / Reason'] && e['Description / Reason'].toLowerCase().includes(q)) ||
    (e['Group Head'] && e['Group Head'].toLowerCase().includes(q)) ||
    (e['Expense Head'] && e['Expense Head'].toLowerCase().includes(q)) ||
    (e['Sub Head'] && e['Sub Head'].toLowerCase().includes(q));
   if (!match) return false;
  }
  return true;
 });

 const sortedExpenses = useMemo(() => {
  return [...filteredExpenses].sort((a, b) => {
   // Sort by Date primarily
   const dateA = a.Date || '';
   const dateB = b.Date || '';
   const dateComp = filters.sortOrder === 'asc' 
    ? dateA.localeCompare(dateB) 
    : dateB.localeCompare(dateA);
   
   if (dateComp !== 0) return dateComp;
   
   // If dates are same, sort by SN (assuming format VCH-YYYY-XXX)
   const snA = String(a.SN || '');
   const snB = String(b.SN || '');
   return filters.sortOrder === 'asc' 
    ? snA.localeCompare(snB) 
    : snB.localeCompare(snA);
  });
 }, [filteredExpenses, filters.sortOrder]);
 const totalPages = Math.ceil(sortedExpenses.length / itemsPerPage);
 const paginatedExpenses = sortedExpenses.slice(
  (currentPage - 1) * itemsPerPage,
  currentPage * itemsPerPage
 );
 const pageTotalAmount = paginatedExpenses.reduce((s, e) => s + (parseFloat(e['Amount (INR)']) || 0), 0);
 const totalAmount = sortedExpenses.reduce((s, e) => s + (parseFloat(e['Amount (INR)']) || 0), 0);

 // ---- Form submit ----
 const handleSubmit = async (e) => {
  e.preventDefault();

  // Validation
  if (!formData.paidTo.trim()) { toast.error('Please enter who it was paid to'); return; }
  if (!formData.amount || parseFloat(formData.amount) <= 0) { toast.error('Please enter valid amount'); return; }
  if (!formData.groupHead) { toast.error('Please select Group Head'); return; }
  if (!formData.expenseHead) { toast.error('Please select Expense Head'); return; }
  if (!formData.subHead) { toast.error('Please select Sub Head'); return; }
  if (!formData.description.trim()) { toast.error('Please enter Description/Reason'); return; }

  try {
   setSubmitting(true);
   const payload = {
    action: 'create',
    data: {
     Date: formData.date,
     'Payment mode': formData.paymentMode,
     'Group Head': formData.groupHead,
     'Expense Head': formData.expenseHead,
     'Sub Head': formData.subHead,
     'Amount (INR)': parseFloat(formData.amount),
     'Paid To': formData.paidTo,
     Branch: formData.branch,
     'Description / Reason': formData.description,
     'Bill / Receipt': formData.billUrl,
     User: user?.name || 'Admin',
    }
   };

   const res = await fetch(APPSCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
   });
   const result = await res.json();
   if (!result.success) throw new Error(result.error || 'Unknown error');

   toast.success(`Expense of ${formatCurrency(formData.amount)} added!`);

   // Reset form
   setFormData({
    date: getTodayDate(),
    paymentMode: 'Cash',
    groupHead: '',
    expenseHead: '',
    subHead: '',
    amount: '',
    paidTo: '',
    branch: 'Head Office',
    description: '',
    billUrl: ''
   });
   setShowFormModal(false);
   await fetchExpenses();      // refresh list
  } catch (error) {
   toast.error(error.message || 'Error adding expense');
  } finally {
   setSubmitting(false);
  }
 };

 // ---- CSV Export ----
 const exportCSV = () => {
  if (sortedExpenses.length === 0) {
   toast.error('No data to export');
   return;
  }
  const headers = ['VOUCHER', 'DATE', 'PAID TO', 'GROUP', 'EXPENSE', 'SUB HEAD', 'DESCRIPTION', 'AMOUNT', 'MODE', 'BRANCH', 'USER'];
  const rows = sortedExpenses.map(e => [
   e.SN,
   e.Date,
   `"${e['Paid To'] ? String(e['Paid To']).replace(/"/g, '""') : ''}"`,
   `"${e['Group Head'] || ''}"`,
   `"${e['Expense Head'] || ''}"`,
   `"${e['Sub Head'] || ''}"`,
   `"${e['Description / Reason'] ? String(e['Description / Reason']).replace(/"/g, '""') : ''}"`,
   e['Amount (INR)'],
   e['Payment mode'],
   e.Branch,
   e.User || e.user || 'Admin'
  ]);
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Expenses_Report_${filters.fromDate || 'Start'}_to_${filters.toDate || 'End'}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('Report Exported!');
 };

 // ---- Helper to open bill link ----
 const openBill = (url) => {
  if (url) window.open(url, '_blank');
 };

 return (
  <>
  <div className="p-2 md:p-6 space-y-2 md:space-y-6">
   {/* Header – filters & add button (unchanged from original) */}
   {/* Header – filters & add button */}
   <div className="flex flex-col gap-4">
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
     <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold text-slate-900 ">Expenses</h1>
      <p className="text-xs font-semibold text-slate-400 ">Management Dashboard</p>
     </div>
     
     <div className="flex items-center gap-3 w-full lg:w-auto">
       <div className="relative flex-1 lg:w-80 group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
        <input
         type="text"
         placeholder="Search vouchers, persons, heads..."
         value={filters.searchQuery}
         onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
         className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-3 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-semibold text-slate-700 transition-all placeholder:text-slate-300 shadow-sm"
        />
       </div>
       <button
        onClick={() => setShowMobileFilters(!showMobileFilters)}
        className={`lg:hidden p-3 rounded-2xl transition-all active:scale-95 shadow-sm border ${showMobileFilters ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 text-slate-500'}`}
       >
        <Filter size={20} />
       </button>
       <button
        onClick={exportCSV}
        className="hidden lg:flex bg-white border border-slate-100 text-slate-700 px-6 py-3 rounded-2xl font-semibold items-center gap-2 transition-all shadow-sm hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 active:scale-95"
       >
        <Download size={20} className="text-emerald-600" /> Export CSV
       </button>
       <button
        onClick={() => setShowFormModal(true)}
        className="hidden lg:flex bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-semibold items-center gap-2 transition-all shadow-sm shadow-sm hover:-translate-y-1 active:scale-95"
       >
        <Plus size={20} /> Add Expense
       </button>
     </div>
    </div>

    {/* Filters Row */}
    <div className={`${showMobileFilters ? 'grid' : 'hidden lg:flex'} grid-cols-1 sm:grid-cols-2 lg:flex items-center gap-3 w-full`}>
     <div className="flex-1 min-w-[150px]">
       <label className="text-[10px] font-semibold text-slate-400  ml-1 mb-1 block">From Date</label>
       <input
        type="date"
        value={filters.fromDate}
        onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
        className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2.5 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-semibold text-slate-700 transition-all"
       />
     </div>
     <div className="flex-1 min-w-[150px]">
       <label className="text-[10px] font-semibold text-slate-400  ml-1 mb-1 block">To Date</label>
       <input
        type="date"
        value={filters.toDate}
        onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
        className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2.5 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-semibold text-slate-700 transition-all"
       />
     </div>
     <div className="flex-1 min-w-[150px]">
       <label className="text-[10px] font-semibold text-slate-400  ml-1 mb-1 block">Recipient</label>
       <input
        type="text"
        value={filters.paidTo}
        onChange={(e) => setFilters({ ...filters, paidTo: e.target.value })}
        placeholder="Filter by name..."
        className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2.5 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-semibold text-slate-700 transition-all placeholder:text-slate-300"
       />
     </div>
     <div className="flex-1 min-w-[150px]">
       <label className="text-[10px] font-semibold text-slate-400  ml-1 mb-1 block">Payment Mode</label>
       <select
        value={filters.mode}
        onChange={(e) => setFilters({ ...filters, mode: e.target.value })}
        className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2.5 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-semibold text-slate-700 transition-all cursor-pointer appearance-none"
       >
        <option value="">All Modes</option>
        <option value="Cash">Cash</option>
        <option value="Cheque">Cheque</option>
        <option value="Bank Transfer">Bank Transfer</option>
        <option value="Online">Online</option>
       </select>
     </div>
     <div className="flex-1 min-w-[150px]">
       <label className="text-[10px] font-semibold text-slate-400  ml-1 mb-1 block">Sort Order</label>
       <button
        onClick={() => setFilters({ ...filters, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
        className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2 flex items-center justify-between hover:border-indigo-300 transition-all group shadow-sm"
       >
        <span className="text-sm font-semibold text-slate-700">
         {filters.sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
        </span>
        <ArrowUpDown size={16} className={`text-slate-400 group-hover:text-indigo-600 transition-transform ${filters.sortOrder === 'asc' ? '' : 'rotate-180'}`} />
       </button>
     </div>
    </div>
   </div>

  {/* Summary Stats Bar */}
  {!fetching && paginatedExpenses.length > 0 && (
   <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mt-4">
    <div className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md transition-all">
     <p className="text-xs font-semibold text-slate-400  mb-1">Page Total</p>
     <div className="flex items-baseline gap-1">
      <span className="text-lg md:text-2xl font-semibold text-rose-600 ">{formatCurrency(pageTotalAmount)}</span>
      <span className="text-xs font-semibold text-rose-400">INR</span>
     </div>
    </div>
    <div className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md transition-all">
     <p className="text-xs font-semibold text-slate-400  mb-1">Filtered Total</p>
     <div className="flex items-baseline gap-1">
      <span className="text-lg md:text-2xl font-semibold text-slate-900 ">{formatCurrency(totalAmount)}</span>
      <span className="text-xs font-semibold text-slate-400">INR</span>
     </div>
    </div>
    <div className="hidden md:block bg-white border border-slate-100 rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md transition-all">
     <p className="text-xs font-semibold text-slate-400  mb-1">Visible Entries</p>
     <div className="flex items-baseline gap-1">
      <span className="text-lg md:text-2xl font-semibold text-indigo-600 ">{filteredExpenses.length}</span>
      <span className="text-xs font-semibold text-indigo-400">VOUCHERS</span>
     </div>
    </div>
   </div>
  )}

  {/* ---------- Expenses Table (Desktop & Mobile) ---------- */}
  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col mt-4">
    {/* Mobile Cards */}
    <div className="md:hidden flex flex-col gap-2 p-2 overflow-y-auto h-[calc(100vh-210px)] min-h-[250px] bg-white pb-2">
     {fetching ? (
      <div className="text-center py-8 text-gray-400">Loading...</div>
     ) : paginatedExpenses.map((expense, idx) => (
      <div key={expense.SN || idx} className="bg-white rounded-xl border border-indigo-50 shadow-sm p-2.5 relative flex flex-col gap-2">
       <div className="flex justify-between items-center mb-0.5">
        <div className="flex items-center gap-2">
         <div className="w-12 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-semibold shadow-sm">
          {expense.SN ? expense.SN.split('-')[1] || expense.SN : 'N/A'}
         </div>
         <div>
          <h3 className="font-medium text-gray-900 text-[13px] ">{expense['Paid To']}</h3>
          <span className="text-[10px] font-medium text-indigo-500 bg-indigo-50/50 px-1.5 rounded">{expense['Group Head']}</span>
         </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
         <span className="font-medium text-rose-600 text-[15px]">{formatCurrency(expense['Amount (INR)'])}</span>
         <div className="bg-sky-50 text-sky-700 px-1.5 rounded text-[8px] font-medium ">{expense['Payment mode']}</div>
        </div>
       </div>
       
       <div className="text-xs text-gray-500 font-medium mb-1 flex justify-between items-center">
        <span><span className="font-semibold">Exp:</span> {expense['Expense Head']} / {expense['Sub Head']}</span>
        <span><span className="font-semibold">By:</span> {expense['User'] || expense['user'] || 'N/A'}</span>
       </div>

       <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
        <div className="flex items-center gap-1 mb-1 border-b border-slate-100/60 pb-1">
         <Calendar size={11} className="text-indigo-400" />
         <span className="text-xs font-medium text-slate-700">{formatDate(expense.Date)}</span>
         <span className="text-[10px] text-indigo-600 font-semibold ml-auto bg-indigo-50 px-2 py-0.5 rounded-md">ID: {expense.SN}</span>
        </div>
        <p className="text-[10px] text-indigo-500 font-medium mb-0 ">Remarks</p>
        <p className="text-slate-700 text-[11px] leading-snug">{expense['Description / Reason'] || '-'}</p>
       </div>

       {expense['Bill / Receipt'] && (
        <button onClick={() => openBill(expense['Bill / Receipt'])}
         className="text-indigo-600 bg-indigo-50/80 hover:bg-indigo-100 py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 w-full">
         <Eye size={12} /> View Bill
        </button>
       )}
      </div>
     ))}
     {!fetching && filteredExpenses.length === 0 && (
      <div className="p-4 text-center text-gray-500 bg-white rounded-xl">No entries found.</div>
     )}
    </div>

    {/* Desktop Table */}
    <div className="hidden md:block overflow-x-auto overflow-y-auto h-[calc(100vh-300px)] [&::-webkit-scrollbar]:hidden">
     <table className="w-full text-left border-collapse relative">
      <thead className="sticky top-0 z-10 shadow-sm">
       <tr className="border-b border-gray-200 bg-gray-50/50">
        <th className="px-5 py-4 text-xs font-semibold text-gray-500 tracking-wider">Voucher</th>
        <th className="px-5 py-4 text-xs font-semibold text-gray-500 tracking-wider">Date</th>
        <th className="px-5 py-4 text-xs font-semibold text-gray-500 tracking-wider">Category</th>
        <th className="px-5 py-4 text-xs font-semibold text-gray-500 tracking-wider">Description</th>
        <th className="px-5 py-4 text-xs font-semibold text-gray-500 tracking-wider">By</th>
        <th className="px-5 py-4 text-xs font-semibold text-gray-500 tracking-wider text-right">Amount</th>
        <th className="px-5 py-4 text-xs font-semibold text-gray-500 tracking-wider text-center">Mode</th>
        <th className="px-5 py-4 text-xs font-semibold text-gray-500 tracking-wider text-center">Bill</th>
       </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
       {fetching ? (
        <tr>
         <td colSpan="8" className="px-5 py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-gray-500 mt-3 text-sm">Loading expenses...</p>
         </td>
        </tr>
       ) : paginatedExpenses.map((expense, idx) => (
        <tr key={expense.SN || idx} className="hover:bg-gray-50/50 transition-colors group">
         {/* VOUCHER */}
         <td className="px-5 py-4">
          <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-[12px] font-semibold border border-indigo-100 shadow-sm">{expense.SN}</span>
         </td>
         
         {/* DATE */}
         <td className="px-5 py-4">
          <span className="text-[13px] text-gray-600">{formatDate(expense.Date)}</span>
         </td>
         
         {/* CATEGORY */}
         <td className="px-5 py-4">
          <div className="flex flex-col">
           <span className="text-[13px] font-semibold text-gray-900">{expense['Group Head']}</span>
           <span className="text-[12px] text-gray-400">{expense['Expense Head']} / {expense['Sub Head']}</span>
          </div>
         </td>
         
         {/* DESCRIPTION */}
         <td className="px-5 py-4 max-w-[200px]">
          <div className="flex flex-col">
           <span className="text-[13px] font-medium text-gray-900 truncate" title={expense['Description / Reason']}>{expense['Description / Reason'] || '-'}</span>
           <span className="text-[12px] text-gray-400 truncate" title={expense['Paid To']}>{expense['Paid To']}</span>
          </div>
         </td>
         
         {/* BY */}
         <td className="px-5 py-4">
          <div className="flex flex-col">
           <span className="text-[13px] text-gray-500">{expense['User'] || expense['user'] || '-'}</span>
           <span className="text-[12px] text-gray-400">{expense.Branch || 'HO'}</span>
          </div>
         </td>
         
         {/* AMOUNT */}
         <td className="px-5 py-4 text-right">
          <span className="text-[14px] font-semibold text-gray-900">{formatCurrency(expense['Amount (INR)'])}</span>
         </td>
         
         {/* MODE */}
         <td className="px-5 py-4 text-center">
          <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-[11px] font-medium border border-gray-200 tracking-wide">
           {expense['Payment mode'] || 'CASH'}
          </span>
         </td>
         
         {/* BILL */}
         <td className="px-5 py-4 text-center">
          {expense['Bill / Receipt'] ? (
           <button onClick={() => openBill(expense['Bill / Receipt'])} title="View Bill" className="hover:scale-110 transition-transform focus:outline-none">
            <Check size={16} strokeWidth={3} className="text-emerald-500 mx-auto" />
           </button>
          ) : (
           <AlertTriangle size={16} strokeWidth={2.5} className="text-amber-500 mx-auto" />
          )}
         </td>
        </tr>
       ))}
      </tbody>
     </table>
     {!fetching && filteredExpenses.length === 0 && (
      <div className="p-8 text-center text-gray-500">No entries found.</div>
     )}
    </div>

    {/* Pagination footer */}
    <div className="px-2 md:px-4 py-2 border-t border-gray-200 bg-gray-50 flex flex-col lg:flex-row items-center justify-between gap-2 lg:gap-4 rounded-b-lg pb-2 md:pb-3">


     <div className="flex w-full lg:w-auto justify-between items-center order-3 lg:order-1 gap-2">
      <div className="text-xs md:text-sm text-gray-600 flex items-center gap-1.5 md:gap-2 flex-shrink-0">
       <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
        className="border border-gray-300 rounded-md px-1 md:px-2 py-1 focus:outline-none focus:border-indigo-500 bg-white font-medium text-xs md:text-sm shadow-sm text-gray-900">
        <option value={10}>10</option>
        <option value={15}>15</option>
        <option value={20}>20</option>
        <option value={50}>50</option>
        <option value={100}>100</option>
       </select>
       <span className="text-xs md:text-sm text-gray-500 whitespace-nowrap ml-1 font-medium">
        {filteredExpenses.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}-{Math.min(currentPage * itemsPerPage, sortedExpenses.length)} of {sortedExpenses.length}
       </span>
      </div>

      <div className="flex gap-1.5 md:gap-2 justify-end items-center flex-shrink-0 text-gray-700">
       <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
        className="p-1 md:px-2 md:py-1 border border-gray-300 rounded-md bg-white disabled:opacity-50 hover:bg-gray-50 transition shadow-sm text-indigo-600">
        <ChevronLeft size={16} strokeWidth={2.5} />
       </button>
       <div className="flex items-center text-xs md:text-sm font-medium whitespace-nowrap text-gray-500">
        Pg {currentPage}/{totalPages || 1}
       </div>
       <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}
        className="p-1 md:px-2 md:py-1 border border-gray-300 rounded-md bg-white disabled:opacity-50 hover:bg-gray-50 transition shadow-sm text-indigo-600">
        <ChevronRight size={16} strokeWidth={2.5} />
       </button>
      </div>
     </div>
    </div>
   </div>
  </div>

  {/* Form Modal */}
  {showFormModal && (
   <div className="fixed inset-0 lg:left-64 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 ">
    <div className="bg-white rounded-2xl shadow-sm w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20 ">
     {/* Modal Header */}
     <div className="p-8 pb-4 flex justify-between items-center">
      <div className="flex items-center gap-4">
       <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-sm shadow-indigo-200">
        <Plus size={24} />
       </div>
       <div>
        <h2 className="text-2xl font-semibold text-gray-900 ">Add Expense</h2>
        <p className="text-gray-400 text-xs font-semibold ">New Voucher Entry</p>
       </div>
      </div>
      <button onClick={() => setShowFormModal(false)} className="p-2 hover:bg-slate-100 rounded-xl text-gray-400 transition-colors">
       <X size={24} />
      </button>
     </div>

     <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-8 pt-2 scrollbar-hide space-y-6">
       {/* Date & Payment Mode */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
         <label className="text-xs font-semibold text-slate-900  ml-1 mb-1 block">Date *</label>
         <input type="date" value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-gray-900" required />
        </div>
        <div>
         <label className="text-xs font-semibold text-slate-900  ml-1 mb-1 block">Payment Mode *</label>
         <select value={formData.paymentMode}
          onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
          className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-gray-900 cursor-pointer appearance-none" required>
          {['Cash', 'Cheque', 'Bank Transfer', 'Online'].map((m, i) => <option key={i} value={m}>{m}</option>)}
         </select>
        </div>
       </div>

       {/* Group & Expense Head */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
         <label className="text-xs font-semibold text-slate-900  ml-1 mb-1 block">Group Head *</label>
         <select value={formData.groupHead}
          onChange={(e) => setFormData({ ...formData, groupHead: e.target.value })}
          className={`w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold cursor-pointer appearance-none ${!formData.groupHead ? 'text-gray-400' : 'text-gray-900'}`} required>
          <option value="">-- Select Group --</option>
          {groupHeads.map((g, i) => <option key={i} value={g}>{g}</option>)}
         </select>
        </div>
        <div>
         <label className="text-xs font-semibold text-slate-900  ml-1 mb-1 block">Expense Head *</label>
         <select value={formData.expenseHead}
          onChange={(e) => setFormData({ ...formData, expenseHead: e.target.value })}
          className={`w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold cursor-pointer appearance-none ${!formData.expenseHead ? 'text-gray-400' : 'text-gray-900'}`} required>
          <option value="">-- Select Expense Head --</option>
          {expenseHeads.map((h, i) => <option key={i} value={h}>{h}</option>)}
         </select>
        </div>
       </div>

       {/* Sub Head & Amount */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
         <label className="text-xs font-semibold text-slate-900  ml-1 mb-1 block">Sub Head *</label>
         <select value={formData.subHead}
          onChange={(e) => setFormData({ ...formData, subHead: e.target.value })}
          className={`w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold cursor-pointer appearance-none ${!formData.subHead ? 'text-gray-400' : 'text-gray-900'}`} required>
          <option value="">-- Select Sub Head --</option>
          {subHeads.map((s, i) => <option key={i} value={s}>{s}</option>)}
         </select>
        </div>
        <div>
         <label className="text-xs font-semibold text-slate-900  ml-1 mb-1 block">Amount (INR) *</label>
         <input type="number" step="0.01" min="0" value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          placeholder="0.00"
          className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-gray-900" required />
        </div>
       </div>

       {/* Paid To & Branch */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
         <label className="text-xs font-semibold text-slate-900  ml-1 mb-1 block">Paid To *</label>
         <input type="text" value={formData.paidTo}
          onChange={(e) => setFormData({ ...formData, paidTo: e.target.value })}
          placeholder="Vendor / Person name"
          className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-gray-900" required />
        </div>
        <div>
         <label className="text-xs font-semibold text-slate-900  ml-1 mb-1 block">Branch</label>
         <input type="text" value={formData.branch}
          onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
          className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-gray-900" />
        </div>
       </div>

       {/* Description */}
       <div>
        <label className="text-xs font-semibold text-slate-900  ml-1 mb-1 block">Description / Reason *</label>
        <textarea value={formData.description}
         onChange={(e) => setFormData({ ...formData, description: e.target.value })}
         placeholder="Brief reason for the expense..."
         rows="3"
         className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-gray-900 resize-none" required />
       </div>

       <div className="space-y-4">
        <label className="text-xs font-semibold text-slate-900  ml-1 mb-1 block">Upload Bill / Receipt</label>
        <div className="relative group">
         <input
          type="file"
          accept="image/*,application/pdf"
          onChange={async (e) => {
           const file = e.target.files[0];
           if (!file) return;

           setIsUploading(true);
           try {
            const reader = new FileReader();
            const base64 = await new Promise((resolve, reject) => {
             reader.onload = () => resolve(reader.result);
             reader.onerror = reject;
             reader.readAsDataURL(file);
            });

            const uploadRes = await fetch(APPSCRIPT_URL, {
             method: 'POST',
             body: JSON.stringify({
              action: 'uploadFile',
              file: (base64).split(',')[1],
              fileName: file.name,
              mimeType: file.type || 'application/pdf',
              folderId: import.meta.env.VITE_BILL_DRIVE || '1IB_JCj4_7wEMWycIAYKH8bngYOj1M7rq'
             })
            });

            const uploadResult = await uploadRes.json();
            if (!uploadResult.success) {
             throw new Error(uploadResult.error || 'Upload failed');
            }

            const driveUrl = uploadResult.data?.url || uploadResult.url;
            if (driveUrl) {
             setFormData(prev => ({ ...prev, billUrl: driveUrl }));
             toast.success('Bill uploaded!');
            }
           } catch (err) {
            toast.error('File upload failed: ' + err.message);
            e.target.value = '';
           } finally {
            setIsUploading(false);
           }
          }}
          className="w-full bg-slate-50 border-2 border-dashed border-slate-100 rounded-2xl px-5 py-8 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-gray-500 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file: file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
         />
         {formData.billUrl && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 animate-in zoom-in duration-300">
           <Check size={24} />
          </div>
         )}
        </div>
       </div>
      </div>

      {/* Modal Footer */}
      <div className="p-8 border-t border-slate-50 bg-white flex gap-4">
       <button
        type="submit"
        onClick={handleSubmit}
        disabled={submitting || isUploading}
        className="flex-1 flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-semibold shadow-sm shadow-sm transition-all active:scale-95 disabled:opacity-50"
       >
        {submitting ? 'Processing...' : isUploading ? 'Uploading...' : 'Submit Expense'}
       </button>
       <button
        type="button"
        onClick={() => setShowFormModal(false)}
        className="px-8 py-4 bg-white border border-slate-100 rounded-2xl font-semibold text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
       >
        Abort
       </button>
      </div>
     </form>
    </div>
   </div>
  )}
 </>
 );
}
