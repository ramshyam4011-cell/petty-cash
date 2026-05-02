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
    <>
    <div className="p-4 md:p-8 space-y-6 md:space-y-10 animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 font-semibold text-[10px] px-3.5 py-1.5 rounded-full mb-3 shadow-sm">
            <Users size={12} />
            <span>Identity Governance</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 leading-none mb-2">System Settings</h1>
          <p className="text-slate-500 font-medium italic">Manage security clearance and operational placement for personnel</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <button
            onClick={fetchUsers}
            disabled={fetching}
            className="w-full sm:w-auto p-4 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:text-indigo-600 hover:shadow-sm transition-all active:scale-95 disabled:opacity-50 shadow-sm"
          >
            <RefreshCw size={20} className={fetching ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openAddModal}
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-slate-900 text-white px-8 py-4 rounded-2xl font-semibold shadow-sm hover:bg-slate-800 transition-all active:scale-95 text-sm"
          >
            <UserPlus size={20} strokeWidth={3} /> Add Identity
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {[
          { label: 'Total Accounts', value: totalUsers, icon: Users, color: 'indigo' },
          { label: 'Clearance: Admin', value: adminCount, icon: ShieldCheck, color: 'purple' },
          { label: 'Clearance: User', value: userCount, icon: UserCheck, color: 'emerald' }
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100 transition-all duration-300 relative overflow-hidden">
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold text-slate-400 mb-2">{stat.label}</p>
                <h3 className="text-4xl font-semibold text-slate-900">{stat.value}</h3>
              </div>
              <div className={`p-4 bg-slate-50 rounded-2xl text-${stat.color}-600`}>
                <stat.icon size={24} strokeWidth={2.5} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Filter identities..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-semibold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-300 shadow-sm"
            />
          </div>
          <div className="hidden md:flex items-center gap-2 text-[10px] font-semibold text-slate-400 px-4 py-2 bg-slate-50 rounded-xl">
            <Building2 size={14} />
            Authority Matrix
          </div>
        </div>

        {/* Mobile Identity Cards */}
        <div className="md:hidden flex flex-col gap-4 p-4 pb-24 bg-slate-50/50">
          {fetching ? (
             [1, 2, 3].map(i => (
               <div key={i} className="h-48 bg-white rounded-2xl animate-pulse border border-slate-100" />
             ))
          ) : filteredUsers.length === 0 ? (
             <div className="text-center py-20">
                <Search size={40} className="mx-auto mb-4 text-slate-200" />
                <p className="text-[10px] font-semibold text-slate-400">No identities discovered</p>
             </div>
          ) : (
             filteredUsers.map(user => (
               <div key={user.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-4 relative overflow-hidden active:scale-[0.98] transition-transform">
                  <div className={`absolute top-0 left-0 w-1 h-full ${user.role === 'ADMIN' ? 'bg-indigo-600' : 'bg-emerald-500'}`}></div>
                  
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-semibold ${getAvatarColor(user.name)}`}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <h3 className="font-semibold text-slate-900 leading-tight">{user.name}</h3>
                        <code className="text-[10px] font-semibold text-indigo-600">@{user.id}</code>
                      </div>
                    </div>
                    <button onClick={() => openEditModal(user)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:text-indigo-600 transition-colors">
                      <Edit2 size={18} strokeWidth={2.5} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl">
                     <div className="space-y-1">
                        <span className="text-[9px] font-semibold text-slate-400 block">Clearance</span>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-semibold inline-flex items-center gap-1 ${
                           user.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                           {user.role === 'ADMIN' ? <ShieldCheck size={10} /> : <UserCheck size={10} />}
                           {user.role}
                        </span>
                     </div>
                     <div className="text-right space-y-1">
                        <span className="text-[9px] font-semibold text-slate-400 block">Placement</span>
                        <p className="text-[10px] font-semibold text-slate-900 truncate">{user.branch}</p>
                     </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                     {user.pageAccess.map(page => (
                       <span key={page} className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-[9px] font-semibold text-slate-500">
                          {page}
                       </span>
                     ))}
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    {authUser?.id === user.id ? (
                      <span className="text-[9px] font-semibold text-indigo-600 flex items-center gap-1.5 bg-indigo-50 px-3 py-1 rounded-full">
                        <div className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse"></div>
                        Current Authority
                      </span>
                    ) : <div></div>}
                    <button 
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={deletingId === user.id}
                      className="flex items-center gap-1.5 text-rose-500 font-semibold text-[10px] hover:text-rose-700 transition-colors"
                    >
                      <Trash2 size={14} strokeWidth={3} /> Purge
                    </button>
                  </div>
               </div>
             ))
          )}
        </div>

        {/* Desktop Identity Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-5 text-[10px] font-semibold text-slate-400">Identity Profile</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-slate-400">System ID</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-slate-400">Clearance Level</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-slate-400">Placement</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-slate-400">Module Access</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {fetching ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="6" className="px-6 py-4"><div className="h-16 bg-slate-50 rounded-2xl w-full" /></td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center bg-slate-50/50">
                    <Search size={40} className="mx-auto mb-4 text-slate-200" />
                    <p className="text-[10px] font-semibold text-slate-400">No identities discovered</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl shadow-sm flex items-center justify-center text-white text-lg font-semibold ${getAvatarColor(user.name)}`}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{user.name}</span>
                          {authUser?.id === user.id && (
                            <span className="text-[9px] font-semibold text-indigo-600 flex items-center gap-1">
                              <div className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse"></div> Current Session
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <code className="text-[11px] font-semibold font-mono bg-slate-50 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200">@{user.id}</code>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-semibold border ${user.role === 'ADMIN'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                        {user.role === 'ADMIN' ? <ShieldCheck size={12} strokeWidth={2.5} /> : <UserCheck size={12} strokeWidth={2.5} />}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-semibold text-slate-700 leading-tight">{user.branch}</span>
                        <span className="text-[10px] font-semibold text-slate-400">{user.department}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1 max-w-[250px]">
                        {user.pageAccess.map(page => (
                          <span key={page} className="text-[9px] font-semibold bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-md shadow-sm">
                            {page}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEditModal(user)} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-500 transition-all shadow-sm active:scale-95">
                          <Edit2 size={16} strokeWidth={3} />
                        </button>
                        <button onClick={() => handleDeleteUser(user.id)} disabled={deletingId === user.id} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-rose-500 hover:border-rose-500 transition-all shadow-sm active:scale-95 disabled:opacity-50">
                          {deletingId === user.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} strokeWidth={3} />}
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

      <div className="flex items-center justify-center py-12 opacity-20 grayscale pointer-events-none">
         <img src="/logo.png" alt="Identity Matrix" className="h-6" />
      </div>
    </div>

    {/* Identity Modal */}
    {isModalOpen && (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
        <div className="bg-white rounded-2xl shadow-sm w-full max-w-xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
          
          {/* Modal Header */}
          <div className="px-8 py-7 border-b border-slate-100 flex items-center justify-between bg-white relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>
             <div>
                <h2 className="text-2xl font-semibold text-slate-900 leading-none mb-1">
                   {editingUserId ? 'Modify Identity' : 'Register Identity'}
                </h2>
                <p className="text-[10px] font-semibold text-slate-400">Personnel Protocol</p>
             </div>
             <button onClick={closeModal} className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
               <X size={22} strokeWidth={3} />
             </button>
          </div>

          <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-400 ml-1">Legal Name</label>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-300 shadow-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-400 ml-1">System ID</label>
                <input
                  type="text"
                  placeholder="Username"
                  value={newUser.id}
                  disabled={!!editingUserId}
                  onChange={e => setNewUser({ ...newUser, id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-300 disabled:opacity-50 shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-400 ml-1">Clearance Key</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 font-semibold text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-300 shadow-sm"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-semibold text-slate-400 ml-1">Clearance Level</label>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { val: 'USER', label: 'Operator', icon: UserCheck, color: 'emerald' },
                  { val: 'ADMIN', label: 'Administrator', icon: ShieldCheck, color: 'indigo' }
                ].map(r => (
                  <button
                    key={r.val}
                    onClick={() => setNewUser({ ...newUser, role: r.val })}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${newUser.role === r.val
                        ? `border-${r.color}-500 bg-${r.color}-50 shadow-sm`
                        : 'border-slate-50 bg-slate-50 hover:border-slate-100 text-slate-400'
                      }`}
                  >
                    <r.icon size={18} strokeWidth={2.5} className={newUser.role === r.val ? `text-${r.color}-600` : ''} />
                    <span className={`text-[13px] font-semibold ${newUser.role === r.val ? `text-${r.color}-900` : ''}`}>{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-400 ml-1">Branch</label>
                <select
                  value={newUser.branch}
                  onChange={e => setNewUser({ ...newUser, branch: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all appearance-none cursor-pointer shadow-sm"
                >
                  {branches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-400 ml-1">Department</label>
                <select
                  value={newUser.department}
                  onChange={e => setNewUser({ ...newUser, department: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all appearance-none cursor-pointer shadow-sm"
                >
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-slate-400 ml-1">Module Authority</label>
                <button
                  onClick={() => {
                    const allSelected = newUser.pageAccess.length === availablePages.length;
                    setNewUser({ ...newUser, pageAccess: allSelected ? [] : [...availablePages] });
                  }}
                  className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  {newUser.pageAccess.length === availablePages.length ? 'Revoke All' : 'Grant All'}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
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
                      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 transition-all text-left ${isSelected
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-sm'
                          : 'border-slate-50 bg-slate-50 hover:border-slate-100 text-slate-400'
                        }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                        {isSelected && <Plus size={10} className="text-white rotate-45" strokeWidth={4} />}
                      </div>
                      <span className="text-[11px] font-semibold truncate">{page}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSaveUser}
              disabled={submitting}
              className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 text-sm ${editingUserId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : editingUserId ? 'Commit Changes' : 'Register identity'}
            </button>
            <button onClick={closeModal} className="px-8 py-3.5 bg-white border border-slate-200 text-slate-500 rounded-2xl font-semibold text-[11px] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all active:scale-95">
              Discard
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
