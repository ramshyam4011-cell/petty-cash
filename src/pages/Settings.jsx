import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  Trash2, Edit2, Plus, Search, Eye, EyeOff, X,
  RefreshCw, Loader2, Users, UserCheck, UserPlus,
  ShieldCheck, MapPin, Building2, Layers
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;

const availablePages = [
  'Dashboard', 'Entry', 'Approval Panel', 'Head Master', 'Settings'
];

export default function Settings() {
  const { user: authUser } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [allGroupHeads, setAllGroupHeads] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveDate, setArchiveDate] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [allRecords, setAllRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const [newUser, setNewUser] = useState({
    name: '', id: '', password: '', role: 'USER',
    branch: 'Head Office', department: 'Accounts',
    reportedBy: '', pageAccess: ['Dashboard', 'Entry'],
    groupHeads: []
  });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(APPSCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'readSetting' }) });
      const json = await res.json();
      if (json.success) {
        const mapped = (json.data || []).map(row => ({
          name: row['user'] || '', id: row['user name'] || '', password: row['password'] || '',
          role: (row['role'] || 'USER').toUpperCase(), branch: row['branch'] || 'Head Office',
          department: row['department'] || 'Accounts',
          reportedBy: row['Reported by'] || '',
          pageAccess: row['Page access'] ? row['Page access'].split(',').map(s => s.trim()) : [],
          groupHeads: row['Group Heads'] ? row['Group Heads'].split(',').map(s => s.trim()).filter(Boolean) : []
        })).filter(u => u.id);
        setUsers(mapped);
      }
    } catch { toast.error('Error loading user data'); }
  }, []);

  const fetchMasterData = useCallback(async () => {
    try {
      const res = await fetch(APPSCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'readMaster' }) });
      const json = await res.json();
      if (json.success) {
        const raw = json.data || [];
        const b = [...new Set(raw.map(r => r['Branch'] || r['Branches']).filter(Boolean))].sort();
        const gh = [...new Set(raw.map(r => r['Group Head'] || r['Group Heads']).filter(Boolean))].sort();
        setBranches(b);
        setAllGroupHeads(gh);
      }
    } catch {}
  }, []);

  const init = async () => {
    setFetching(true);
    await Promise.all([fetchUsers(), fetchMasterData()]);
    setFetching(false);
  };

  useEffect(() => { init(); }, []);

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          u.id?.toLowerCase().includes(searchTerm.toLowerCase());
    const authRole = authUser?.role?.toUpperCase();
    const authId = authUser?.id || '';
    if (authRole === 'SUPER_ADMIN') return matchesSearch;
    return matchesSearch && (
      (u.role === 'USER' && u.reportedBy === authId) ||
      u.id === authId
    );
  });

  // Only ADMIN and SUPER_ADMIN can be selected as "Reported By" manager
  const managerOptions = useMemo(() =>
    users.filter(u => {
      const r = (u.role || '').toUpperCase();
      return r === 'ADMIN' || r === 'SUPER_ADMIN';
    }),
    [users]
  );

  const toggleGroupHead = (gh) => {
    const current = newUser.groupHeads || [];
    const updated = current.includes(gh) ? current.filter(g => g !== gh) : [...current, gh];
    setNewUser({ ...newUser, groupHeads: updated });
  };

  const handleSaveUser = async () => {
    if (!newUser.name || !newUser.id || !newUser.password) return toast.error('Fill required fields');
    if (newUser.role === 'ADMIN' && !newUser.reportedBy) {
      return toast.error('Administrators must report to a Manager (Super Admin)');
    }
    let userToSave = { ...newUser };
    if (authUser?.role?.toUpperCase() === 'ADMIN' && userToSave.role === 'USER') {
      userToSave.reportedBy = authUser.id;
    }

    setSubmitting(true);
    const toastId = toast.loading('Saving...');
    try {
      const payload = {
        'user': userToSave.name,
        'user name': userToSave.id,
        'password': userToSave.password,
        'role': userToSave.role,
        'branch': userToSave.branch,
        'department': userToSave.department,
        'Reported by': userToSave.reportedBy,
        'Page access': userToSave.pageAccess.join(','),
        'Group Heads': (userToSave.groupHeads || []).join(',')
      };
      let res;
      if (editingUserId) {
        res = await fetch(APPSCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'updateSetting', data: { oldValue: { 'user name': editingUserId }, newValue: payload } }) });
      } else {
        if (users.some(u => u.id === userToSave.id)) { toast.error('Username exists', { id: toastId }); setSubmitting(false); return; }
        res = await fetch(APPSCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'createSetting', data: payload }) });
      }
      const json = await res.json();
      if (json.success) { toast.success('User saved', { id: toastId }); setIsModalOpen(false); fetchUsers(); }
      else toast.error(json.error || 'Save failed', { id: toastId });
    } catch { toast.error('Save failed', { id: toastId }); } finally { setSubmitting(false); }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Permanently remove this user?')) return;
    setDeletingId(userId);
    try {
      const res = await fetch(APPSCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteSetting', data: { 'user name': userId } }) });
      const json = await res.json();
      if (json.success) { toast.success('User removed'); fetchUsers(); }
    } catch { toast.error('Delete failed'); } finally { setDeletingId(null); }
  };

  const fetchAllRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await fetch(APPSCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'read' }) });
      const json = await res.json();
      if (json.success) setAllRecords(json.data || []);
    } catch { toast.error('Failed to fetch records for preview'); }
    finally { setLoadingRecords(false); }
  };

  useEffect(() => {
    if (isArchiveModalOpen) {
      fetchAllRecords();
    }
  }, [isArchiveModalOpen]);

  const handleArchiveData = async () => {
    if (!archiveDate) return toast.error('Select a date');
    if (!confirm(`Are you sure? All approved/inflow entries BEFORE ${archiveDate} will be deleted and replaced with an Opening Balance entry.`)) return;
    
    setArchiving(true);
    const toastId = toast.loading('Archiving data...');
    try {
      const res = await fetch(APPSCRIPT_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: 'archive', date: archiveDate }) 
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message + ' ' + (json.details || ''), { id: toastId });
        setIsArchiveModalOpen(false);
        setArchiveDate('');
      } else {
        toast.error(json.error || 'Archive failed', { id: toastId });
      }
    } catch {
      toast.error('Archive failed', { id: toastId });
    } finally {
      setArchiving(false);
    }
  };

  const openAddModal = () => {
    setEditingUserId(null);
    setNewUser({
      name: '', id: '', password: '', role: 'USER',
      branch: branches[0] || 'Head Office',
      department: 'Accounts',
      reportedBy: authUser?.role?.toUpperCase() === 'ADMIN' ? authUser.id : '',
      pageAccess: ['Dashboard', 'Entry'],
      groupHeads: []
    });
    setIsModalOpen(true);
  };

  const openEditModal = (u) => {
    setEditingUserId(u.id);
    setNewUser({ ...u, groupHeads: u.groupHeads || [] });
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-2">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-xs sm:text-sm text-slate-500">Manage user access and system permissions</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={init} className="flex-1 sm:flex-none p-2.5 bg-white border border-slate-300 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center">
            <RefreshCw size={18} className={fetching ? 'animate-spin' : ''} />
          </button>
          <button onClick={openAddModal} className="flex-[3] sm:flex-none px-4 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95">
            <UserPlus size={16} /> Add User
          </button>
          {authUser?.role === 'SUPER_ADMIN' && (
            <button onClick={() => setIsArchiveModalOpen(true)} className="flex-[3] sm:flex-none px-4 py-2.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95">
              <Trash2 size={16} /> Archive Data
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between sm:block">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest sm:mb-1">Total Users</p>
          <p className="text-lg font-bold text-slate-900">{users.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between sm:block">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest sm:mb-1">Admins</p>
          <p className="text-lg font-bold text-blue-600">{users.filter(u => u.role === 'ADMIN').length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between sm:block">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest sm:mb-1">Branches</p>
          <p className="text-lg font-bold text-emerald-600">{branches.length}</p>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-20">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
          <Search size={14} className="text-slate-400" />
          <input type="text" placeholder="Search by name or username..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="text-xs font-bold text-slate-700 bg-transparent outline-none w-full" />
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-slate-500 border-b border-slate-200 uppercase text-[10px] tracking-widest font-black">
              <tr>
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Username</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Branch / Dept</th>
                <th className="px-6 py-3">Group Heads</th>
                <th className="px-6 py-3">Access</th>
                <th className="px-6 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">{u.name.charAt(0)}</div>
                      <span className="font-bold text-slate-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-blue-600">@{u.id}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase ${u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>{u.role}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-700 text-[11px]">{u.branch}</span>
                      <span className="text-[10px] text-slate-400">{u.department}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(u.groupHeads || []).slice(0, 2).map(g => <span key={g} className="text-[9px] px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-indigo-500">{g}</span>)}
                      {(u.groupHeads || []).length > 2 && <span className="text-[9px] text-slate-300">+{u.groupHeads.length - 2}</span>}
                      {(u.groupHeads || []).length === 0 && <span className="text-[9px] text-slate-300">All</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {u.pageAccess.slice(0, 3).map(p => <span key={p} className="text-[9px] px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-400">{p}</span>)}
                      {u.pageAccess.length > 3 && <span className="text-[9px] text-slate-300">+{u.pageAccess.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-2">
                      {(authUser?.role === 'SUPER_ADMIN' || (authUser?.role === 'ADMIN' && u.role === 'USER')) ? (
                        <>
                          <button onClick={() => openEditModal(u)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors">{deletingId === u.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}</button>
                        </>
                      ) : (
                        <span className="p-1.5 text-slate-300 cursor-not-allowed"><ShieldCheck size={14} /></span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden divide-y divide-slate-100">
          {filteredUsers.map((u, idx) => (
            <div key={idx} className="p-4 space-y-3 active:bg-slate-50 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm uppercase shadow-lg shadow-blue-500/20">{u.name.charAt(0)}</div>
                  <div>
                    <p className="font-black text-slate-900 text-sm">{u.name}</p>
                    <p className="text-xs font-bold text-blue-600">@{u.id}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full border text-[8px] font-black uppercase ${u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>{u.role}</span>
              </div>
              {(u.groupHeads || []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {u.groupHeads.map(g => <span key={g} className="text-[9px] px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-indigo-500">{g}</span>)}
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-700 text-[10px] uppercase tracking-tighter">{u.branch}</span>
                  <span className="text-[9px] text-slate-400">{u.department}</span>
                </div>
                <div className="flex gap-4">
                  {(authUser?.role === 'SUPER_ADMIN' || (authUser?.role === 'ADMIN' && u.role === 'USER')) ? (
                    <>
                      <button onClick={() => openEditModal(u)} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase"><Edit2 size={12} /> Edit</button>
                      <button onClick={() => handleDeleteUser(u.id)} className="flex items-center gap-1 text-[10px] font-bold text-rose-600 uppercase"><Trash2 size={12} /> Delete</button>
                    </>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-300 uppercase flex items-center gap-1"><ShieldCheck size={12} /> Secured</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-end sm:items-center justify-center z-[9999] sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-xl flex flex-col overflow-hidden border border-slate-200 h-[92vh] sm:h-auto sm:max-h-[92vh]">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <h2 className="font-black text-slate-900 uppercase tracking-tight text-sm sm:text-base">{editingUserId ? 'Update User Account' : 'Register New Member'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} className="text-slate-500" /></button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">

              {/* Name & Username */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={newUser.name}
                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Enter full name..."
                    className={`w-full border rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-colors ${
                      !newUser.name ? 'border-rose-300 bg-rose-50/30 placeholder-rose-300' : 'border-slate-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Username</label>
                  <input disabled={!!editingUserId} value={newUser.id} onChange={e => setNewUser({ ...newUser, id: e.target.value })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none disabled:bg-slate-50" />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none" />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2 text-slate-400">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Role</label>
                <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} disabled={authUser?.role === 'ADMIN'} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed">
                  <option value="USER">Standard User</option>
                  {authUser?.role === 'SUPER_ADMIN' && <option value="ADMIN">Administrator</option>}
                  {authUser?.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Admin</option>}
                </select>
              </div>

              {/* Branch & Department */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Branch</label>
                  <select value={newUser.branch} onChange={e => setNewUser({ ...newUser, branch: e.target.value })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none">
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Department</label>
                  <input value={newUser.department} onChange={e => setNewUser({ ...newUser, department: e.target.value })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none" placeholder="e.g. Accounts, Sales..." />
                </div>
              </div>

              {/* Reported By — dropdown of Admins */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reported By (Manager)</label>
                <select
                  value={newUser.reportedBy}
                  onChange={e => setNewUser({ ...newUser, reportedBy: e.target.value })}
                  disabled={authUser?.role?.toUpperCase() === 'ADMIN'}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
                >
                  {newUser.role !== 'ADMIN' && <option value="">— None / Self —</option>}
                  {managerOptions.map(u => {
                    const roleLabel = u.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin';
                    return (
                      <option key={u.id} value={u.id}>
                        {u.name || u.id} (@{u.id}) [{roleLabel}]
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Group Heads — multi-select chips */}
              <div>
                <div className="flex items-center gap-1 mb-2">
                  <Layers size={10} className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Allowed Group Heads</span>
                  <span className="text-[9px] text-slate-300 font-medium normal-case ml-1">(leave empty = all)</span>
                </div>
                {allGroupHeads.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No group heads in master data yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50 max-h-36 overflow-y-auto">
                    {allGroupHeads.map(gh => {
                      const selected = (newUser.groupHeads || []).includes(gh);
                      return (
                        <button
                          key={gh}
                          type="button"
                          onClick={() => toggleGroupHead(gh)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${selected ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm' : 'bg-white border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600'}`}
                        >
                          {gh}
                        </button>
                      );
                    })}
                  </div>
                )}
                {(newUser.groupHeads || []).length > 0 && (
                  <p className="text-[9px] text-indigo-500 font-bold mt-1 uppercase tracking-wider">{newUser.groupHeads.length} group head(s) assigned</p>
                )}
              </div>

              {/* Module Access */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Module Access</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {availablePages.map(page => (
                    <label key={page} className={`flex items-center gap-2 p-2 border rounded cursor-pointer transition-all ${newUser.pageAccess.includes(page) ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'} ${(newUser.role === 'ADMIN' || newUser.role === 'SUPER_ADMIN') && authUser?.role?.toUpperCase() !== 'SUPER_ADMIN' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={newUser.pageAccess.includes(page)}
                        disabled={(newUser.role === 'ADMIN' || newUser.role === 'SUPER_ADMIN') && authUser?.role?.toUpperCase() !== 'SUPER_ADMIN'}
                        onChange={() => {
                          const upd = newUser.pageAccess.includes(page) ? newUser.pageAccess.filter(p => p !== page) : [...newUser.pageAccess, page];
                          setNewUser({ ...newUser, pageAccess: upd });
                        }}
                      />
                      <span className="text-[11px] font-bold">{page}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
              <button onClick={handleSaveUser} disabled={submitting} className="flex-1 bg-slate-900 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-lg shadow-slate-900/10 transition-all active:scale-95 disabled:opacity-50">
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setIsModalOpen(false)} className="px-6 bg-white border border-slate-300 text-slate-500 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <ArchiveModal 
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        date={archiveDate}
        setDate={setArchiveDate}
        onConfirm={handleArchiveData}
        loading={archiving}
        allRecords={allRecords}
        loadingRecords={loadingRecords}
      />
    </div>
  );
}

// Separate Modal for Archiving
function ArchiveModal({ isOpen, onClose, date, setDate, onConfirm, loading, allRecords, loadingRecords }) {
  const previewRecords = useMemo(() => {
    if (!date || !allRecords.length) return [];
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    return allRecords.filter(r => {
      const rowDate = new Date(r.Date);
      rowDate.setHours(0, 0, 0, 0);
      return rowDate < targetDate && r.Flow !== 'IN' && r.Status === 'APPROVED' && r['Delete Status'] !== 'DELETED';
    });
  }, [date, allRecords]);

  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 bg-rose-50 flex justify-between items-center shrink-0">
          <h2 className="font-black text-rose-900 uppercase tracking-tight text-sm">Archive Past Entries</h2>
          <button onClick={onClose} className="p-2 hover:bg-rose-100 rounded-full transition-colors"><X size={20} className="text-rose-500" /></button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3">
            <ShieldAlert size={20} className="text-amber-600 shrink-0" />
            <p className="text-[11px] font-bold text-amber-800 leading-relaxed uppercase">
              Warning: This will permanently delete entries BEFORE the selected date. 
              The system will consolidate their balance into a single entry.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Select Archive Threshold Date</label>
              <input 
                type="date" 
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-rose-500/10 text-sm font-bold text-slate-700 bg-slate-50"
              />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-center">
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Entries to be deleted</p>
               <p className="text-xl font-black text-rose-600">{previewRecords.length}</p>
            </div>
          </div>

          {date && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Preview of records to be removed {loadingRecords && <Loader2 size={12} className="animate-spin" />}
              </p>
              
              {previewRecords.length === 0 ? (
                <div className="py-10 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-slate-300 uppercase italic">No records found before this date</p>
                </div>
              ) : (
                <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50 bg-slate-50/30">
                  {previewRecords.slice(0, 10).map((r, i) => (
                    <div key={i} className="p-3 flex justify-between items-center bg-white">
                      <div>
                        <p className="text-[10px] font-black text-slate-900 uppercase">{r['Group Head']}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">{r.Date} • {r['Paid To'] || 'No details'}</p>
                      </div>
                      <p className="text-xs font-black text-rose-600">-{parseFloat(r['Amount (INR)']).toLocaleString()}</p>
                    </div>
                  ))}
                  {previewRecords.length > 10 && (
                    <div className="p-3 bg-slate-50 text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">And {previewRecords.length - 10} more records...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
          <button 
            onClick={onConfirm} 
            disabled={loading || !date || previewRecords.length === 0}
            className="flex-1 bg-rose-600 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 shadow-lg shadow-rose-900/10 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Confirm Archive'}
          </button>
          <button onClick={onClose} className="px-6 bg-white border border-slate-300 text-slate-500 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ShieldAlert({ size, className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}
