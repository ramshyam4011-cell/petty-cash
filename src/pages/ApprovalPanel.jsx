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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Approval Panel</h1>
        <p className="text-gray-500 mt-1">Review and act on expense submissions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1.5 rounded-xl w-fit">
        {['pending', 'approved', 'rejected', 'hold'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition flex items-center gap-2 uppercase tracking-wider ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                tab === 'pending'
                  ? 'bg-amber-100 text-amber-800 font-bold'
                  : tab === 'approved'
                  ? 'bg-emerald-100 text-emerald-800 font-bold'
                  : tab === 'rejected'
                  ? 'bg-rose-100 text-rose-800 font-bold'
                  : 'bg-slate-200 text-slate-700 font-bold'
              }`}
            >
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Expense Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {fetching ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-500 mt-4 font-medium">Fetching expenses from sheet...</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-12 bg-gray-50">
            <FileText className="mx-auto text-gray-400 mb-3" size={40} />
            <p className="text-gray-500 font-medium">No expense submissions found in this category.</p>
          </div>
        ) : (
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
                  <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50/50 transition-colors group">
                    {/* VOUCHER */}
                    <td className="px-5 py-4">
                      <span className="text-[13px] font-mono text-gray-500">{expense.sn}</span>
                    </td>
                    
                    {/* DATE */}
                    <td className="px-5 py-4">
                      <span className="text-[13px] text-gray-600">{formatDate(expense.date)}</span>
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
                        <span className="text-[12px] text-gray-400 truncate" title={expense.personName}>{expense.personName}</span>
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
                        <span className="text-[13px] text-gray-500">{expense.user || 'Admin'}</span>
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
                        <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 font-bold">NO BILL</span>
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td className="px-5 py-4 text-center">
                      {activeTab === 'pending' ? (
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleApprove(expense)}
                            className="p-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg transition shadow-sm"
                            title="Approve"
                          >
                            <Check size={16} strokeWidth={2.5} />
                          </button>
                          <button
                            onClick={() => openModal(expense, 'REJECT')}
                            className="p-1.5 bg-rose-100 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg transition shadow-sm"
                            title="Reject"
                          >
                            <X size={16} strokeWidth={2.5} />
                          </button>
                          <button
                            onClick={() => openModal(expense, 'HOLD')}
                            className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-600 hover:text-white rounded-lg transition shadow-sm"
                            title="Hold"
                          >
                            <Pause size={16} strokeWidth={2.5} />
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`px-3 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase inline-block ${
                            expense.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : expense.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {expense.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Remark Modal for Reject/Hold */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              {actionType === 'REJECT' ? 'Reject Expense' : 'Put Expense on Hold'}
            </h3>
            <p className="text-sm text-gray-500">
              Please provide a reason for this action.
            </p>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Enter your remark here..."
              rows="4"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              required
            />
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleConfirmAction}
                className={`flex-1 py-2.5 font-semibold rounded-xl text-white shadow-sm transition ${
                  actionType === 'REJECT'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-slate-700 hover:bg-slate-800'
                }`}
              >
                Confirm {actionType === 'REJECT' ? 'Rejection' : 'Hold'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
