import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, Edit2, X, Check, RefreshCcw,
  Layers, Box, AlignLeft, Search, Loader2, FilterX,
  User, Building2
} from 'lucide-react';

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;

/* ── Reusable Column ── */
function MasterColumn({ icon: Icon, title, items, selected, onSelect, onAdd, onEdit, onDelete, disabled, editingItem, setEditingItem, onCommitEdit, saving, emptyMsg, level }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col shadow-sm overflow-hidden h-[460px]">
      {/* Column header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Icon size={13} className="text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{title}</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded-full font-black">{items.length}</span>
        </div>
        <button
          disabled={disabled}
          onClick={onAdd}
          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-300">
            <Layers size={24} strokeWidth={1} />
            <p className="text-[9px] font-bold uppercase tracking-widest">{emptyMsg || 'No entries'}</p>
          </div>
        ) : items.map(item => {
          const isEditing = editingItem?.oldValue === item && editingItem?.title === title;
          const isSelected = selected === item;

          return (
            <div
              key={item}
              onClick={() => !isEditing && onSelect && onSelect(item)}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-lg transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : 'bg-transparent border-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-100'
              }`}
            >
              {isEditing ? (
                <div className="flex items-center gap-1.5 w-full" onClick={e => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={editingItem.value}
                    onChange={e => setEditingItem({ ...editingItem, value: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') onCommitEdit(); if (e.key === 'Escape') setEditingItem(null); }}
                    className="flex-1 border border-blue-300 rounded-md px-2 py-1 text-xs font-bold outline-none focus:border-blue-500 bg-white"
                  />
                  <button onClick={onCommitEdit} disabled={saving} className="p-1 bg-emerald-500 text-white rounded shadow-sm hover:bg-emerald-600 transition-colors shrink-0">
                    <Check size={11} />
                  </button>
                  <button onClick={() => setEditingItem(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded shrink-0">
                    <X size={11} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-xs font-semibold truncate flex-1">{item}</span>
                  <div className={`flex gap-0.5 transition-all shrink-0 ml-1 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button
                      onClick={e => { e.stopPropagation(); setEditingItem({ title, level, oldValue: item, value: item }); }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); onDelete(item); }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Simple list column (Vendors / Branches) ── */
function SimpleColumn({ icon: Icon, title, items, onAdd, onEdit, onDelete, editingItem, setEditingItem, onCommitEdit, saving, level }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col shadow-sm overflow-hidden h-[460px]">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Icon size={13} className="text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{title}</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded-full font-black">{items.length}</span>
        </div>
        <button onClick={onAdd} className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
          <Plus size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-300">
            <Layers size={24} strokeWidth={1} />
            <p className="text-[9px] font-bold uppercase tracking-widest">No entries</p>
          </div>
        ) : items.map(item => {
          const isEditing = editingItem?.oldValue === item && editingItem?.level === level;
          return (
            <div key={item} className="group flex items-center justify-between px-3 py-2.5 rounded-lg border border-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-100 transition-all">
              {isEditing ? (
                <div className="flex items-center gap-1.5 w-full">
                  <input
                    autoFocus
                    value={editingItem.value}
                    onChange={e => setEditingItem({ ...editingItem, value: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') onCommitEdit(); if (e.key === 'Escape') setEditingItem(null); }}
                    className="flex-1 border border-blue-300 rounded-md px-2 py-1 text-xs font-bold outline-none focus:border-blue-500 bg-white"
                  />
                  <button onClick={onCommitEdit} disabled={saving} className="p-1 bg-emerald-500 text-white rounded shadow-sm hover:bg-emerald-600 shrink-0">
                    <Check size={11} />
                  </button>
                  <button onClick={() => setEditingItem(null)} className="p-1 text-slate-400 rounded shrink-0"><X size={11} /></button>
                </div>
              ) : (
                <>
                  <span className="text-xs font-semibold truncate flex-1">{item}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-1">
                    <button onClick={() => setEditingItem({ title, level, oldValue: item, value: item })} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors">
                      <Edit2 size={11} />
                    </button>
                    <button onClick={() => onDelete(item)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function HeadMaster() {
  const [masterData, setMasterData]         = useState([]);
  const [fetching, setFetching]             = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [selectedGroup, setSelectedGroup]   = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [searchTerm, setSearchTerm]         = useState('');
  const [editingItem, setEditingItem]       = useState(null);
  const [showAddModal, setShowAddModal]     = useState(false);
  const [modalLevel, setModalLevel]         = useState(null);
  const [modalValue, setModalValue]         = useState('');

  const fetchMasterData = useCallback(async (silent = false) => {
    if (!silent) setFetching(true);
    try {
      const res  = await fetch(APPSCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'readMaster' }) });
      const json = await res.json();
      if (json.success) {
        setMasterData(
          (json.data || []).map(r => ({
            'Group Head':  String(r['Group Head']  || r['Group Heads']  || '').trim(),
            'Expense Head': String(r['Expense Head'] || r['Expense Heads'] || '').trim(),
            'Sub Head':    String(r['Sub Head']    || r['Sub Heads']    || '').trim(),
            'Vendore':     String(r['Vendore']     || r['Vendor']       || '').trim(),
            'Branch':      String(r['Branch']      || r['Branches']     || '').trim(),
          })).filter(r => Object.values(r).some(Boolean))
        );
      }
    } catch { toast.error('Error loading Master data'); }
    finally   { if (!silent) setFetching(false); }
  }, []);

  useEffect(() => { fetchMasterData(); }, [fetchMasterData]);

  /* ── Derived lists ── */
  const groupHeads = useMemo(() =>
    [...new Set(masterData.map(d => d['Group Head']).filter(Boolean))].sort()
      .filter(g => !searchTerm || g.toLowerCase().includes(searchTerm.toLowerCase())),
    [masterData, searchTerm]);

  const expenseHeads = useMemo(() => {
    let d = masterData;
    if (selectedGroup) d = d.filter(r => r['Group Head'] === selectedGroup);
    return [...new Set(d.map(r => r['Expense Head']).filter(Boolean))].sort()
      .filter(e => !searchTerm || e.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [masterData, selectedGroup, searchTerm]);

  const subHeads = useMemo(() => {
    let d = masterData;
    if (selectedGroup)   d = d.filter(r => r['Group Head']  === selectedGroup);
    if (selectedExpense) d = d.filter(r => r['Expense Head'] === selectedExpense);
    return [...new Set(d.map(r => r['Sub Head']).filter(Boolean))].sort()
      .filter(s => !searchTerm || s.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [masterData, selectedGroup, selectedExpense, searchTerm]);

  const vendors  = useMemo(() => [...new Set(masterData.map(d => d['Vendore']).filter(Boolean))].sort(), [masterData]);
  const branches = useMemo(() => [...new Set(masterData.map(d => d['Branch']).filter(Boolean))].sort(), [masterData]);

  /* ── API ── */
  const callApi = async (action, data) => {
    setSaving(true);
    try {
      const res  = await fetch(APPSCRIPT_URL, { method: 'POST', body: JSON.stringify({ action, data }) });
      const json = await res.json();
      if (json.success) return json;
      throw new Error(json.error || 'Failed');
    } catch (err) { toast.error(err.message || 'Action failed'); throw err; }
    finally { setSaving(false); }
  };

  // For CREATE: only send the relevant key to avoid matching/deleting other rows
  const buildCreatePayload = (level, value) => {
    if (level === 'group')   return { 'Group Head': value, 'Expense Head': '', 'Sub Head': '', 'Vendore': '', 'Branch': '' };
    if (level === 'expense') return { 'Group Head': selectedGroup || '', 'Expense Head': value, 'Sub Head': '', 'Vendore': '', 'Branch': '' };
    if (level === 'sub')     return { 'Group Head': selectedGroup || '', 'Expense Head': selectedExpense || '', 'Sub Head': value, 'Vendore': '', 'Branch': '' };
    if (level === 'vendor')  return { 'Vendore': value };   // sparse: only the relevant key
    if (level === 'branch')  return { 'Branch': value };    // sparse: only the relevant key
  };

  // For DELETE/UPDATE: send the full row so the backend can match the exact row
  const buildMatchPayload = (level, value) => {
    const base = { 'Group Head': '', 'Expense Head': '', 'Sub Head': '', 'Vendore': '', 'Branch': '' };
    if (level === 'group')   return { ...base, 'Group Head': value };
    if (level === 'expense') return { ...base, 'Group Head': selectedGroup || '', 'Expense Head': value };
    if (level === 'sub')     return { ...base, 'Group Head': selectedGroup || '', 'Expense Head': selectedExpense || '', 'Sub Head': value };
    if (level === 'vendor')  return { ...base, 'Vendore': value };
    if (level === 'branch')  return { ...base, 'Branch': value };
  };

  const handleAdd = async () => {
    const val = modalValue.trim();
    if (!val) return;
    try {
      await callApi('createMaster', buildCreatePayload(modalLevel, val));
      toast.success('Added');
      setShowAddModal(false); setModalValue('');
      fetchMasterData(true);
    } catch {}
  };

  const handleInlineEdit = async () => {
    const { level, oldValue, value } = editingItem;
    const val = value.trim();
    if (!val || val === oldValue) { setEditingItem(null); return; }
    try {
      await callApi('updateMaster', { level, oldValue: buildMatchPayload(level, oldValue), newValue: buildMatchPayload(level, val) });
      toast.success('Updated'); setEditingItem(null); fetchMasterData(true);
    } catch {}
  };

  const handleDelete = async (level, value) => {
    if (!window.confirm(`Delete "${value}"?`)) return;
    try { await callApi('deleteMaster', buildMatchPayload(level, value)); toast.success('Deleted'); fetchMasterData(true); } catch {}
  };

  const openAdd = (level) => { setModalLevel(level); setModalValue(''); setShowAddModal(true); };

  const colProps = (level) => ({
    level,
    saving, editingItem, setEditingItem, onCommitEdit: handleInlineEdit,
    onDelete: (v) => handleDelete(level, v),
  });

  return (
    <div className="max-w-7xl mx-auto space-y-5 p-2 pb-24">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Head Master</h1>
          <p className="text-xs sm:text-sm text-slate-500">Hierarchical category management</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(selectedGroup || selectedExpense) && (
            <button
              onClick={() => { setSelectedGroup(null); setSelectedExpense(null); }}
              className="flex-1 sm:flex-none px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 hover:bg-slate-200 shadow-sm border border-slate-200"
            >
              <FilterX size={12} /> Clear Filter
            </button>
          )}
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2.5 shadow-sm flex-1 sm:w-52">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search master data…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent outline-none w-full"
            />
          </div>
          <button onClick={() => fetchMasterData()} className="p-2.5 bg-white border border-slate-300 rounded-lg text-slate-500 hover:bg-slate-50 shadow-sm transition-colors">
            <RefreshCcw size={16} className={fetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 3-column hierarchy */}
      {fetching ? (
        <div className="flex items-center justify-center h-48 gap-3 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-xs font-bold uppercase">Loading…</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MasterColumn
              icon={Layers} title="Group Heads"
              items={groupHeads}
              selected={selectedGroup}
              onSelect={g => { setSelectedGroup(g); setSelectedExpense(null); }}
              onAdd={() => openAdd('group')}
              onEdit={() => {}}
              {...colProps('group')}
            />
            <MasterColumn
              icon={Box} title="Expense Heads"
              items={expenseHeads}
              selected={selectedExpense}
              onSelect={e => setSelectedExpense(e)}
              onAdd={() => openAdd('expense')}
              disabled={!selectedGroup}
              emptyMsg={selectedGroup ? 'No expense heads' : 'Select a Group Head'}
              {...colProps('expense')}
            />
            <MasterColumn
              icon={AlignLeft} title="Sub Heads"
              items={subHeads}
              selected={null}
              onSelect={() => {}}
              onAdd={() => openAdd('sub')}
              disabled={!selectedExpense}
              emptyMsg={!selectedGroup ? 'Select a Group Head' : !selectedExpense ? 'Select an Expense Head' : 'No sub heads'}
              {...colProps('sub')}
            />
          </div>

          {/* Vendors + Branches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SimpleColumn icon={User} title="Vendors" items={vendors} onAdd={() => openAdd('vendor')} {...colProps('vendor')} />
            <SimpleColumn icon={Building2} title="Branches" items={branches} onAdd={() => openAdd('branch')} {...colProps('branch')} />
          </div>
        </>
      )}

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50">
          <Loader2 size={14} className="animate-spin text-blue-400" />
          <span className="text-[11px] font-black uppercase tracking-wider">Syncing…</span>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-end sm:items-center justify-center z-[9999] sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h2 className="font-black text-slate-900 uppercase tracking-tight text-sm">
                  Add {modalLevel === 'group' ? 'Group Head' : modalLevel === 'expense' ? 'Expense Head' : modalLevel === 'sub' ? 'Sub Head' : modalLevel === 'vendor' ? 'Vendor' : 'Branch'}
                </h2>
                {/* parent context breadcrumb */}
                {(modalLevel === 'expense' || modalLevel === 'sub') && (
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {selectedGroup && <span className="text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">{selectedGroup}</span>}
                    {modalLevel === 'sub' && selectedExpense && <span className="text-[9px] font-black text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">{selectedExpense}</span>}
                  </div>
                )}
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="p-5">
              <input
                autoFocus
                type="text"
                value={modalValue}
                onChange={e => setModalValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                placeholder="Enter name…"
                className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 bg-white transition-all"
              />
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={handleAdd}
                disabled={saving || !modalValue.trim()}
                className="flex-1 bg-slate-900 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Add Entry'}
              </button>
              <button onClick={() => setShowAddModal(false)} className="px-6 bg-white border border-slate-300 text-slate-500 py-3 rounded-xl font-black text-xs uppercase">
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
