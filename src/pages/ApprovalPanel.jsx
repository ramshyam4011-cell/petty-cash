import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, X, Pause, FileText, AlertCircle } from 'lucide-react';
import { getExpenses, saveExpenses, getCredits, getLedger, saveLedger } from '../utils/storageManager';
import { createLedgerEntry, calculateBalance, formatCurrency, formatDate, getGoogleSheetTimestamp } from '../utils/helpers';

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;

export default function ApprovalPanel() {
  const [activeTab, setActiveTab] = useState('pending');
  const [expenses, setExpenses] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [actionType, setActionType] = useState(''); // 'REJECT' or 'HOLD'
  const [remark, setRemark] = useState('');

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
          // Robust key normalization to handle potential spaces in sheet headers
          const d = {};
          Object.keys(e).forEach(k => { d[k.trim()] = e[k]; });

          return {
            id: d.SN || `exp-${idx}`,
            sn: d.SN,
            date: d.Date,
            paymentMode: d['Payment mode'],
            groupHead: d['Group Head'],
            expenseHead: d['Expense Head'],
            subHead: d['Sub Head'],
            amount: parseFloat(d['Amount (INR)']) || 0,
            personName: d['Paid To'],
            branch: d.Branch,
            remarks: d['Description / Reason'],
            billAttached: !!d['Bill / Receipt'],
            billUrl: d['Bill / Receipt'],
            status: (d.Status || 'PENDING').toUpperCase(),
            approvalRemarks: d['Approval / Reject - Remark'] || d['Approval Remark'] || '',
            user: d.user || d.User || 'Admin',
            planned: d['Planned'],
            approvalTimestamp: d['Approval Timestamp']
          };
        });
        setExpenses(mapped);
      } else {
        toast.error('Failed to load expenses from sheet');
      }
    } catch (err) {
      toast.error('Network error while loading expenses');
    } finally {
      setFetching(false);
    }
  };

  React.useEffect(() => {
    fetchExpenses();
  }, []);

  const credits = getCredits();

  const isEmpty = (val) => !val || String(val).trim() === '';

  const counts = {
    pending: expenses.filter(e => isEmpty(e.approvalTimestamp)).length,
    approved: expenses.filter(e => e.status === 'APPROVED').length,
    rejected: expenses.filter(e => e.status === 'REJECTED').length,
    hold: expenses.filter(e => e.status === 'HOLD').length,
  };

  const filteredExpenses = expenses.filter(e => {
    if (activeTab === 'pending') {
      return isEmpty(e.approvalTimestamp);
    }
    if (activeTab === 'approved') return e.status === 'APPROVED';
    if (activeTab === 'rejected') return e.status === 'REJECTED';
    if (activeTab === 'hold') return e.status === 'HOLD';
    return false;
  });

  const handleApprove = async (expense) => {
    try {
      toast.loading('Approving on sheet...', { id: 'approve-toast' });

      const response = await fetch(APPSCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'update',
          sn: expense.sn,
          status: 'APPROVED',
          timestamp: getGoogleSheetTimestamp()
        })
      });

      const json = await response.json();
      if (!json.success) throw new Error(json.error || 'Failed to update sheet');

      // Update local storage for redundancy
      const latestExpenses = getExpenses();
      const freshCredits = getCredits();

      const updatedExpenses = latestExpenses.map(e => {
        if (e.id === expense.id || e.sn === expense.sn) {
          return { ...e, status: 'APPROVED' };
        }
        return e;
      });

      setExpenses(updatedExpenses);
      saveExpenses(updatedExpenses);

      // Create ledger entry
      const currentExpenses = updatedExpenses.filter(e => e.status === 'APPROVED');
      const currentBalance = calculateBalance(expense.personName, freshCredits, currentExpenses);

      const ledgerEntry = createLedgerEntry(
        expense.id,
        expense.personName,
        'EXPENSE',
        expense.amount,
        expense.date,
        expense.id,
        currentBalance
      );

      saveLedger(ledgerEntry);
      toast.success('Expense approved and updated on sheet!', { id: 'approve-toast' });
      fetchExpenses(); // Refresh data from sheet
    } catch (error) {
      console.error(error);
      toast.error('Error approving expense: ' + error.message, { id: 'approve-toast' });
    }
  };

  const openModal = (expense, type) => {
    setSelectedExpense(expense);
    setActionType(type);
    setRemark('');
    setShowModal(true);
  };

  const handleConfirmAction = async () => {
    if (!remark.trim()) {
      toast.error('Please enter a remark');
      return;
    }

    try {
      const status = actionType === 'REJECT' ? 'REJECTED' : 'HOLD';
      toast.loading(`Marking as ${status.toLowerCase()} on sheet...`, { id: 'action-toast' });

      const response = await fetch(APPSCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'update',
          sn: selectedExpense.sn,
          status: status,
          remark: remark.trim(),
          timestamp: getGoogleSheetTimestamp()
        })
      });

      const json = await response.json();
      if (!json.success) throw new Error(json.error || 'Failed to update sheet');

      const latestExpenses = getExpenses();
      const updatedExpenses = latestExpenses.map(e => {
        if (e.id === selectedExpense.id || e.sn === selectedExpense.sn) {
          return { ...e, status, approvalRemarks: remark.trim() };
        }
        return e;
      });

      setExpenses(updatedExpenses);
      saveExpenses(updatedExpenses);
      setShowModal(false);
      toast.success(`Expense marked as ${status.toLowerCase()} and updated on sheet!`, { id: 'action-toast' });
      fetchExpenses(); // Refresh data from sheet
    } catch (error) {
      console.error(error);
      toast.error('Error processing request: ' + error.message, { id: 'action-toast' });
    }
  };

  return (
    <div className="p-2 md:p-6 space-y-6 md:space-y-10 animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold text-slate-900  leading-none mb-2">Approval Panel</h1>
          <p className="text-slate-500 font-medium italic">Review and act on expense submissions</p>
        </div>
        <button 
          onClick={fetchExpenses}
          className="bg-slate-900 text-white px-5 py-3 rounded-2xl text-sm font-semibold shadow-sm shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"
        >
          <AlertCircle size={18} className="text-indigo-400" /> Refresh Data
        </button>
      </div>

      {/* Tabs - Scrollable on Mobile */}
      <div className="overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex gap-2 bg-slate-100/80 p-1.5 rounded-2xl w-max md:w-fit border border-slate-200/30">
          {['pending', 'approved', 'rejected', 'hold'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 md:px-6 py-2.5 rounded-[14px] font-semibold text-[11px] transition-all duration-300 flex items-center gap-2.5  tracking-wider whitespace-nowrap ${activeTab === tab
                  ? 'bg-white text-indigo-600 shadow-sm scale-105'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                }`}
            >
              {tab}
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${tab === 'pending'
                    ? 'bg-amber-100 text-amber-600'
                    : tab === 'approved'
                      ? 'bg-emerald-100 text-emerald-600'
                      : tab === 'rejected'
                        ? 'bg-rose-100 text-rose-600'
                        : 'bg-slate-200 text-slate-600'
                  }`}
              >
                {counts[tab]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Expense Data Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        {fetching ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-indigo-600 border-t-transparent mx-auto"></div>
            <p className="text-slate-400 font-semibold   text-[10px]">Syncing Sheet Data...</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-slate-50/50">
            <div className="p-6 bg-white rounded-full shadow-sm mb-4">
               <FileText className="text-slate-200" size={48} />
            </div>
            <p className="text-slate-400 font-semibold   text-[10px]">No {activeTab} vouchers found</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards (Hidden on Desktop) */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100">
               {filteredExpenses.map((expense) => (
                 <div key={expense.id} className="p-4 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                       <div className="flex flex-col gap-1.5">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-semibold border border-indigo-100   w-fit">{expense.sn}</span>
                          <h3 className="font-semibold text-slate-900 text-lg leading-tight ">{expense.personName}</h3>
                          <span className="text-[11px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg w-fit">{expense.groupHead}</span>
                       </div>
                       <div className="text-right">
                          <p className="text-xl font-semibold text-slate-900">{formatCurrency(expense.amount).replace('INR', '₹')}</p>
                          <span className="text-[10px] font-semibold text-slate-400 ">{expense.paymentMode}</span>
                       </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl space-y-2">
                       <div className="flex justify-between text-[11px] font-semibold">
                          <span className="text-slate-400 ">Description</span>
                          <span className="text-slate-600">{formatDate(expense.date)}</span>
                       </div>
                       <p className="text-xs text-slate-700 font-medium leading-relaxed">{expense.remarks || '-'}</p>
                    </div>

                    {expense.approvalRemarks && (
                      <div className="flex items-start gap-2 p-3 bg-rose-50 rounded-2xl border border-rose-100 text-rose-600 text-[11px] font-semibold">
                        <AlertCircle size={14} className="flex-shrink-0" />
                        <span>{expense.approvalRemarks}</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                       {(activeTab === 'pending' || activeTab === 'hold') ? (
                         <>
                           <button onClick={() => handleApprove(expense)} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-2xl font-semibold text-[11px]   shadow-sm shadow-emerald-100 transition-all active:scale-95">
                              <Check size={16} strokeWidth={3} /> Approve
                           </button>
                           <button onClick={() => openModal(expense, 'REJECT')} className="p-3 bg-rose-50 text-rose-600 rounded-2xl font-semibold transition-all active:scale-95 border border-rose-100">
                              <X size={20} strokeWidth={3} />
                           </button>
                           {activeTab === 'pending' && (
                             <button onClick={() => openModal(expense, 'HOLD')} className="p-3 bg-slate-100 text-slate-600 rounded-2xl font-semibold transition-all active:scale-95 border border-slate-200">
                                <Pause size={20} strokeWidth={3} />
                             </button>
                           )}
                         </>
                       ) : (
                         <div className="w-full text-center py-2 bg-slate-50 rounded-xl">
                            <span className={`text-[11px] font-semibold   ${
                              expense.status === 'APPROVED' ? 'text-emerald-600' :
                              expense.status === 'REJECTED' ? 'text-rose-600' : 'text-slate-600'
                            }`}>{expense.status}</span>
                         </div>
                       )}
                    </div>
                 </div>
               ))}
            </div>

            {/* Desktop Table (Hidden on Mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-5 text-[10px] font-semibold text-slate-400  ">Voucher</th>
                    <th className="px-6 py-5 text-[10px] font-semibold text-slate-400  ">Date</th>
                    <th className="px-6 py-5 text-[10px] font-semibold text-slate-400  ">Category</th>
                    <th className="px-6 py-5 text-[10px] font-semibold text-slate-400  ">Description</th>
                    <th className="px-6 py-5 text-[10px] font-semibold text-slate-400   text-right">Amount</th>
                    <th className="px-6 py-5 text-[10px] font-semibold text-slate-400   text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5">
                        <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-[12px] font-semibold border border-indigo-100 shadow-sm">{expense.sn}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-[13px] font-semibold text-slate-600">{formatDate(expense.date)}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-semibold text-slate-900  ">{expense.groupHead}</span>
                          <span className="text-[11px] font-semibold text-slate-400  ">{expense.subHead || expense.expenseHead}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 max-w-[280px]">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-semibold text-slate-900 truncate " title={expense.remarks}>{expense.remarks || '-'}</span>
                          <span className="text-[11px] font-semibold text-indigo-500  tracking-wider truncate" title={expense.personName}>{expense.personName}</span>
                        </div>
                        {expense.approvalRemarks && (
                          <div className="mt-1.5 p-2 bg-rose-50 rounded-xl text-[10px] text-rose-600 font-semibold flex items-start gap-1.5 border border-rose-100">
                            <AlertCircle size={12} className="flex-shrink-0 mt-[1px]" />
                            <span className="line-clamp-2">{expense.approvalRemarks}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex flex-col items-end">
                           <span className="text-base font-semibold text-slate-900 ">{formatCurrency(expense.amount).replace('INR', '₹')}</span>
                           <span className="text-[9px] font-semibold text-slate-300  ">{expense.paymentMode}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {(activeTab === 'pending' || activeTab === 'hold') ? (
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleApprove(expense)} className="p-2.5 bg-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-95" title="Approve">
                              <Check size={18} strokeWidth={3} />
                            </button>
                            <button onClick={() => openModal(expense, 'REJECT')} className="p-2.5 bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-95" title="Reject">
                              <X size={18} strokeWidth={3} />
                            </button>
                            {activeTab === 'pending' && (
                              <button onClick={() => openModal(expense, 'HOLD')} className="p-2.5 bg-slate-100 text-slate-600 hover:bg-slate-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-95" title="Hold">
                                <Pause size={18} strokeWidth={3} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <span className={`px-4 py-1.5 rounded-xl text-[10px] font-semibold  tracking-[0.15em] border ${
                              expense.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              expense.status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                              'bg-slate-50 text-slate-600 border-slate-200'
                            }`}>
                              {expense.status}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Remark Modal */}
      {showModal && (
        <div className="fixed inset-0 lg:left-64 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-sm max-w-md w-full overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="p-8 pb-4">
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-2xl text-white shadow-sm ${actionType === 'REJECT' ? 'bg-rose-600 shadow-rose-100' : 'bg-slate-700 shadow-slate-100'}`}>
                  {actionType === 'REJECT' ? <X size={24} strokeWidth={3} /> : <Pause size={24} strokeWidth={3} />}
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900 ">
                    {actionType === 'REJECT' ? 'Reject Voucher' : 'Hold Voucher'}
                  </h3>
                  <p className="text-slate-400 text-[10px] font-semibold   mt-0.5">Admin Action Required</p>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-500 mb-6 leading-relaxed">
                Provide a detailed reason for {actionType === 'REJECT' ? 'rejection' : 'holding'} this expense. This will be visible to the user.
              </p>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Type remark here..."
                rows="4"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-semibold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-300"
                required
              />
            </div>
            <div className="p-8 pt-4 flex gap-3">
               <button
                 onClick={handleConfirmAction}
                 className={`flex-1 py-4 font-semibold rounded-2xl text-white text-xs   transition-all active:scale-95 shadow-sm ${
                   actionType === 'REJECT' ? 'bg-rose-600 shadow-rose-100 hover:bg-rose-700' : 'bg-slate-900 shadow-slate-100 hover:bg-slate-800'
                 }`}
               >
                 Confirm {actionType === 'REJECT' ? 'Reject' : 'Hold'}
               </button>
               <button
                 onClick={() => setShowModal(false)}
                 className="px-6 py-4 font-semibold rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs   hover:bg-slate-50 transition-all active:scale-95"
               >
                 Abort
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
