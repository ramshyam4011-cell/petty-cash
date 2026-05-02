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
                            'bg-indigo-50 text-indigo-600';
    const btnClasses = 
      level === 'group'   ? 'text-blue-600 hover:bg-blue-50 hover:border-blue-100' :
      level === 'expense' ? 'text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100' :
                            'text-indigo-600 hover:bg-indigo-50 hover:border-sky-100';

    return (
      <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-100 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${colorClasses}`}>
            <Icon size={20} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800  tracking-wider">{title}</h2>
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
    <div className="m-3 p-1 bg-white rounded-2xl shadow-sm border border-blue-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
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
          className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all active:scale-90 shadow-sm shadow-blue-200 disabled:opacity-50"
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
    <div className="p-0 md:p-8 space-y-8 md:space-y-12 animate-in fade-in duration-1000 bg-slate-50/50 min-h-screen">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 px-4 md:px-0">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 font-semibold text-[10px]   px-3.5 py-1.5 rounded-full mb-3 shadow-sm">
            <Layers size={12} />
            <span>Infrastructure Architecture</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold text-slate-900  leading-none mb-2">Master Data Control</h1>
          <p className="text-slate-500 font-medium italic">Define and govern the hierarchical structure of financial records</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative group w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search across hierarchy..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-sm transition-all placeholder:text-slate-300"
            />
          </div>
          <button
            onClick={() => fetchMasterData()}
            disabled={fetching || saving}
            className="w-full sm:w-auto p-4 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 shadow-sm shadow-slate-200"
          >
            <RefreshCw size={20} className={fetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Hierarchical Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-2 md:px-0">

        {/* Column 1: Group Heads */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[500px] md:h-[600px] transition-all hover:shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
          <ColumnHeader title="Group Heads" icon={Layers} level="group" canAdd={true} />
          {activeAction?.type === 'add' && activeAction.level === 'group' && renderActionInput()}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
            {fetching ? (
              <div className="space-y-3 p-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-14 bg-slate-50 animate-pulse rounded-2xl border border-slate-100" />
                ))}
              </div>
            ) : groupHeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 text-center p-8">
                <Box size={40} className="mb-4 opacity-20" />
                <p className="text-[10px] font-semibold  ">No Primary Groups</p>
              </div>
            ) : groupHeads.map(gh => (
              <div
                key={gh}
                onClick={() => { setSelectedGroup(gh); setSelectedExpense(null); }}
                className={`group flex items-center justify-between px-5 py-4 rounded-2xl cursor-pointer transition-all duration-500 relative overflow-hidden ${
                  selectedGroup === gh 
                    ? 'bg-slate-900 text-white shadow-sm shadow-slate-200 -translate-y-1' 
                    : 'hover:bg-indigo-50/50 text-slate-700'
                } ${lastUpdated === gh ? 'animate-highlight' : ''}`}
              >
                {activeAction?.type === 'edit' && activeAction.level === 'group' && activeAction.oldValue === gh ? (
                  <div className="w-full" onClick={e => e.stopPropagation()}>{renderActionInput()}</div>
                ) : (
                  <>
                    <div className="flex items-center gap-4 overflow-hidden relative z-10">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedGroup === gh ? 'bg-indigo-400' : 'bg-slate-200'}`} />
                      <span className="text-[13px] font-semibold   truncate">{gh}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 transition-all duration-300 ${selectedGroup === gh ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <button 
                        onClick={e => { e.stopPropagation(); startEdit('group', gh); }} 
                        className={`p-2 rounded-xl transition-all ${selectedGroup === gh ? 'hover:bg-white/10 text-white' : 'hover:bg-white text-indigo-600 bg-white shadow-sm border border-slate-100'}`}
                      >
                        <Edit2 size={14} strokeWidth={2.5} />
                      </button>
                      <button 
                        onClick={e => { e.stopPropagation(); handleDelete('group', gh); }} 
                        className={`p-2 rounded-xl transition-all ${selectedGroup === gh ? 'hover:bg-rose-500 text-white' : 'hover:bg-rose-50 text-rose-600 bg-white shadow-sm border border-slate-100'}`}
                      >
                        <Trash2 size={14} strokeWidth={2.5} />
                      </button>
                      <ChevronRight size={14} className={selectedGroup === gh ? 'text-indigo-400' : 'text-slate-300'} strokeWidth={3} />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Expense Heads */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[500px] md:h-[600px] transition-all hover:shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
          <ColumnHeader title="Expense Heads" icon={Box} level="expense" canAdd={true} />
          {activeAction?.type === 'add' && activeAction.level === 'expense' && renderActionInput()}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
            {fetching ? (
              <div className="space-y-3 p-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-14 bg-slate-50 animate-pulse rounded-2xl border border-slate-100" />
                ))}
              </div>
            ) : expenseHeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 text-center p-8">
                <Subtitles size={40} className="mb-4 opacity-20" />
                <p className="text-[10px] font-semibold  ">No Secondary Heads</p>
              </div>
            ) : expenseHeads.map(eh => (
              <div
                key={eh}
                onClick={() => setSelectedExpense(eh)}
                className={`group flex items-center justify-between px-5 py-4 rounded-2xl cursor-pointer transition-all duration-500 relative overflow-hidden ${
                  selectedExpense === eh 
                    ? 'bg-slate-900 text-white shadow-sm shadow-slate-200 -translate-y-1' 
                    : 'hover:bg-indigo-50/50 text-slate-700'
                } ${lastUpdated === eh ? 'animate-highlight' : ''}`}
              >
                {activeAction?.type === 'edit' && activeAction.level === 'expense' && activeAction.oldValue === eh ? (
                  <div className="w-full" onClick={e => e.stopPropagation()}>{renderActionInput()}</div>
                ) : (
                  <>
                    <div className="flex items-center gap-4 overflow-hidden relative z-10">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedExpense === eh ? 'bg-sky-400' : 'bg-slate-200'}`} />
                      <span className="text-[13px] font-semibold   truncate">{eh}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 transition-all duration-300 ${selectedExpense === eh ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <button 
                        onClick={e => { e.stopPropagation(); startEdit('expense', eh); }} 
                        className={`p-2 rounded-xl transition-all ${selectedExpense === eh ? 'hover:bg-white/10 text-white' : 'hover:bg-white text-indigo-600 bg-white shadow-sm border border-slate-100'}`}
                      >
                        <Edit2 size={14} strokeWidth={2.5} />
                      </button>
                      <button 
                        onClick={e => { e.stopPropagation(); handleDelete('expense', eh); }} 
                        className={`p-2 rounded-xl transition-all ${selectedExpense === eh ? 'hover:bg-rose-500 text-white' : 'hover:bg-rose-50 text-rose-600 bg-white shadow-sm border border-slate-100'}`}
                      >
                        <Trash2 size={14} strokeWidth={2.5} />
                      </button>
                      <ChevronRight size={14} className={selectedExpense === eh ? 'text-sky-400' : 'text-slate-300'} strokeWidth={3} />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Sub Heads */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[500px] md:h-[600px] transition-all hover:shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
          <ColumnHeader title="Sub Heads" icon={Subtitles} level="sub" canAdd={true} />
          {activeAction?.type === 'add' && activeAction.level === 'sub' && renderActionInput()}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
            {fetching ? (
              <div className="space-y-3 p-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 bg-slate-50 animate-pulse rounded-2xl border border-slate-100" />
                ))}
              </div>
            ) : subHeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 text-center p-8">
                <Plus size={40} className="mb-4 opacity-20" />
                <p className="text-[10px] font-semibold  ">No Tertiary Detail</p>
              </div>
            ) : subHeads.map(sh => (
              <div
                key={sh}
                onClick={() => setSelectedSub(sh)}
                className={`group flex items-center justify-between px-5 py-4 rounded-2xl cursor-pointer transition-all duration-500 relative overflow-hidden ${
                  selectedSub === sh 
                    ? 'bg-slate-900 text-white shadow-sm shadow-slate-200 -translate-y-1' 
                    : 'hover:bg-emerald-50/50 text-slate-700'
                } ${lastUpdated === sh ? 'animate-highlight' : ''}`}
              >
                {activeAction?.type === 'edit' && activeAction.level === 'sub' && activeAction.oldValue === sh ? (
                  <div className="w-full" onClick={e => e.stopPropagation()}>{renderActionInput()}</div>
                ) : (
                  <>
                    <div className="flex items-center gap-4 overflow-hidden relative z-10">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedSub === sh ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                      <span className="text-[13px] font-semibold   truncate">{sh}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 transition-all duration-300 ${selectedSub === sh ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <button 
                        onClick={e => { e.stopPropagation(); startEdit('sub', sh); }} 
                        className={`p-2 rounded-xl transition-all ${selectedSub === sh ? 'hover:bg-white/10 text-white' : 'hover:bg-white text-emerald-600 bg-white shadow-sm border border-slate-100'}`}
                      >
                        <Edit2 size={14} strokeWidth={2.5} />
                      </button>
                      <button 
                        onClick={e => { e.stopPropagation(); handleDelete('sub', sh); }} 
                        className={`p-2 rounded-xl transition-all ${selectedSub === sh ? 'hover:bg-rose-500 text-white' : 'hover:bg-rose-50 text-rose-600 bg-white shadow-sm border border-slate-100'}`}
                      >
                        <Trash2 size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Industrial Feedback Toast (Persistent) */}
      {saving && (
        <div className="fixed bottom-8 right-8 bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-sm flex items-center gap-4 animate-bounce z-50 border border-white/10">
          <Loader2 size={20} className="animate-spin text-indigo-400" />
          <span className="font-semibold text-[10px]  ">Synchronizing Master Records...</span>
        </div>
      )}

      {/* Global Persistence Note */}
      <div className="flex items-center justify-center py-10 opacity-30 grayscale pointer-events-none">
         <img src="/logo.png" alt="System" className="h-6" />
      </div>
    </div>
  );
}
