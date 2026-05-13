import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Check, X, Pause, Trash2, RotateCcw, ShieldCheck, ShieldAlert, AlertTriangle, RefreshCcw, User, Building2, Paperclip, FileText, Image as ImageIcon, Lock
} from 'lucide-react';
import { formatCurrency, formatDate, getGoogleSheetTimestamp } from '../utils/helpers';
import { useAuthStore } from '../store/authStore';

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;

const EXPENSE_TABS = [
  { key: 'pending',  label: 'Pending',  color: 'amber'   },
  { key: 'hold',     label: 'Hold',     color: 'orange'  },
  { key: 'rejected', label: 'Rejected', color: 'rose'    },
  { key: 'history',  label: 'History',  color: 'slate'   },
];

const DELETE_TABS = [
  { key: 'delete-pending', label: 'Pending Delete', color: 'rose'  },
  { key: 'deleted',        label: 'Deleted History', color: 'slate' },
];

export default function ApprovalPanel() {
  const { user } = useAuthStore();
  const role      = user?.role?.toUpperCase();
  const userId    = user?.id || '';

  const [mainTab,    setMainTab]    = useState('expense');   
  const [expenseTab, setExpenseTab] = useState('pending');
  const [deleteTab,  setDeleteTab]  = useState('delete-pending');

  const [records,  setRecords]  = useState([]);
  const [fetching, setFetching] = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [actionType, setActionType]   = useState('');
  const [remark,    setRemark]    = useState('');
  const [selectedSns, setSelectedSns] = useState([]);

  // ---------- RBAC: scope records by role ----------
  const scopedRecords = useMemo(() => {
    if (role === 'SUPER_ADMIN') return records;                         // sees all
    if (role === 'ADMIN') {
      // Admin sees records of users who report to them
      return records.filter(r => r['Reported by'] === userId);
    }
    return [];
  }, [records, role, userId]);

  // Helper: can this approver action this record?
  // Admins cannot approve their own submissions; only SUPER_ADMIN can
  const canApprove = (record) => {
    if (role === 'SUPER_ADMIN') return true;
    if (role === 'ADMIN') return record['user'] !== userId;
    return false;
  };

  const fetchRecords = async () => {
    try {
      setFetching(true);
      const res  = await fetch(APPSCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'read' }) });
      const json = await res.json();
      if (json.success) setRecords(json.data || []);
    } catch { toast.error('Connection error'); }
    finally   { setFetching(false); setSelectedSns([]); }
  };

  useEffect(() => { fetchRecords(); }, []);

  const expenseCounts = {
    pending:  scopedRecords.filter(r => r.Status === 'PENDING' && r['Delete Status'] !== 'DELETED' && r.Flow !== 'IN').length,
    hold:     scopedRecords.filter(r => r.Status === 'HOLD' && r['Delete Status'] !== 'DELETED' && r.Flow !== 'IN').length,
    rejected: scopedRecords.filter(r => r.Status === 'REJECTED' && r['Delete Status'] !== 'DELETED' && r.Flow !== 'IN').length,
    history:  scopedRecords.filter(r => r.Status === 'APPROVED' && r['Delete Status'] !== 'DELETED' && r.Flow !== 'IN').length,
  };

  const deleteCounts = {
    'delete-pending': scopedRecords.filter(r => r['Delete Status'] === 'PENDING_DELETE').length,
    'deleted':        scopedRecords.filter(r => r['Delete Status'] === 'DELETED').length,
  };

  const filteredRecords = scopedRecords.filter(r => {
    if (mainTab === 'expense') {
      if (r['Delete Status'] === 'DELETED') return false;
      if (r.Flow === 'IN') return false; 
      if (expenseTab === 'pending')  return r.Status === 'PENDING';
      if (expenseTab === 'hold')     return r.Status === 'HOLD';
      if (expenseTab === 'rejected') return r.Status === 'REJECTED';
      if (expenseTab === 'history')  return r.Status === 'APPROVED';
    } else {
      if (deleteTab === 'delete-pending') return r['Delete Status'] === 'PENDING_DELETE';
      if (deleteTab === 'deleted')        return r['Delete Status'] === 'DELETED';
    }
    return false;
  });

  const toggleSelect = (sn) => {
    setSelectedSns(prev => 
      prev.includes(sn) ? prev.filter(s => s !== sn) : [...prev, sn]
    );
  };

  const toggleSelectAll = () => {
    if (selectedSns.length === filteredRecords.length) {
      setSelectedSns([]);
    } else {
      setSelectedSns(filteredRecords.map(r => r.SN));
    }
  };

  const handleBulkAction = async (status, bulkRemark = '') => {
    if (selectedSns.length === 0) return;
    
    try {
      toast.loading(`Processing ${selectedSns.length} records...`, { id: 'bulk' });
      const timestamp = getGoogleSheetTimestamp();
      
      const payload = {
        action: 'batchupdate',
        sns: selectedSns,
        status: status, // status is the intended new status
        remark: bulkRemark || remark || 'Bulk Action',
        timestamp: timestamp,
        deleteStatus: status === 'DELETED' ? 'DELETED' : (status === 'RESTORE' ? 'ACTIVE' : 'ACTIVE'),
        isDeleteAction: status === 'DELETED'
      };

      const res = await fetch(APPSCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
      const json = await res.json();
      
      if (!json.success) throw new Error(json.error || 'Batch update failed');

      toast.success('Bulk action completed', { id: 'bulk' });
      setSelectedSns([]);
      setShowModal(false);
      fetchRecords();
    } catch (err) {
      toast.error(err.message || 'Bulk action failed', { id: 'bulk' });
    }
  };

  const handleAction = async (record, status, customRemark = '') => {
    try {
      toast.loading('Processing...', { id: 'act' });
      let dStatus = record['Delete Status'];
      if (status === 'DELETED') dStatus = 'DELETED';
      if (status === 'RESTORE') dStatus = 'ACTIVE';
      
      const payload = {
        action:'update', sn:record.SN, status: (status==='DELETED'||status==='RESTORE')?record.Status:status,
        remark:customRemark||remark, timestamp:getGoogleSheetTimestamp(), deleteStatus:dStatus, isDeleteAction: status==='DELETED'
      };
      const res = await fetch(APPSCRIPT_URL, { method:'POST', body:JSON.stringify(payload) });
      const json = await res.json();
      if (!json.success) throw new Error();
      toast.success('Done', { id:'act' }); setShowModal(false); fetchRecords();
    } catch { toast.error('Action failed', { id:'act' }); }
  };

  const openModal = (record, type) => { setSelectedRecord(record); setActionType(type); setRemark(''); setShowModal(true); };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-2">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Approval Panel</h1>
          <p className="text-xs sm:text-sm text-slate-500">Review and authorize cash transactions</p>
        </div>
        <button onClick={fetchRecords} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-700 hover:bg-slate-50 shadow-sm transition-all active:scale-95">
          <RefreshCcw size={16} className={fetching ? 'animate-spin' : ''} /> Sync Ledger
        </button>
      </div>

      {/* Main Switcher */}
      <div className="flex p-1 bg-slate-200/50 rounded-xl w-full sm:w-fit overflow-x-auto no-scrollbar">
        <button onClick={() => setMainTab('expense')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap ${mainTab === 'expense' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500'}`}>
          <ShieldCheck size={16} /> Expense {expenseCounts.pending > 0 && <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">{expenseCounts.pending}</span>}
        </button>
        <button onClick={() => setMainTab('delete')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap ${mainTab === 'delete' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-500'}`}>
          <ShieldAlert size={16} /> Deletion {deleteCounts['delete-pending'] > 0 && <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">{deleteCounts['delete-pending']}</span>}
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto no-scrollbar scroll-smooth">
        {(mainTab === 'expense' ? EXPENSE_TABS : DELETE_TABS).map(tab => {
          const isActive = (mainTab === 'expense' ? expenseTab : deleteTab) === tab.key;
          return (
            <button key={tab.key} onClick={() => mainTab === 'expense' ? setExpenseTab(tab.key) : setDeleteTab(tab.key)} className={`px-4 py-3 text-[10px] font-black border-b-2 transition-all whitespace-nowrap uppercase tracking-widest ${isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>
              {tab.label} ({(mainTab === 'expense' ? expenseCounts : deleteCounts)[tab.key]})
            </button>
          );
        })}
      </div>

      {/* Bulk Actions Bar */}
      {selectedSns.length > 0 && (
        <div className="sticky top-4 z-[60] flex items-center justify-between p-4 bg-white border border-blue-200 rounded-xl shadow-xl animate-in slide-in-from-top-4 duration-300 mx-2">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-sm">
              {selectedSns.length} SELECTED
            </div>
            <button onClick={() => setSelectedSns([])} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase">Clear</button>
          </div>
          <div className="flex items-center gap-2">
            {mainTab === 'expense' ? (
              <>
                <button onClick={() => handleBulkAction('APPROVED')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 active:scale-95">
                  <Check size={14} /> Approve All
                </button>
                <button onClick={() => { setActionType('REJECT'); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-rose-700 transition-all shadow-md shadow-rose-200 active:scale-95">
                  <X size={14} /> Reject All
                </button>
              </>
            ) : (
              <>
                <button onClick={() => handleBulkAction('DELETED')} className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-rose-700 transition-all shadow-md shadow-rose-200 active:scale-95">
                  <Trash2 size={14} /> Delete All
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* List Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-20">
        {fetching ? (
          <div className="py-20 flex justify-center"><RefreshCcw className="animate-spin text-slate-300" /></div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic bg-slate-50/50">No pending requests</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[10px] tracking-widest font-black">
                  <tr>
                    <th className="px-6 py-3 w-10">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                        checked={selectedSns.length > 0 && selectedSns.length === filteredRecords.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-3">Voucher</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Details</th>
                    <th className="px-6 py-3">By</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3 text-center">Docs</th>
                    <th className="px-6 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((r, idx) => {
                    const isHistory = (expenseTab === 'history' || deleteTab === 'deleted');
                    return (
                      <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${selectedSns.includes(r.SN) ? 'bg-blue-50/50' : ''}`}>
                        <td className="px-6 py-4">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                            checked={selectedSns.includes(r.SN)}
                            onChange={() => toggleSelect(r.SN)}
                          />
                        </td>
                        <td className="px-6 py-4 font-black text-blue-700 text-xs truncate max-w-[120px]">VCH-#{r.SN?.split('-').pop()}</td>
                        <td className="px-6 py-4 text-slate-500 font-bold text-xs">{formatDate(r.Date)}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-800 text-[10px] uppercase">{r['Group Head']}</span>
                            <span className="text-[9px] text-slate-400 font-bold">{r['Expense Head']}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-[200px]">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 text-xs truncate">{r['Paid To']}</span>
                            <span className="text-[10px] text-slate-400 line-clamp-1">{r['Description / Reason']}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-600 text-[10px]">{r['user']}</span>
                            <span className="text-[9px] text-slate-400 font-bold">{r['Branch']}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">{formatCurrency(r['Amount (INR)'])}</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-1">
                            {String(r['Bill / Receipt'] || '').split(',').filter(Boolean).map((link, lIdx) => (
                              <a key={lIdx} href={link} target="_blank" rel="noreferrer" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Paperclip size={14} /></a>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            {isHistory ? (
                              <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase ${r.Status==='APPROVED'?'bg-emerald-50 border-emerald-100 text-emerald-600':'bg-rose-50 border-rose-100 text-rose-600'}`}>{r.Status}</span>
                            ) : (
                              <ApprovalActions record={r} canApprove={canApprove} mainTab={mainTab} onAction={handleAction} onOpenModal={openModal} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="lg:hidden divide-y divide-slate-100">
              {filteredRecords.map((r, idx) => {
                const isHistory = (expenseTab === 'history' || deleteTab === 'deleted');
                return (
                  <div key={idx} className="p-4 space-y-3 active:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <input 
                          type="checkbox" 
                          className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                          checked={selectedSns.includes(r.SN)}
                          onChange={() => toggleSelect(r.SN)}
                        />
                        <div>
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-tighter mb-1">VCH-#{r.SN?.split('-').pop()} • {formatDate(r.Date)}</p>
                          <p className="font-black text-slate-900 text-sm uppercase">{r['Group Head']}</p>
                          <p className="text-xs font-bold text-slate-500 line-clamp-1">{r['Paid To'] || r['Description / Reason']}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-sm text-slate-900">{formatCurrency(r['Amount (INR)'])}</p>
                        {isHistory && (
                          <span className={`inline-block px-2 py-0.5 rounded-full border text-[8px] font-black uppercase ${r.Status==='APPROVED'?'bg-emerald-50 border-emerald-100 text-emerald-600':'bg-rose-50 border-rose-100 text-rose-600'}`}>{r.Status}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-[10px] uppercase">{r['user']?.charAt(0)}</div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{r['user']}</span>
                      </div>
                      
                      <div className="flex gap-2">
                        {String(r['Bill / Receipt'] || '').split(',').filter(Boolean).length > 0 && (
                          <a href={String(r['Bill / Receipt']).split(',')[0]} target="_blank" rel="noreferrer" className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Paperclip size={14} /></a>
                        )}
                        {!isHistory && (
                          <ApprovalActions record={r} canApprove={canApprove} mainTab={mainTab} onAction={handleAction} onOpenModal={openModal} isMobile />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Action Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm sm:backdrop-blur-md flex items-end sm:items-center justify-center z-[200] sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden border border-slate-200 h-[70vh] sm:h-auto">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 font-black text-slate-900 uppercase tracking-tight text-xs sm:text-sm flex justify-between items-center shrink-0">
              <span>{actionType === 'DELETED' ? 'Confirm Deletion' : `${actionType} Authorization`}</span>
              <button onClick={() => setShowModal(false)} className="sm:hidden p-2"><X size={20}/></button>
            </div>
            <div className="p-6 flex-1 space-y-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Audit Remark Required</p>
              <textarea autoFocus value={remark} onChange={e => setRemark(e.target.value)} placeholder="Provide context for this decision..." className="w-full border border-slate-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500/10 text-sm font-bold text-slate-700 bg-slate-50 resize-none" rows="6" />
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
              <button onClick={() => selectedSns.length > 0 ? handleBulkAction(actionType) : handleAction(selectedRecord, actionType)} className={`flex-1 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 ${actionType==='REJECT'||actionType==='DELETED'?'bg-rose-600 shadow-rose-500/20':'bg-blue-600 shadow-blue-500/20'}`}>Authorize Action</button>
              <button onClick={() => setShowModal(false)} className="hidden sm:block px-6 bg-white border border-slate-300 text-slate-500 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ApprovalActions = ({ record, canApprove, mainTab, onAction, onOpenModal, isMobile }) => {
  if (mainTab === 'expense') {
    if (!canApprove(record)) {
      return (
        <span className="flex items-center gap-1 text-[8px] font-black text-slate-400 uppercase px-2 py-1 bg-slate-50 border border-slate-200 rounded-full">
          <Lock size={10} /> Locked
        </span>
      );
    }
    return (
      <div className="flex gap-2">
        <button onClick={() => onAction(record, 'APPROVED')} className={`p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all ${isMobile ? 'flex-1' : ''}`}><Check size={16} /></button>
        <button onClick={() => onOpenModal(record, 'REJECT')} className={`p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white transition-all ${isMobile ? 'flex-1' : ''}`}><X size={16} /></button>
        <button onClick={() => onOpenModal(record, 'HOLD')} className={`p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-600 hover:text-white transition-all ${isMobile ? 'flex-1' : ''}`}><Pause size={16} /></button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <button onClick={() => onOpenModal(record, 'DELETED')} className={`p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white transition-all ${isMobile ? 'flex-1' : ''}`}><Trash2 size={16} /></button>
      <button onClick={() => onAction(record, 'RESTORE')} className={`p-2 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-900 hover:text-white transition-all ${isMobile ? 'flex-1' : ''}`}><RotateCcw size={16} /></button>
    </div>
  );
};
