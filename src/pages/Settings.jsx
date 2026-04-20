import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Edit2, Plus } from 'lucide-react';
import { getSettings, saveSettings, getUsers, saveUsers } from '../utils/storageManager';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('groupHeads'); // 'groupHeads', 'paymentModes', 'users'
  const [settings, setSettings] = useState(getSettings());
  const [users, setUsers] = useState(getUsers());

  // Group Heads State
  const [newGroupHead, setNewGroupHead] = useState('');
  const [editingGroupHeadId, setEditingGroupHeadId] = useState(null);

  // Payment Modes State
  const [newPaymentMode, setNewPaymentMode] = useState('');
  const [editingPaymentModeId, setEditingPaymentModeId] = useState(null);

  // User State
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  // ===== GROUP HEADS =====
  const handleAddGroupHead = () => {
    if (!newGroupHead.trim()) {
      toast.error('Please enter group head name');
      return;
    }

    const updatedSettings = {
      ...settings,
      groupHeads: [...settings.groupHeads, newGroupHead.trim()]
    };

    setSettings(updatedSettings);
    saveSettings(updatedSettings);
    setNewGroupHead('');
    toast.success('Group head added successfully!');
  };

  const handleDeleteGroupHead = (index) => {
    const updatedSettings = {
      ...settings,
      groupHeads: settings.groupHeads.filter((_, i) => i !== index)
    };

    setSettings(updatedSettings);
    saveSettings(updatedSettings);
    toast.success('Group head deleted!');
  };

  // ===== PAYMENT MODES =====
  const handleAddPaymentMode = () => {
    if (!newPaymentMode.trim()) {
      toast.error('Please enter payment mode');
      return;
    }

    const updatedSettings = {
      ...settings,
      paymentModes: [...settings.paymentModes, newPaymentMode.trim()]
    };

    setSettings(updatedSettings);
    saveSettings(updatedSettings);
    setNewPaymentMode('');
    toast.success('Payment mode added successfully!');
  };

  const handleDeletePaymentMode = (index) => {
    const updatedSettings = {
      ...settings,
      paymentModes: settings.paymentModes.filter((_, i) => i !== index)
    };

    setSettings(updatedSettings);
    saveSettings(updatedSettings);
    toast.success('Payment mode deleted!');
  };

  // ===== USERS =====
  const handleEditUser = (user) => {
    setEditingUserId(user.id);
    setEditingUser({ ...user });
  };

  const handleSaveUser = () => {
    if (!editingUser.name.trim() || !editingUser.password.trim()) {
      toast.error('Please fill all required fields');
      return;
    }

    const updatedUsers = users.map(u => u.id === editingUserId ? editingUser : u);
    setUsers(updatedUsers);
    saveUsers(updatedUsers);
    setEditingUserId(null);
    setEditingUser(null);
    toast.success('User updated successfully!');
  };

  const handleDeleteUser = (userId) => {
    if (confirm('Are you sure you want to delete this user?')) {
      const updatedUsers = users.filter(u => u.id !== userId);
      setUsers(updatedUsers);
      saveUsers(updatedUsers);
      toast.success('User deleted!');
    }
  };

  return (
    <div className="p-6 space-y-6">


      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('groupHeads')}
            className={`py-3 px-4 font-medium border-b-2 transition ${
              activeTab === 'groupHeads'
                ? 'border-sky-500 text-sky-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Group Heads
          </button>
          <button
            onClick={() => setActiveTab('paymentModes')}
            className={`py-3 px-4 font-medium border-b-2 transition ${
              activeTab === 'paymentModes'
                ? 'border-sky-500 text-sky-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Payment Modes
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-4 font-medium border-b-2 transition ${
              activeTab === 'users'
                ? 'border-sky-500 text-sky-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Users
          </button>
        </div>
      </div>

      {/* GROUP HEADS TAB */}
      {activeTab === 'groupHeads' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Manage Group Heads</h2>

          <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={newGroupHead}
              onChange={(e) => setNewGroupHead(e.target.value)}
              placeholder="Enter group head name"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
              onKeyPress={(e) => e.key === 'Enter' && handleAddGroupHead()}
            />
            <button
              onClick={handleAddGroupHead}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              <Plus size={20} /> Add
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {settings.groupHeads.map((head, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                <span className="font-medium text-gray-900">{head}</span>
                <button
                  onClick={() => handleDeleteGroupHead(idx)}
                  className="text-red-600 hover:text-red-800 transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          {settings.groupHeads.length === 0 && (
            <p className="text-center text-gray-500 py-8">No group heads added yet.</p>
          )}
        </div>
      )}

      {/* PAYMENT MODES TAB */}
      {activeTab === 'paymentModes' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Manage Payment Modes</h2>

          <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={newPaymentMode}
              onChange={(e) => setNewPaymentMode(e.target.value)}
              placeholder="Enter payment mode"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
              onKeyPress={(e) => e.key === 'Enter' && handleAddPaymentMode()}
            />
            <button
              onClick={handleAddPaymentMode}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              <Plus size={20} /> Add
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {settings.paymentModes.map((mode, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                <span className="font-medium text-gray-900">{mode}</span>
                <button
                  onClick={() => handleDeletePaymentMode(idx)}
                  className="text-red-600 hover:text-red-800 transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          {settings.paymentModes.length === 0 && (
            <p className="text-center text-gray-500 py-8">No payment modes added yet.</p>
          )}
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">SN</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Password</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
                    {editingUserId === user.id ? (
                      <>
                        <td className="px-4 py-3 text-sm text-gray-900">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={editingUser.name}
                            onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 w-full"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={editingUser.id}
                            disabled
                            className="border border-gray-300 rounded px-2 py-1 w-full bg-gray-100"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={editingUser.password}
                            onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 w-full"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={editingUser.role}
                            onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 w-full"
                          >
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 flex gap-2">
                          <button
                            onClick={handleSaveUser}
                            className="text-green-600 hover:text-green-800 font-semibold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingUserId(null)}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            Cancel
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm text-gray-900">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{user.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{user.id}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">••••••••</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            user.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm flex gap-2">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Edit2 size={16} /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-800 flex items-center gap-1"
                          >
                            <Trash2 size={16} /> Delete
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No users found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
