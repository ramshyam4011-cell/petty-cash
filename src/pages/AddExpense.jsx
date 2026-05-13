import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  Plus, Search, X, Eye, Calendar, Check, ArrowUpDown, TrendingUp, TrendingDown, Trash2, Database, Save, RefreshCcw, Filter, User, Building2, Upload, FileText, Paperclip, Loader2
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { formatDate, formatCurrency, getTodayDate, getGoogleSheetTimestamp, fileToBase64, compressImage } from '../utils/helpers';

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;


// Drive Folder IDs
const EXPENSE_FOLDER_ID = '1bBqruNp7BSsGL217YrJexi49K9gUAYK2';
const RECEIVE_FOLDER_ID = '1U7iXD3-_v3dKn-gyv5M3eG3HxV01mTmR';

export default function AddExpense() {
  const { user } = useAuthStore();
  const fileInputRef = useRef(null);

  // ---- State ----
  const [expenses, setExpenses] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [masterData, setMasterData] = useState([]); 
  const [activeType, setActiveType] = useState('EXPENSE'); 
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [processingStatus, setProcessingStatus] = useState('');

  // Form States
  const [expenseForm, setExpenseForm] = useState({
    date: getTodayDate(),
    paymentMode: 'Cash',
    groupHead: '',
    expenseHead: '',
    subHead: '',
    amount: '',
    paidTo: '',
    branch: '',
    description: ''
  });

  const [receiveForm, setReceiveForm] = useState({
    valueDate: getTodayDate(),
    transactionType: 'Cash Received (+)',
    amount: '',
    receivedFrom: '',
    branch: '',
    expenseHead: '',
    subHead: '',
  });

  const [showFormModal, setShowFormModal] = useState(false);
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', searchQuery: '', flow: 'ALL', sortOrder: 'desc' });

  // ---- Fetch Data ----
  const fetchMasterData = async () => {
    try {
      const res = await fetch(APPSCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'readMaster' }) });
      const json = await res.json();
      if (json.success) setMasterData(json.data || []);
    } catch { console.error('Master data sync failed'); }
  };

  const fetchExpenses = async () => {
    try {
      setFetching(true);
      const res = await fetch(APPSCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'read' }) });
      const json = await res.json();
      if (json.success) setExpenses((json.data || []).filter(e => e['Delete Status'] !== 'DELETED'));
    } catch { toast.error('Error loading ledger'); } finally { setFetching(false); }
  };

  useEffect(() => { fetchExpenses(); fetchMasterData(); }, []);

  // Cascading — filter group heads by user's assigned list (empty = all)
  const allGroupHeads = useMemo(() => [...new Set(masterData.map(d => d['Group Head'] || d['Group Heads']).filter(Boolean))].sort(), [masterData]);

  const groupHeads = useMemo(() => {
    const userGroupHeads = user?.groupHeads || [];
    if (userGroupHeads.length === 0) return allGroupHeads;
    return allGroupHeads.filter(g => userGroupHeads.includes(g));
  }, [allGroupHeads, user]);

  const expenseHeads = useMemo(() => {
    if (!expenseForm.groupHead) return [];
    return [...new Set(masterData.filter(d => (d['Group Head'] || d['Group Heads']) === expenseForm.groupHead).map(d => d['Expense Head'] || d['Expense Heads']).filter(Boolean))].sort();
  }, [masterData, expenseForm.groupHead]);
  const subHeads = useMemo(() => {
    if (!expenseForm.expenseHead) return [];
    return [...new Set(masterData.filter(d => (d['Expense Head'] || d['Expense Heads']) === expenseForm.expenseHead).map(d => d['Sub Head'] || d['Sub Heads']).filter(Boolean))].sort();
  }, [masterData, expenseForm.expenseHead]);
  
  const vendorSuggestions = useMemo(() => {
    return [...new Set(masterData.map(d => d['Vendor'] || d['Vendors'] || d['Vendore']).filter(Boolean))].sort();
  }, [masterData]);

  const branches = useMemo(() => {
    return [...new Set(masterData.map(d => d['Branch'] || d['Branches']).filter(Boolean))].sort();
  }, [masterData]);

  // Cascading for RECEIVE form — Expense Heads (all groups, not user-restricted)
  const receiveExpenseHeads = useMemo(() => {
    return [...new Set(masterData.map(d => d['Expense Head'] || d['Expense Heads']).filter(Boolean))].sort();
  }, [masterData]);

  const receiveSubHeads = useMemo(() => {
    if (!receiveForm.expenseHead) return [];
    return [...new Set(masterData.filter(d => (d['Expense Head'] || d['Expense Heads']) === receiveForm.expenseHead).map(d => d['Sub Head'] || d['Sub Heads']).filter(Boolean))].sort();
  }, [masterData, receiveForm.expenseHead]);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (selectedFiles.length + files.length > 5) {
      toast.error('Max 5 files allowed');
      return;
    }
    const newFiles = [];
    for (const file of files) {
      const base64 = await compressImage(file);
      newFiles.push({ name: file.name, base64, type: file.type });
    }
    setSelectedFiles([...selectedFiles, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx) => setSelectedFiles(selectedFiles.filter((_, i) => i !== idx));

  const handleDirectSubmit = async () => {
    const form = activeType === 'EXPENSE' ? expenseForm : receiveForm;
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error('Valid amount required');
      return;
    }
    if (activeType === 'EXPENSE' && (!form.groupHead || !form.expenseHead)) {
      toast.error('Category selection required');
      return;
    }
    if (!form.branch) {
      toast.error('Branch selection required');
      return;
    }

    setSubmitting(true);
    setProcessingStatus('Connecting to Cloud Ledger...');
    
    try {
      let payload = {};
      if (activeType === 'EXPENSE') {
        payload = {
          'Date': expenseForm.date,
          'Payment mode': expenseForm.paymentMode,
          'Group Head': expenseForm.groupHead,
          'Expense Head': expenseForm.expenseHead,
          'Sub Head': expenseForm.subHead || '-',
          'Amount (INR)': parseFloat(expenseForm.amount),
          'Paid To': expenseForm.paidTo,
          'Branch': expenseForm.branch,
          'Description / Reason': expenseForm.description,
          'user': user?.id || 'admin',
          'Reported by': user?.reportedBy || '',
          'Status': 'PENDING',
          'Delete Status': 'ACTIVE',
          'Flow': 'OUT'
        };
      } else {
        const isCashReceive = receiveForm.transactionType === 'Cash Received (+)';
        payload = {
          'Date': receiveForm.valueDate,
          'Payment mode': receiveForm.transactionType,
          'Group Head': 'INCOME',
          'Expense Head': receiveForm.expenseHead || 'RECEIVE',
          'Sub Head': receiveForm.subHead || '-',
          'Amount (INR)': parseFloat(receiveForm.amount),
          'Paid To': receiveForm.receivedFrom || user?.id || 'admin',
          'Branch': receiveForm.branch,
          'Description / Reason': receiveForm.receivedFrom,
          'user': user?.id || 'admin',
          // Cash/Online/UPI receives need approval; Transfer is auto-approved (internal movement)
          'Status': isCashReceive ? 'PENDING' : 'APPROVED',
          'Approval / Reject - Remark': isCashReceive ? '' : 'Auto-approved',
          'Delete Status': 'ACTIVE',
          'Flow': 'IN',
          'Reported by': user?.reportedBy || ''
        };
      }

      let joinedUrls = '';
      if (selectedFiles.length > 0) {
        const uploadedUrls = [];
        const targetFolderId = activeType === 'RECEIVE' ? RECEIVE_FOLDER_ID : EXPENSE_FOLDER_ID;
        for (let i = 0; i < selectedFiles.length; i++) {
          const f = selectedFiles[i];
          setProcessingStatus(`Uploading proof ${i + 1}/${selectedFiles.length}...`);
          const res = await fetch(APPSCRIPT_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'uploadfile', file: f.base64, mimeType: f.type, fileName: f.name, folderId: targetFolderId }) 
          });
          const json = await res.json();
          if (json.success) uploadedUrls.push(json.data.url);
        }
        joinedUrls = uploadedUrls.join(', ');
      }

      setProcessingStatus('Committing transaction...');
      const finalPayload = { ...payload, 'Bill / Receipt': joinedUrls };
      const res = await fetch(APPSCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'create', data: finalPayload }) });
      const json = await res.json();

      if (json.success) {
        toast.success('Transaction Submitted Successfully');
        setShowFormModal(false);
        fetchExpenses();
        setExpenseForm({...expenseForm, amount:'', description:'', paidTo:''});
        setReceiveForm({...receiveForm, amount:'', receivedFrom:'', expenseHead:'', subHead:''});
        setSelectedFiles([]);
      } else {
        throw new Error(json.error || 'Server error');
      }
    } catch (err) {
      toast.error('Submission failed: ' + err.message);
    } finally {
      setSubmitting(false);
      setProcessingStatus('');
    }
  };

  const scopedExpenses = useMemo(() => {
    const role = user?.role?.toUpperCase();
    const userId = user?.id || '';
    return expenses.filter(e => {
      if (role === 'SUPER_ADMIN') return true;
      // ADMIN: only see their OWN entries + entries reported BY them
      if (role === 'ADMIN') return e['Reported by'] === userId || e['user'] === userId;
      // USER: only see their own entries
      return e['user'] === userId;
    });
  }, [expenses, user]);

  const sortedExpenses = useMemo(() => {
    return [...scopedExpenses]
      .filter(e => {
        if (filters.fromDate && e.Date < filters.fromDate) return false;
        if (filters.toDate && e.Date > filters.toDate) return false;
        if (filters.flow !== 'ALL' && e.Flow !== filters.flow) return false;
        if (filters.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          return Object.values(e).some(v => String(v).toLowerCase().includes(q));
        }
        return true;
      })
      .sort((a, b) => filters.sortOrder === 'asc' ? (a.Date || '').localeCompare(b.Date || '') : (b.Date || '').localeCompare(a.Date || ''));
  }, [scopedExpenses, filters]);

  const stats = useMemo(() => {
    const totalIn = scopedExpenses.filter(e => e.Flow === 'IN' && e.Status === 'APPROVED').reduce((s, e) => s + (parseFloat(e['Amount (INR)']) || 0), 0);
    const totalOut = scopedExpenses.filter(e => e.Flow === 'OUT' && e.Status === 'APPROVED').reduce((s, e) => s + (parseFloat(e['Amount (INR)']) || 0), 0);
    return { totalIn, totalOut, balance: totalIn - totalOut };
  }, [scopedExpenses]);

  return (
    <>
    <div className="max-w-7xl mx-auto space-y-6 p-2">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Entry</h1>
          <p className="text-xs sm:text-sm text-slate-500">Document financial transactions</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button onClick={() => { setActiveType('EXPENSE'); setSelectedFiles([]); setShowFormModal(true); }} className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95">
            <TrendingDown size={16} /> New Expense
          </button>
          <button onClick={() => { setActiveType('RECEIVE'); setSelectedFiles([]); setShowFormModal(true); }} className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95">
            <TrendingUp size={16} /> New Receive
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between sm:block">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest sm:mb-1">Inflow</p>
          <p className="text-lg font-bold text-emerald-600">+{formatCurrency(stats.totalIn)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between sm:block">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest sm:mb-1">Outflow</p>
          <p className="text-lg font-bold text-rose-600">-{formatCurrency(stats.totalOut)}</p>
        </div>
        <div className="bg-slate-900 p-4 rounded-xl shadow-md border border-slate-800 flex items-center justify-between sm:block">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest sm:mb-1">Net Position</p>
          <p className="text-lg font-bold text-white">{formatCurrency(stats.balance)}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 sm:p-3 flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 flex-1 shadow-sm">
          <Search size={14} className="text-slate-400" />
          <input type="text" placeholder="Search entries..." value={filters.searchQuery} onChange={e => setFilters({...filters, searchQuery: e.target.value})} className="text-xs font-bold text-slate-700 bg-transparent outline-none w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={filters.flow} onChange={e => setFilters({...filters, flow: e.target.value})} className="flex-1 sm:flex-none text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none shadow-sm">
            <option value="ALL">All Flows</option>
            <option value="IN">Inflows</option>
            <option value="OUT">Outflows</option>
          </select>
          <input type="date" value={filters.fromDate} onChange={e => setFilters({...filters, fromDate: e.target.value})} className="flex-1 sm:flex-none text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-2 outline-none shadow-sm" />
          <input type="date" value={filters.toDate} onChange={e => setFilters({...filters, toDate: e.target.value})} className="flex-1 sm:flex-none text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-2 outline-none shadow-sm" />
          <button onClick={fetchExpenses} className="p-2 text-slate-500 hover:text-blue-600 transition-colors bg-white rounded-lg border border-slate-200 shadow-sm">
            <RefreshCcw size={16} />
          </button>
        </div>
      </div>

      {/* Table / List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-20">
        {/* Desktop View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[10px] tracking-widest font-black">
              <tr>
                <th className="px-6 py-3">Voucher</th>
                <th className="px-6 py-3">Date / Flow</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Details</th>
                <th className="px-6 py-3">By</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fetching ? (
                 <tr><td colSpan="8" className="py-20 text-center"><RefreshCcw className="animate-spin inline-block text-slate-300"/></td></tr>
              ) : sortedExpenses.map((e, idx) => {
                const isIN = e.Flow === 'IN';
                return (
                  <tr key={idx} className={`hover:bg-slate-50/50 transition-all ${isIN ? 'border-l-2 border-emerald-500' : 'border-l-2 border-rose-500'}`}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 leading-none">VCH</span>
                        <span className="text-xs font-black text-blue-700">#{e.SN?.split('-').pop()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[11px] font-bold text-slate-600">{formatDate(e.Date)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-[11px] uppercase truncate max-w-[120px]">{e['Group Head']}</span>
                        <span className="text-[10px] text-slate-400">{e['Expense Head']}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col max-w-[150px]">
                        <span className="font-bold text-slate-900 text-xs truncate">{e['Paid To']}</span>
                        <span className="text-[10px] text-slate-400 line-clamp-1">{e['Description / Reason']}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-500">{e['user']}</td>
                    <td className="px-6 py-4 text-right">
                       <span className={`font-black ${isIN ? 'text-emerald-600' : 'text-rose-600'}`}>
                         {isIN ? '+' : '-'}{formatCurrency(e['Amount (INR)'])}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                         e.Status === 'APPROVED' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                         e.Status === 'REJECTED' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                         'bg-slate-50 border-slate-200 text-slate-400'
                       }`}>{e.Status || 'PENDING'}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <div className="flex justify-center gap-2">
                        {e['Bill / Receipt'] && (
                          <div className="flex gap-1">
                            {e['Bill / Receipt'].split(',').map((url, i) => (
                              <a key={i} href={url.trim()} target="_blank" rel="noreferrer" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all"><Eye size={14} /></a>
                            ))}
                          </div>
                        )}
                        <button 
                          onClick={async () => {
                            if(window.confirm('Delete request?')) {
                              toast.loading('Processing...', { id: 'del' });
                              await fetch(APPSCRIPT_URL, { method:'POST', body:JSON.stringify({action:'update', sn:e.SN, deleteStatus:'PENDING_DELETE', deletePlanned:getGoogleSheetTimestamp(), deletedBy:user?.id, isDeleteAction:true})});
                              toast.success('Requested', { id: 'del' }); fetchExpenses();
                            }
                          }}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-all"
                        ><Trash2 size={14} /></button>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View Card List */}
        <div className="sm:hidden divide-y divide-slate-100">
          {fetching ? (
            <div className="py-10 text-center"><RefreshCcw className="animate-spin inline-block text-slate-300"/></div>
          ) : sortedExpenses.map((e, idx) => {
            const isIN = e.Flow === 'IN';
            return (
              <div key={idx} className={`p-4 space-y-3 relative active:bg-slate-50 ${isIN ? 'border-l-4 border-emerald-500' : 'border-l-4 border-rose-500'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{formatDate(e.Date)} • {e['user']}</p>
                    <p className="font-black text-slate-900 text-sm uppercase">{e['Group Head']}</p>
                    <p className="text-xs font-semibold text-slate-500 truncate max-w-[200px]">{e['Description / Reason'] || e['Paid To']}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-base ${isIN ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isIN ? '+' : '-'}{formatCurrency(e['Amount (INR)'])}
                    </p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${
                      e.Status === 'APPROVED' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                      e.Status === 'REJECTED' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                      'bg-slate-50 border-slate-200 text-slate-400'
                    }`}>
                      {e.Status || 'PENDING'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">#{e.SN?.split('-').pop()}</span>
                  <div className="flex gap-3">
                    {e['Bill / Receipt'] && (
                      <a href={e['Bill / Receipt'].split(',')[0]} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase">
                        <Paperclip size={12} /> View Bill
                      </a>
                    )}
                    <button 
                      onClick={async () => {
                        if(window.confirm('Delete request?')) {
                          toast.loading('Processing...', { id: 'del' });
                          await fetch(APPSCRIPT_URL, { method:'POST', body:JSON.stringify({action:'update', sn:e.SN, deleteStatus:'PENDING_DELETE', deletePlanned:getGoogleSheetTimestamp(), deletedBy:user?.id, isDeleteAction:true})});
                          toast.success('Requested', { id: 'del' }); fetchExpenses();
                        }
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-rose-600 uppercase"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Modal */}
      {showFormModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-end sm:items-center justify-center z-[9999] sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden border border-slate-200 h-[90vh] sm:h-auto sm:max-h-[92vh]">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <h2 className="font-black text-slate-900 uppercase tracking-tight text-sm sm:text-base">{activeType === 'RECEIVE' ? 'Inflow Registration' : 'Expense Registration'}</h2>
              <button onClick={()=>setShowFormModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} className="text-slate-500"/></button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
              {activeType === 'EXPENSE' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Date</label>
                    <input disabled={submitting} type="date" value={expenseForm.date} onChange={e=>setExpenseForm({...expenseForm, date:e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Payment Mode</label>
                    <select disabled={submitting} value={expenseForm.paymentMode} onChange={e=>setExpenseForm({...expenseForm, paymentMode:e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400">
                      {expenseModes.map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Group Head</label>
                    <select disabled={submitting} value={expenseForm.groupHead} onChange={e=>setExpenseForm({...expenseForm, groupHead:e.target.value, expenseHead:'', subHead:''})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400">
                      <option value="">Select Group</option>
                      {groupHeads.map(g=><option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Expense Head</label>
                    <select disabled={submitting} value={expenseForm.expenseHead} onChange={e=>setExpenseForm({...expenseForm, expenseHead:e.target.value, subHead:''})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400">
                      <option value="">Select Expense</option>
                      {expenseHeads.map(eh=><option key={eh} value={eh}>{eh}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Sub Head</label>
                    <select disabled={submitting} value={expenseForm.subHead} onChange={e=>setExpenseForm({...expenseForm, subHead:e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400">
                      <option value="">Select Sub Head</option>
                      {subHeads.map(sh=><option key={sh} value={sh}>{sh}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Branch</label>
                    <select disabled={submitting} value={expenseForm.branch} onChange={e=>setExpenseForm({...expenseForm, branch:e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400" required>
                      <option value="">Select Branch</option>
                      {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Amount (₹)</label>
                    <input disabled={submitting} type="number" value={expenseForm.amount} onChange={e=>setExpenseForm({...expenseForm, amount:e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-bold focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400" placeholder="0.00" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Paid To / Vendor</label>
                    <input 
                      disabled={submitting} 
                      type="text" 
                      list="vendor-list"
                      value={expenseForm.paidTo} 
                      onChange={e=>setExpenseForm({...expenseForm, paidTo:e.target.value})} 
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400" 
                      placeholder="Select or enter name" 
                    />
                    <datalist id="vendor-list">
                      {vendorSuggestions.map(v => <option key={v} value={v} />)}
                    </datalist>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Description</label>
                    <textarea disabled={submitting} rows="2" value={expenseForm.description} onChange={e=>setExpenseForm({...expenseForm, description:e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none resize-none disabled:bg-slate-100 disabled:text-slate-400" placeholder="Details..." />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Value Date</label>
                    <input disabled={submitting} type="date" value={receiveForm.valueDate} onChange={e=>setReceiveForm({...receiveForm, valueDate:e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Inflow Type</label>
                    <select
                      disabled={submitting}
                      value={receiveForm.transactionType}
                      onChange={e => {
                        const mode = e.target.value;
                        const isTransfer = mode === 'Transfer';
                        setReceiveForm({
                          ...receiveForm,
                          transactionType: mode,
                          expenseHead: isTransfer ? 'Cash at Home' : '',
                          subHead: ''
                        });
                      }}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {receiveModes.map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  {/* Expense Head + Sub Head — only shown for Transfer mode */}
                  {receiveForm.transactionType === 'Transfer' && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Expense Head
                          <span className="ml-2 text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">AUTO</span>
                        </label>
                        <select
                          disabled={submitting || true}
                          value={receiveForm.expenseHead}
                          onChange={e => setReceiveForm({...receiveForm, expenseHead: e.target.value, subHead: ''})}
                          className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <option value="">Select Expense Head</option>
                          {receiveExpenseHeads.map(eh => <option key={eh} value={eh}>{eh}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Sub Head</label>
                        <select
                          disabled={submitting || !receiveForm.expenseHead}
                          value={receiveForm.subHead}
                          onChange={e => setReceiveForm({...receiveForm, subHead: e.target.value})}
                          className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <option value="">{receiveForm.expenseHead ? 'Select Sub Head' : 'Select Expense Head first'}</option>
                          {receiveSubHeads.map(sh => <option key={sh} value={sh}>{sh}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Amount (₹)</label>
                    <input disabled={submitting} type="number" value={receiveForm.amount} onChange={e=>setReceiveForm({...receiveForm, amount:e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-bold focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400" placeholder="0.00" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Branch</label>
                    <select disabled={submitting} value={receiveForm.branch} onChange={e=>setReceiveForm({...receiveForm, branch:e.target.value})} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400" required>
                      <option value="">Select Branch</option>
                      {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Received From / Notes</label>
                    <input 
                      disabled={submitting} 
                      type="text" 
                      list="vendor-list"
                      value={receiveForm.receivedFrom} 
                      onChange={e=>setReceiveForm({...receiveForm, receivedFrom:e.target.value})} 
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400" 
                      placeholder="Select or enter name/details" 
                    />
                  </div>
                </div>
              )}

              {/* Shared File Upload Section */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Supporting Documentation (Max 5)</label>
                <div 
                  onClick={() => !submitting && selectedFiles.length < 5 && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-all cursor-pointer ${submitting || selectedFiles.length >= 5 ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/30'}`}
                >
                  <Upload size={24} className="text-slate-400 mb-2" />
                  <span className="text-xs font-bold text-slate-600">Click to upload receipts/proofs</span>
                  <span className="text-[9px] text-slate-400 mt-1">{selectedFiles.length} of 5 selected</span>
                  <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" disabled={submitting} />
                </div>
                {selectedFiles.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {selectedFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2 rounded-md group">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Paperclip size={10} className="text-slate-400 shrink-0" />
                          <span className="text-[10px] font-medium text-slate-600 truncate">{f.name}</span>
                        </div>
                        <button disabled={submitting} onClick={() => removeFile(i)} className="text-rose-500 hover:bg-rose-50 p-1 rounded disabled:opacity-30"><X size={12}/></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
              <button disabled={submitting} onClick={handleDirectSubmit} className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50">
                {submitting ? 'Processing...' : 'Submit Transaction'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>

    {/* Full Screen Processing Overlay */}
    {submitting && createPortal(
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[1000] flex flex-col items-center justify-center text-white animate-in fade-in duration-300">
        <div className="relative mb-8">
           <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
           <Loader2 size={64} className="animate-spin text-blue-400 relative z-10" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-bold mb-2 tracking-tight">Syncing with Cloud Ledger</h2>
        <p className="text-blue-200 font-medium text-sm animate-pulse mb-6">{processingStatus}</p>
        <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
           <div className="h-full bg-blue-500 animate-progress-indeterminate"></div>
        </div>
        <p className="mt-8 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Transaction Protocol Active</p>
      </div>,
      document.body
    )}
    </>
  );
}

const receiveModes = ['Cash Received (+)', 'Transfer', 'Online Received (+)', 'UPI Received (+)'];
const expenseModes = ['Cash', 'Transfer', 'Cheque', 'Online', 'UPI'];
