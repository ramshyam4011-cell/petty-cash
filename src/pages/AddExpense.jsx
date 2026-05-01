import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Plus, Filter, Search, ChevronLeft, ChevronRight, X, Eye, Calendar, Check, AlertTriangle
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
    billUrl: ''   // <-- Bill / Receipt link (paste URL)
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
    searchQuery: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Group -> Expense mapping
  const groupToExpenseMapping = {
    'Office Expenses': ['Stationery', 'Printing & Postage', 'Pantry & Refreshments'],
    'Travel & Conveyance': ['Local Travel', 'Outstation Travel', 'Fuel'],
    'Marketing & Promotion': ['Events & Campaigns', 'Digital Marketing'],
    'Utilities': ['Electricity', 'Internet & Telephone'],
    'Maintenance & Repairs': ['Office Equipment', 'Vehicle Maintenance']
  };

  // Expense -> Sub-Head mapping
  const expenseToSubHeadMapping = {
    'Stationery': ['Pens & Notebooks', 'Files & Folders'],
    'Printing & Postage': ['Printing Charges', 'Courier Charges'],
    'Pantry & Refreshments': ['Tea & Coffee', 'Snacks'],
    'Local Travel': ['Auto/Cab Fare', 'Metro/Bus Fare'],
    'Outstation Travel': ['Train Tickets', 'Flight Tickets', 'Hotel Stay'],
    'Fuel': ['Petrol', 'Diesel'],
    'Events & Campaigns': ['Banner & Flex'],
    'Digital Marketing': ['Social Media Ads'],
    'Electricity': ['Monthly Bill'],
    'Internet & Telephone': ['Broadband'],
    'Office Equipment': ['Printer Repair'],
    'Vehicle Maintenance': ['Tyre & Service']
  };

  const expenseHeads = formData.groupHead ? (groupToExpenseMapping[formData.groupHead] || []) : [];
  const subHeads = formData.expenseHead ? (expenseToSubHeadMapping[formData.expenseHead] || []) : [];

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

  useEffect(() => { fetchExpenses(); }, []);
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

  const sortedExpenses = filteredExpenses.slice().reverse();
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
      await fetchExpenses();           // refresh list
    } catch (error) {
      toast.error(error.message || 'Error adding expense');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Helper to open bill link ----
  const openBill = (url) => {
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="p-2 md:p-6 space-y-2 md:space-y-6">
      {/* Header – filters & add button (unchanged from original) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 lg:gap-4 w-full">
        <div className="flex flex-col lg:flex-row w-full gap-2 lg:gap-3 items-center">

          {/* Search + Mobile filter & add */}
          <div className="flex items-center gap-2 w-full lg:w-auto lg:flex-[1.5]">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-2.5 top-[9px] lg:top-[11px] text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Search all fields..."
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                className="w-full bg-white border border-gray-300 rounded-lg lg:rounded pl-8 pr-2 py-1.5 focus:outline-none focus:border-sky-500 text-xs md:text-sm h-[32px] md:h-[38px]"
              />
            </div>
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`lg:hidden flex items-center justify-center rounded-lg shadow-sm h-[32px] w-[32px] flex-shrink-0 transition ${showMobileFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-white border border-gray-300 text-gray-600'}`}
            >
              <Filter size={14} />
            </button>
            <button
              onClick={() => setShowFormModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center lg:hidden h-[32px] w-[32px] flex-shrink-0 shadow-sm"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Filters (responsive) */}
          <div className={`${showMobileFilters ? 'grid' : 'hidden'} lg:flex grid-cols-2 md:grid-cols-4 lg:flex-row gap-2 w-full lg:w-auto lg:flex-[4] items-center`}>
            <input
              type="text" placeholder="From Date"
              onFocus={(e) => (e.target.type = 'date')}
              onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
              value={filters.fromDate}
              onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
              className="w-full bg-white border border-gray-300 rounded-lg lg:rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-[11px] md:text-sm h-[32px] md:h-[38px]"
            />
            <input
              type="text" placeholder="To Date"
              onFocus={(e) => (e.target.type = 'date')}
              onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
              value={filters.toDate}
              onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
              className="w-full bg-white border border-gray-300 rounded-lg lg:rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-[11px] md:text-sm h-[32px] md:h-[38px]"
            />
            <input
              type="text" value={filters.paidTo}
              onChange={(e) => setFilters({ ...filters, paidTo: e.target.value })}
              placeholder="Search person..."
              className="w-full bg-white border border-gray-300 rounded-lg lg:rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-[11px] md:text-sm h-[32px] md:h-[38px]"
            />
            <select
              value={filters.mode}
              onChange={(e) => setFilters({ ...filters, mode: e.target.value })}
              className="w-full bg-white border border-gray-300 rounded-lg lg:rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-[11px] md:text-sm h-[32px] md:h-[38px] text-gray-900"
            >
              <option value="">All Modes</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Online">Online</option>
            </select>
          </div>
        </div>

        {/* Desktop Add Button */}
        <button
          onClick={() => setShowFormModal(true)}
          className="hidden lg:flex bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 h-[38px] rounded-lg font-semibold items-center justify-center gap-2 transition shadow-sm w-full lg:w-auto flex-shrink-0 mt-2 lg:mt-0"
        >
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {/* Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 md:p-8 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add Expense</h2>
              <button onClick={() => setShowFormModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Date & Payment Mode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Date *</label>
                  <input type="date" value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white shadow-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Mode *</label>
                  <select value={formData.paymentMode}
                    onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white shadow-sm text-gray-900" required>
                    {['Cash', 'Cheque', 'Bank Transfer', 'Online'].map((m, i) => <option key={i} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Group & Expense Head */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Group Head *</label>
                  <select value={formData.groupHead}
                    onChange={(e) => setFormData({ ...formData, groupHead: e.target.value, expenseHead: '', subHead: '' })}
                    className={`w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white shadow-sm ${!formData.groupHead ? 'text-gray-400' : 'text-gray-900'}`} required>
                    <option value="">-- Select Group --</option>
                    {Object.keys(groupToExpenseMapping).map((g, i) => <option key={i} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Expense Head *</label>
                  <select value={formData.expenseHead}
                    onChange={(e) => setFormData({ ...formData, expenseHead: e.target.value, subHead: '' })}
                    className={`w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white shadow-sm ${!formData.expenseHead ? 'text-gray-400' : 'text-gray-900'}`} required>
                    <option value="">-- Select Expense Head --</option>
                    {expenseHeads.map((h, i) => <option key={i} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              {/* Sub Head & Amount */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Sub Head *</label>
                  <select value={formData.subHead}
                    onChange={(e) => setFormData({ ...formData, subHead: e.target.value })}
                    className={`w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white shadow-sm ${!formData.subHead ? 'text-gray-400' : 'text-gray-900'}`} required>
                    <option value="">-- Select Sub Head --</option>
                    {subHeads.map((s, i) => <option key={i} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Amount (INR) *</label>
                  <input type="number" step="0.01" min="0" value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white shadow-sm" required />
                </div>
              </div>

              {/* Paid To & Branch */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Paid To *</label>
                  <input type="text" value={formData.paidTo}
                    onChange={(e) => setFormData({ ...formData, paidTo: e.target.value })}
                    placeholder="Vendor / Person name"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white shadow-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Branch</label>
                  <input type="text" value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white shadow-sm" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description / Reason *</label>
                <textarea value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief reason for the expense..."
                  rows="3"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white shadow-sm" required />
              </div>

              {/* Bill / Receipt File Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Upload Bill / Receipt</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    try {
                      // Show a temporary status if you like
                      const reader = new FileReader();
                      reader.onload = async (evt) => {
                        const base64 = evt.target.result;               // this is the base64 string
                        const mimeType = file.type || 'application/pdf';

                        // Upload to Drive via Apps Script
                        const uploadRes = await fetch(APPSCRIPT_URL, {
                          method: 'POST',
                          body: JSON.stringify({
                            action: 'uploadFile',
                            file: base64,
                            fileName: file.name,
                            mimeType: mimeType,
                            folderId: import.meta.env.VITE_BILL_DRIVE || '1IB_JCj4_7wEMWycIAYKH8bngYOj1M7rq'
                          })
                        });

                        const uploadResult = await uploadRes.json();
                        if (!uploadResult.success) {
                          toast.error('Failed to upload file: ' + uploadResult.error);
                          return;
                        }

                        // Store the Drive link in form state – this is what will go into the sheet
                        setFormData(prev => ({ ...prev, billUrl: uploadResult.data.url }));
                        toast.success('File uploaded successfully!');
                      };

                      reader.readAsDataURL(file);  // we still need the base64 for transfer
                    } catch (err) {
                      toast.error('Error processing file.');
                      console.error(err);
                    }
                  }}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 bg-white shadow-sm text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-4 pt-4">
                <button type="submit" disabled={submitting}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Submit Expense'}
                </button>
                <button type="button" onClick={() => setShowFormModal(false)}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Expenses Table (Desktop & Mobile) ---------- */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col mt-2">
        {/* Mobile Cards */}
        <div className="md:hidden flex flex-col gap-2 p-2 overflow-y-auto h-[calc(100vh-210px)] min-h-[250px] bg-slate-50/50 pb-2">
          {fetching ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : paginatedExpenses.map((expense, idx) => (
            <div key={expense.SN || idx} className="bg-white rounded-xl border border-indigo-50 shadow-sm p-2.5 relative flex flex-col gap-2">
              <div className="flex justify-between items-center mb-0.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px]">
                    {expense.SN ? (expense.SN.split('-')[1] || expense.SN.slice(-2)) : 'N/A'}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 text-[13px] uppercase">{expense['Paid To']}</h3>
                    <span className="text-[9px] font-medium text-indigo-500 uppercase bg-indigo-50/50 px-1.5 rounded">{expense['Group Head']}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-medium text-rose-600 text-[15px]">{formatCurrency(expense['Amount (INR)'])}</span>
                  <div className="bg-sky-100/80 text-sky-700 px-1.5 rounded text-[8px] font-medium uppercase">{expense['Payment mode']}</div>
                </div>
              </div>
              
              <div className="text-[10px] text-gray-500 font-medium mb-1 flex justify-between items-center">
                <span><span className="font-semibold">Exp:</span> {expense['Expense Head']} / {expense['Sub Head']}</span>
                <span><span className="font-semibold">By:</span> {expense['User'] || expense['user'] || 'N/A'}</span>
              </div>

              <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-lg p-2 border border-slate-100">
                <div className="flex items-center gap-1 mb-1 border-b border-slate-200/60 pb-1">
                  <Calendar size={11} className="text-indigo-400" />
                  <span className="text-[10px] font-medium text-slate-700">{formatDate(expense.Date)}</span>
                  <span className="text-[9px] text-slate-400 font-medium ml-auto">REF: {expense.SN}</span>
                </div>
                <p className="text-[9px] text-indigo-500 font-medium mb-0 uppercase">Remarks</p>
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
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Voucher</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">By</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Mode</th>
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Bill</th>
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
                    <span className="text-[13px] font-mono text-gray-500">{expense.SN}</span>
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
                    <span className="text-[14px] font-bold text-gray-900">{formatCurrency(expense['Amount (INR)'])}</span>
                  </td>
                  
                  {/* MODE */}
                  <td className="px-5 py-4 text-center">
                    <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-[11px] font-medium border border-gray-200 uppercase tracking-wide">
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
          {paginatedExpenses.length > 0 && (
            <div className="flex w-full lg:w-auto justify-between lg:hidden items-center text-xs border-b border-gray-200 pb-2 mb-1 px-1">
              <div><span className="text-gray-500 text-[9px] uppercase">Page Total</span> <span className="font-medium text-rose-600 text-[13px]">{formatCurrency(pageTotalAmount)}</span></div>
              <div className="text-right"><span className="text-gray-500 text-[9px] uppercase">Filtered Total</span> <span className="font-medium text-gray-900 text-[13px]">{formatCurrency(totalAmount)}</span></div>
            </div>
          )}
          {paginatedExpenses.length > 0 && (
            <div className="hidden lg:flex items-center gap-6 text-sm order-2">
              <div><span className="text-gray-600">Page Total:</span> <span className="font-semibold text-rose-600 ml-1">{formatCurrency(pageTotalAmount)}</span></div>
              <div className="w-px h-4 bg-gray-300"></div>
              <div><span className="text-gray-500 text-xs">Filtered Total:</span> <span className="font-semibold text-gray-900">{formatCurrency(totalAmount)}</span></div>
            </div>
          )}

          <div className="flex w-full lg:w-auto justify-between items-center order-3 lg:order-1 gap-2">
            <div className="text-[10px] md:text-sm text-gray-600 flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="border border-gray-300 rounded-md px-1 md:px-2 py-1 focus:outline-none focus:border-indigo-500 bg-white font-medium text-[10px] md:text-sm shadow-sm text-gray-900">
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-[10px] md:text-sm text-gray-500 whitespace-nowrap ml-1 font-medium">
                {filteredExpenses.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}-{Math.min(currentPage * itemsPerPage, sortedExpenses.length)} of {sortedExpenses.length}
              </span>
            </div>

            <div className="flex gap-1.5 md:gap-2 justify-end items-center flex-shrink-0 text-gray-700">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="p-1 md:px-2 md:py-1 border border-gray-300 rounded-md bg-white disabled:opacity-50 hover:bg-gray-50 transition shadow-sm text-indigo-600">
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>
              <div className="flex items-center text-[10px] md:text-sm font-medium whitespace-nowrap text-gray-500">
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
  );
}