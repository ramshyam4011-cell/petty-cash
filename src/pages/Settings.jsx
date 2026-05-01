import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { 
  Trash2, Edit2, Plus, Search, Eye, EyeOff, X, 
  RefreshCw, Loader2, Users, UserCheck, UserPlus, 
  ShieldCheck, MapPin, Building2 
} from 'lucide-react';
import { getAuthUser } from '../utils/storageManager';

const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;

const branches = [
  'Head Office', 'Mumbai Branch', 'Delhi Branch', 'Bangalore Branch',
  'Chennai Branch', 'Hyderabad Branch', 'Kolkata Branch', 'Pune Branch'
];

const departments = [
  'Accounts', 'Sales', 'Operations', 'HR', 'IT', 'Marketing', 'Admin', 'Finance'
];

const availablePages = [
  'Dashboard', 'Add Expenses', 'Approval Panel', 'Expense List', 
  'Petty Cash', 'Reports', 'Head Master', 'Settings'
];

const getAvatarColor = (name) => {
  const colors = ['bg-indigo-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
  return colors[name ? name.length % colors.length : 0];
};

export default function Settings() {
  const [users, setUsers] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [authUser, setAuthUser] = useState(null);

  const abortControllerRef = useRef(null);

  const [newUser, setNewUser] = useState({
    name: '',
    id: '',
    password: '',
    role: 'USER',
    branch: 'Head Office',
    department: 'Accounts',
    pageAccess: [] // New field
  });

  // ---------- Data fetching ----------
  const fetchUsers = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setFetching(true);
      const res = await fetch(APPSCRIPT_URL, {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({ action: 'readSetting' })
      });
      const json = await res.json();
      if (json.success) {
        const mapped = (json.data || [])
          .map(row => ({
            name: row['user'] || '',
            id: row['user name'] || '',
            password: row['password'] || '',
            role: (row['role'] || 'USER').toUpperCase(),
            branch: row['branch'] || 'Head Office',
            department: row['department'] || 'Accounts',
            pageAccess: row['Page access'] ? row['Page access'].split(',').map(s => s.trim()) : []
          }))
          .filter(u => u.id);
        setUsers(mapped);
      } else {
        throw new Error(json.error || 'Failed to load users');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        toast.error(err.message || 'Network error while loading users');
      }
    } finally {
      if (!controller.signal.aborted) setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    setAuthUser(getAuthUser());
    return () => abortControllerRef.current?.abort();
  }, [fetchUsers]);

  // ---------- Helpers ----------
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === 'ADMIN').length;
  const userCount = users.filter(u => u.role === 'USER').length;

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setNewUser({ 
      name: '', id: '', password: '', role: 'USER', 
      branch: 'Head Office', department: 'Accounts',
      pageAccess: [] 
    });
    setEditingUserId(null);
    setShowPassword(false);
  };

  const openAddModal = () => { resetForm(); setIsModalOpen(true); };
  const openEditModal = (user) => {
    setNewUser({
      name: user.name || '',
      id: user.id || '',
      password: user.password || '',
      role: user.role || 'USER',
      branch: user.branch || 'Head Office',
      department: user.department || 'Accounts',
      pageAccess: user.pageAccess || []
    });
    setEditingUserId(user.id);
    setIsModalOpen(true);
    setShowPassword(false);
  };
  const closeModal = () => { setIsModalOpen(false); resetForm(); };

  // ---------- Save (create/update) ----------
  const handleSaveUser = async () => {
    if (!APPSCRIPT_URL) return toast.error('VITE_APPSCRIPT_URL is not defined in .env');
    const trimmed = {
      name: newUser.name.trim(),
      id: newUser.id.trim(),
      password: newUser.password.trim(),
      role: newUser.role.trim().toUpperCase(),
      branch: newUser.branch.trim(),
      department: newUser.department.trim()
    };

    if (!trimmed.name || !trimmed.id || !trimmed.password) return toast.error('All fields are required');
    if (trimmed.password.length < 4) return toast.error('Password must be at least 4 characters');

    setSubmitting(true);
    const loadingToast = toast.loading(editingUserId ? 'Updating...' : 'Creating...');

    try {
      const payload = {
        'user': trimmed.name,
        'user name': trimmed.id,
        'password': trimmed.password,
        'role': trimmed.role,
        'branch': trimmed.branch,
        'department': trimmed.department,
        'Page access': newUser.pageAccess.join(',') // Sending as comma-separated string
      };

      let response;
      if (editingUserId) {
        response = await fetch(APPSCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'updateSetting',
            data: {
              oldValue: { 'user name': editingUserId },
              newValue: payload
            }
          })
        });
      } else {
        if (users.some(u => u.id === trimmed.id)) {
          toast.dismiss(loadingToast);
          toast.error('Username already exists');
          return setSubmitting(false);
        }
        response = await fetch(APPSCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'createSetting',
            data: payload
          })
        });
      }

      let json;
      const text = await response.text();
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error('Raw response:', text);
        throw new Error('Server returned an invalid response. Please check your Apps Script deployment.');
      }

      toast.dismiss(loadingToast);

      if (!json.success) {
        throw new Error(json.error || 'Operation failed');
      } else {
        toast.success(editingUserId ? 'User updated successfully!' : 'User created successfully!');
        closeModal();
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error saving user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    setDeletingId(userId);
    const loadingToast = toast.loading('Deleting user...');

    try {
      const res = await fetch(APPSCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'deleteSetting',
          data: { 'user name': userId }
        })
      });
      const json = await res.json();
      toast.dismiss(loadingToast);

      if (!json.success) {
        throw new Error(json.error || 'Failed to delete');
      } else {
        toast.success('User removed from system');
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error deleting user');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 bg-slate-50/50 min-h-screen">
      {/* Page Header */}
      <div className="sticky top-0 z-[40] -mx-6 md:-mx-10 px-6 md:px-10 py-6 bg-white/80 backdrop-blur-md border-b border-gray-200/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
              <Users size={24} />
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">System Settings</h1>
          </div>
          <p className="text-gray-500 text-sm font-medium ml-1">Access control & user management center</p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={fetchUsers}
            disabled={fetching}
            className="p-3 bg-white border border-gray-200 rounded-2xl text-gray-600 hover:text-indigo-600 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={20} className={fetching ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:-translate-y-1 transition-all active:scale-95 text-sm"
          >
            <Plus size={20} /> Add New User
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Accounts', value: totalUsers, icon: Users, color: 'indigo' },
          { label: 'Administrators', value: adminCount, icon: ShieldCheck, color: 'purple' },
          { label: 'Standard Users', value: userCount, icon: UserCheck, color: 'emerald' }
        ].map(stat => (
          <div key={stat.label} className="group bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">{stat.label}</p>
                <h3 className="text-4xl font-black text-gray-900">{stat.value}</h3>
              </div>
              <div className={`p-4 bg-${stat.color}-50 rounded-2xl text-${stat.color}-600 group-hover:scale-110 transition-transform`}>
                <stat.icon size={24} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className={`w-full h-1.5 bg-${stat.color}-50 rounded-full overflow-hidden`}>
                <div className={`h-full bg-${stat.color}-500 rounded-full`} style={{ width: '60%' }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
        <div className="p-6 border-b border-gray-100 bg-white/50 backdrop-blur-sm flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Filter by name or username..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-inner transition-all font-medium"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest px-4 py-2 bg-slate-50 rounded-xl">
            <Building2 size={14} />
            Global Repository
          </div>
        </div>

        <div className="overflow-x-auto px-2 pb-2">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                <th className="px-6 py-4">user (A)</th>
                <th className="px-6 py-4">user name (B)</th>
                <th className="px-6 py-4">role (D)</th>
                <th className="px-6 py-4 text-center">branch / department (E/F)</th>
                <th className="px-6 py-4">Page access (G)</th>
                <th className="px-6 py-4 text-right">Operations</th>
              </tr>
            </thead>
            <tbody>
              {fetching ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="5" className="px-6 py-4">
                      <div className="h-16 bg-slate-50 rounded-2xl w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center">
                    <div className="max-w-xs mx-auto">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search size={32} className="text-slate-200" />
                      </div>
                      <h4 className="text-gray-900 font-bold mb-1">No Results Found</h4>
                      <p className="text-gray-400 text-sm">We couldn't find any users matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                    <td className="px-6 py-4 bg-white first:rounded-l-2xl group-hover:bg-transparent transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl shadow-lg flex items-center justify-center text-white text-lg font-black ${getAvatarColor(user.name)} transform group-hover:scale-110 transition-transform`}>
                          {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-gray-900">{user.name}</span>
                          {authUser?.id === user.id && (
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">Current Session</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 bg-white group-hover:bg-transparent transition-colors">
                      <code className="text-xs font-mono font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">@{user.id}</code>
                    </td>
                    <td className="px-6 py-4 bg-white group-hover:bg-transparent transition-colors">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                        user.role === 'ADMIN' 
                          ? 'bg-purple-50 text-purple-600 ring-1 ring-purple-100' 
                          : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'
                      }`}>
                        {user.role === 'ADMIN' ? <ShieldCheck size={12} /> : <UserCheck size={12} />}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 bg-white group-hover:bg-transparent transition-colors text-center">
                      <div className="space-y-1 flex flex-col items-center">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                          <MapPin size={12} className="text-gray-400" /> {user.branch}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                          <Building2 size={10} /> {user.department}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 bg-white group-hover:bg-transparent transition-colors">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {user.pageAccess && user.pageAccess.length > 0 ? (
                          user.pageAccess.map(page => (
                            <span key={page} className="text-[9px] font-bold bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded-md border border-slate-100">
                              {page}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-gray-300 italic">No access</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 bg-white last:rounded-r-2xl group-hover:bg-transparent transition-colors text-right">
                      <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-2.5 bg-white border border-gray-100 rounded-xl text-indigo-600 hover:shadow-lg hover:border-indigo-100 transition-all active:scale-90"
                          title="Modify Record"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2.5 bg-white border border-gray-100 rounded-xl text-rose-500 hover:shadow-lg hover:border-rose-100 transition-all active:scale-90"
                          title="Purge Record"
                        >
                          {deletingId === user.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modern Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="p-8 pb-4 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-3xl text-white shadow-lg ${editingUserId ? 'bg-indigo-600 shadow-indigo-200' : 'bg-emerald-500 shadow-emerald-200'}`}>
                  {editingUserId ? <Edit2 size={24} /> : <UserPlus size={24} />}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                    {editingUserId ? 'Update Entity' : 'New Identity'}
                  </h2>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">User Registration Matrix</p>
                </div>
              </div>
              <button 
                onClick={closeModal} 
                className="p-3 bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 pt-4 space-y-6 overflow-y-auto scrollbar-hide">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Legal Name</label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={newUser.name}
                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-gray-900 placeholder:text-gray-300"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">System Username</label>
                  <input
                    type="text"
                    placeholder="john_doe"
                    value={newUser.id}
                    disabled={!!editingUserId}
                    onChange={e => setNewUser({ ...newUser, id: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-gray-900 placeholder:text-gray-300 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Access Passcode</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl pl-5 pr-14 py-4 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-gray-900 placeholder:text-gray-300"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Clearance Level</label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { val: 'USER', label: 'Operator', desc: 'Standard Access', icon: UserCheck, color: 'emerald' },
                    { val: 'ADMIN', label: 'Director', desc: 'Full Authority', icon: ShieldCheck, color: 'indigo' }
                  ].map(r => (
                    <button
                      key={r.val}
                      onClick={() => setNewUser({ ...newUser, role: r.val })}
                      className={`flex items-start gap-4 p-4 rounded-3xl border-2 transition-all ${
                        newUser.role === r.val 
                          ? `border-${r.color}-500 bg-${r.color}-50 shadow-lg shadow-${r.color}-100` 
                          : 'border-slate-50 bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className={`p-2 rounded-xl ${newUser.role === r.val ? `bg-${r.color}-500 text-white` : 'bg-white text-slate-400'}`}>
                        <r.icon size={18} />
                      </div>
                      <div className="text-left">
                        <div className={`text-sm font-black ${newUser.role === r.val ? `text-${r.color}-900` : 'text-slate-600'}`}>{r.label}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{r.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Branch Placement</label>
                  <select
                    value={newUser.branch}
                    onChange={e => setNewUser({ ...newUser, branch: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-gray-900 appearance-none cursor-pointer"
                  >
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Operational Dept</label>
                  <select
                    value={newUser.department}
                    onChange={e => setNewUser({ ...newUser, department: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-gray-900 appearance-none cursor-pointer"
                  >
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {/* Page Access Selection */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Assigned Modules</label>
                  <button 
                    onClick={() => {
                      const allSelected = newUser.pageAccess.length === availablePages.length;
                      setNewUser({ ...newUser, pageAccess: allSelected ? [] : [...availablePages] });
                    }}
                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-tighter"
                  >
                    {newUser.pageAccess.length === availablePages.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availablePages.map(page => {
                    const isSelected = newUser.pageAccess.includes(page);
                    return (
                      <button
                        key={page}
                        onClick={() => {
                          const updated = isSelected
                            ? newUser.pageAccess.filter(p => p !== page)
                            : [...newUser.pageAccess, page];
                          setNewUser({ ...newUser, pageAccess: updated });
                        }}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${
                          isSelected 
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-sm' 
                            : 'border-slate-50 bg-slate-50 hover:border-slate-200 text-slate-500'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                          {isSelected && <Plus size={10} className="text-white rotate-45" />}
                        </div>
                        <span className="text-[11px] font-bold truncate">{page}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-8 border-t border-slate-50 bg-slate-50/50 flex gap-4">
              <button
                onClick={handleSaveUser}
                disabled={submitting}
                className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-[1.5rem] font-black text-white shadow-xl transition-all active:scale-95 disabled:opacity-50 ${
                  editingUserId ? 'bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700' : 'bg-emerald-500 shadow-emerald-100 hover:bg-emerald-600'
                }`}
              >
                {submitting ? <Loader2 size={20} className="animate-spin" /> : editingUserId ? 'Commit Changes' : 'Initialize Identity'}
              </button>
              <button
                onClick={closeModal}
                className="px-8 py-4 bg-white border border-slate-200 rounded-[1.5rem] font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
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