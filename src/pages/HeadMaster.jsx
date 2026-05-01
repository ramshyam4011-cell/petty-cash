import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, Edit2, X, Check, RefreshCw,
  AlertCircle, ChevronRight, Layers, Box, Subtitles,
  Search, Loader2, Info
} from 'lucide-react';

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;

export default function HeadMaster() {
  const [masterData, setMasterData] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Selection state
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Inline Add/Edit state
  const [activeAction, setActiveAction] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null); // Track last added/edited item for highlighting

  const inputRef = useRef(null);

  // ---------- Data Fetching ----------
  const fetchMasterData = useCallback(async (silent = false) => {
    if (!silent) setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch(APPSCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'readMaster' })
      });
      const json = await res.json();

      if (json.success) {
        const raw = json.data || [];
        // Standardize data format – handles both singular and plural headers
        const formatted = raw.map(r => ({
          'Group Head': String(r['Group Head'] || r['Group Heads'] || '').trim(),
          'Expense Head': String(r['Expense Head'] || r['Expense Heads'] || '').trim(),
          'Sub Head': String(r['Sub Head'] || r['Sub Heads'] || '').trim(),
        })).filter(r => r['Group Head'] || r['Expense Head'] || r['Sub Head']);

        setMasterData(formatted);
      } else {
        throw new Error(json.error || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('[HeadMaster] fetch error:', err);
      setFetchError(err.message);
      if (!silent) toast.error('Could not load Master data');
    } finally {
      if (!silent) setFetching(false);
    }
  }, []);

  useEffect(() => { fetchMasterData(); }, [fetchMasterData]);

  useEffect(() => {
    if (lastUpdated) {
      const timer = setTimeout(() => setLastUpdated(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastUpdated]);

  // Focus helper
  useEffect(() => {
    if (activeAction && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeAction]);

  // ---------- Derived Data ----------
  const groupHeads = useMemo(() => {
    return [...new Set(masterData.map(d => d['Group Head']).filter(Boolean))]
      .filter(gh => gh.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort();
  }, [masterData, searchTerm]);

  const expenseHeads = useMemo(() => {
    return [...new Set(masterData.map(d => d['Expense Head']).filter(Boolean))]
      .filter(eh => eh.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort();
  }, [masterData, searchTerm]);

  const subHeads = useMemo(() => {
    return [...new Set(masterData.map(d => d['Sub Head']).filter(Boolean))]
      .filter(sh => sh.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort();
  }, [masterData, searchTerm]);

  // ---------- API Helpers ----------
  const callApi = async (action, data) => {
    setSaving(true);
    try {
      const res = await fetch(APPSCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action, data })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Action failed');
      return json;
    } catch (err) {
      toast.error(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // ---------- Handlers ----------
  const startAdd = useCallback((level) => {
    setActiveAction({ type: 'add', level });
    setInputValue('');
  }, []);

  const startEdit = useCallback((level, value) => {
    setActiveAction({ type: 'edit', level, oldValue: value });
    setInputValue(value);
  }, []);

  const cancelAction = useCallback(() => {
    setActiveAction(null);
    setInputValue('');
  }, []);

  const handleCommit = useCallback(async () => {
    const val = inputValue.trim();
    if (!val) return;

    if (activeAction.type === 'add') {
      try {
        // "Smart Fill" Logic: Check if we can fill an existing fragmented row instead of creating a new one
        let success = false;
        
        if (activeAction.level === 'expense' && selectedGroup) {
          const gapRow = masterData.find(d => d['Group Head'] === selectedGroup && !d['Expense Head']);
          if (gapRow) {
            const oldV = { ...gapRow };
            const newV = { ...gapRow, 'Expense Head': val };
            await callApi('updateMaster', { level: 'expense', oldValue: oldV, newValue: newV });
            success = true;
          }
        } else if (activeAction.level === 'sub' && selectedGroup && selectedExpense) {
          const gapRow = masterData.find(d => d['Group Head'] === selectedGroup && d['Expense Head'] === selectedExpense && !d['Sub Head']);
          if (gapRow) {
            const oldV = { ...gapRow };
            const newV = { ...gapRow, 'Sub Head': val };
            await callApi('updateMaster', { level: 'sub', oldValue: oldV, newValue: newV });
            success = true;
          }
        }

        // If no suitable gap was found or we are adding a new Group, create a new row
        if (!success) {
          const payload =
            activeAction.level === 'group'   ? { 'Group Head': val, 'Expense Head': '', 'Sub Head': '' } :
            activeAction.level === 'expense' ? { 'Group Head': selectedGroup || '', 'Expense Head': val, 'Sub Head': '' } :
                                              { 'Group Head': selectedGroup || '', 'Expense Head': selectedExpense || '', 'Sub Head': val };
          
          await callApi('createMaster', payload);
        }

        toast.success(`Submitted ${val}`);
        
        // Auto-select the new item and set highlight
        setLastUpdated(val);
        if (activeAction.level === 'group') setSelectedGroup(val);
        if (activeAction.level === 'expense') setSelectedExpense(val);
        if (activeAction.level === 'sub') setSelectedSub(val);
        
        cancelAction();
        await fetchMasterData(true);
      } catch (e) {}
    } else {
      const { level, oldValue } = activeAction;
      if (val === oldValue) return cancelAction();

      const oldV =
        level === 'group'   ? { 'Group Head': oldValue } :
        level === 'expense' ? { 'Group Head': selectedGroup, 'Expense Head': oldValue } :
                              { 'Group Head': selectedGroup, 'Expense Head': selectedExpense, 'Sub Head': oldValue };
      const newV =
        level === 'group'   ? { 'Group Head': val } :
        level === 'expense' ? { 'Group Head': selectedGroup, 'Expense Head': val } :
                              { 'Group Head': selectedGroup, 'Expense Head': selectedExpense, 'Sub Head': val };

      try {
        await callApi('updateMaster', { level, oldValue: oldV, newValue: newV });
        toast.success(`Updated to ${val}`);
        setLastUpdated(val);
        if (level === 'group' && selectedGroup === oldValue) setSelectedGroup(val);
        if (level === 'expense' && selectedExpense === oldValue) setSelectedExpense(val);
        cancelAction();
        await fetchMasterData(true);
      } catch (e) {}
    }
  }, [inputValue, activeAction, selectedGroup, selectedExpense, callApi, cancelAction, fetchMasterData]);

  const handleDelete = async (level, value) => {
    if (!window.confirm(`Are you sure you want to delete "${value}"? All nested items will also be removed.`)) return;

    const payload =
      level === 'group'   ? { 'Group Head': value } :
      level === 'expense' ? { 'Group Head': selectedGroup, 'Expense Head': value } :
                            { 'Group Head': selectedGroup, 'Expense Head': selectedExpense, 'Sub Head': value };

    try {
      await callApi('deleteMaster', payload);
      toast.success(`Deleted ${value}`);
      if (level === 'group' && selectedGroup === value) { setSelectedGroup(null); setSelectedExpense(null); }
      if (level === 'expense' && selectedExpense === value) setSelectedExpense(null);
      await fetchMasterData(true);
    } catch (e) {}
  };

  // ---------- Sub-Components (Memoized for performance & focus stability) ----------
  const ColumnHeader = useCallback(({ title, icon: Icon, level, canAdd }) => {
    const colorClasses = 
      level === 'group'   ? 'bg-blue-50 text-blue-600' :
      level === 'expense' ? 'bg-indigo-50 text-indigo-600' :
                            'bg-sky-50 text-sky-600';
    const btnClasses = 
      level === 'group'   ? 'text-blue-600 hover:bg-blue-50 hover:border-blue-100' :
      level === 'expense' ? 'text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100' :
                            'text-sky-600 hover:bg-sky-50 hover:border-sky-100';

    return (
      <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-100 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${colorClasses}`}>
            <Icon size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{title}</h2>
            <p className="text-[10px] text-gray-400 font-medium">MANAGEMENT</p>
          </div>
        </div>
        {canAdd && (
          <button
            onClick={() => startAdd(level)}
            className={`p-2 rounded-xl transition-all active:scale-95 shadow-sm hover:shadow-md bg-white border border-transparent ${btnClasses}`}
            title={`Add ${title.slice(0, -1)}`}
          >
            <Plus size={20} />
          </button>
        )}
      </div>
    );
  }, [startAdd]);

  const renderActionInput = () => (
    <div className="m-3 p-1 bg-white rounded-2xl shadow-xl border border-blue-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCommit(); if (e.key === 'Escape') cancelAction(); }}
          placeholder={activeAction?.type === 'add' ? `Enter name...` : `Update name...`}
          className="w-full text-sm text-gray-900 bg-slate-50 border-none rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
        />
      </div>
      <div className="flex items-center gap-1 pr-1">
        <button 
          onClick={handleCommit} 
          disabled={saving || !inputValue.trim()}
          className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all active:scale-90 shadow-lg shadow-blue-200 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        </button>
        <button 
          onClick={cancelAction} 
          className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-all active:scale-90"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );

  // ---------- Main Render ----------
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 bg-slate-50/50 min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
              <Layers size={24} />
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Master Data</h1>
          </div>
          <p className="text-gray-500 text-sm font-medium ml-1">Configure your expense structure and hierarchy</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search everything..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 outline-none w-full md:w-80 shadow-inner transition-all placeholder:text-gray-400 font-medium"
            />
          </div>
          <button
            onClick={() => fetchMasterData()}
            disabled={fetching || saving}
            className="p-3.5 bg-white border border-gray-100 rounded-2xl text-gray-600 hover:text-blue-600 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={20} className={fetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Column 1: Group Heads */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col h-[600px] transition-all hover:shadow-md">
          <ColumnHeader title="Group Heads" icon={Layers} level="group" canAdd={true} />
          {activeAction?.type === 'add' && activeAction.level === 'group' && renderActionInput()}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {fetching ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-12 bg-slate-50 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : groupHeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 italic text-sm p-4 text-center">
                <Info size={24} className="mb-2 opacity-20" />
                No groups found
              </div>
            ) : groupHeads.map(gh => (
              <div
                key={gh}
                onClick={() => { setSelectedGroup(gh); setSelectedExpense(null); }}
                className={`group flex items-center justify-between px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-300 ${
                  selectedGroup === gh 
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 -translate-y-0.5' 
                    : 'hover:bg-blue-50 text-gray-900 hover:shadow-sm'
                } ${lastUpdated === gh ? 'animate-highlight' : ''}`}
              >
                {activeAction?.type === 'edit' && activeAction.level === 'group' && activeAction.oldValue === gh ? (
                  <div className="w-full" onClick={e => e.stopPropagation()}>{renderActionInput()}</div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedGroup === gh ? 'bg-white' : 'bg-blue-400'}`} />
                      <span className="text-sm font-bold truncate flex-1">{gh}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={e => { e.stopPropagation(); startEdit('group', gh); }} 
                        className={`p-2 rounded-xl transition-all ${selectedGroup === gh ? 'hover:bg-blue-500 text-blue-100' : 'hover:bg-blue-100 text-blue-600 bg-white shadow-sm'}`}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={e => { e.stopPropagation(); handleDelete('group', gh); }} 
                        className={`p-2 rounded-xl transition-all ${selectedGroup === gh ? 'hover:bg-blue-500 text-blue-100' : 'hover:bg-red-100 text-red-600 bg-white shadow-sm'}`}
                      >
                        <Trash2 size={14} />
                      </button>
                      <ChevronRight size={14} className={selectedGroup === gh ? 'text-blue-200' : 'text-gray-300'} />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Expense Heads */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col h-[600px] transition-all hover:shadow-md">
          <ColumnHeader title="Expense Heads" icon={Box} level="expense" canAdd={true} />
          {activeAction?.type === 'add' && activeAction.level === 'expense' && renderActionInput()}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {fetching ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-12 bg-slate-50 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : expenseHeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 italic text-sm p-4 text-center">
                <Plus size={24} className="mb-2 opacity-20" />
                No expense heads found
              </div>
            ) : expenseHeads.map(eh => (
              <div
                key={eh}
                onClick={() => setSelectedExpense(eh)}
                className={`group flex items-center justify-between px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-300 ${
                  selectedExpense === eh 
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 -translate-y-0.5' 
                    : 'hover:bg-indigo-50 text-gray-900 hover:shadow-sm'
                } ${lastUpdated === eh ? 'animate-highlight' : ''}`}
              >
                {activeAction?.type === 'edit' && activeAction.level === 'expense' && activeAction.oldValue === eh ? (
                  <div className="w-full" onClick={e => e.stopPropagation()}>{renderActionInput()}</div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedExpense === eh ? 'bg-white' : 'bg-indigo-400'}`} />
                      <span className="text-sm font-bold truncate flex-1">{eh}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={e => { e.stopPropagation(); startEdit('expense', eh); }} 
                        className={`p-2 rounded-xl transition-all ${selectedExpense === eh ? 'hover:bg-indigo-500 text-indigo-100' : 'hover:bg-indigo-100 text-indigo-600 bg-white shadow-sm'}`}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={e => { e.stopPropagation(); handleDelete('expense', eh); }} 
                        className={`p-2 rounded-xl transition-all ${selectedExpense === eh ? 'hover:bg-indigo-500 text-indigo-100' : 'hover:bg-red-100 text-red-600 bg-white shadow-sm'}`}
                      >
                        <Trash2 size={14} />
                      </button>
                      <ChevronRight size={14} className={selectedExpense === eh ? 'text-indigo-200' : 'text-gray-300'} />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Sub Heads */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col h-[600px] transition-all hover:shadow-md">
          <ColumnHeader title="Sub Heads" icon={Subtitles} level="sub" canAdd={true} />
          {activeAction?.type === 'add' && activeAction.level === 'sub' && renderActionInput()}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {fetching ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-slate-50 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : subHeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 italic text-sm p-4 text-center">
                <Plus size={24} className="mb-2 opacity-20" />
                No sub heads found
              </div>
            ) : subHeads.map(sh => (
              <div
                key={sh}
                onClick={() => setSelectedSub(sh)}
                className={`group flex items-center justify-between px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-300 ${
                  selectedSub === sh 
                    ? 'bg-sky-600 text-white shadow-xl shadow-sky-200 -translate-y-0.5' 
                    : 'hover:bg-sky-50 text-gray-900 hover:shadow-sm'
                } ${lastUpdated === sh ? 'animate-highlight' : ''}`}
              >
                {activeAction?.type === 'edit' && activeAction.level === 'sub' && activeAction.oldValue === sh ? (
                  <div className="w-full" onClick={e => e.stopPropagation()}>{renderActionInput()}</div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedSub === sh ? 'bg-white' : 'bg-sky-400'}`} />
                      <span className="text-sm font-bold truncate flex-1">{sh}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={e => { e.stopPropagation(); startEdit('sub', sh); }} 
                        className={`p-2 rounded-xl transition-all ${selectedSub === sh ? 'hover:bg-sky-500 text-sky-100' : 'hover:bg-sky-100 text-sky-600 bg-white shadow-sm'}`}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={e => { e.stopPropagation(); handleDelete('sub', sh); }} 
                        className={`p-2 rounded-xl transition-all ${selectedSub === sh ? 'hover:bg-sky-500 text-sky-100' : 'hover:bg-red-100 text-red-600 bg-white shadow-sm'}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Syncing Overlay */}
      {saving && (
        <div className="fixed bottom-8 right-8 bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce z-50">
          <Loader2 size={20} className="animate-spin" />
          <span className="font-bold text-sm">Saving changes...</span>
        </div>
      )}

      {/* Error Alert */}
      {fetchError && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50">
          <AlertCircle size={20} />
          <span className="font-bold text-sm">{fetchError}</span>
          <button onClick={() => fetchMasterData()} className="ml-4 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-xs transition-colors">Retry</button>
        </div>
      )}
    </div>
  );
}