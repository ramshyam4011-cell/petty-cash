import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL;

const Login = () => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Fetch users from Google Sheets 'setting' sheet
      const res = await fetch(APPSCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'readSetting' })
      });
      const json = await res.json();
      
      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch users');
      }

      const users = (json.data || []).map(row => ({
        name: row['user'] || '',
        id: row['user name'] || '',
        password: row['password'] || '',
        role: (row['role'] || 'USER').trim().toUpperCase(),
        branch: row['branch'] || '',
        department: row['department'] || '',
        pageAccess: row['Page access'] ? row['Page access'].split(',').map(s => s.trim()) : []
      }));

      const matchedUser = users.find(
        (u) => u.id === id && String(u.password) === password
      );

      if (!matchedUser) {
        toast.error('Invalid credentials');
        setSubmitting(false);
        return;
      }

      toast.success('Login successful!');
      login(matchedUser);
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('Login error: ' + (err.message || 'Check your internet connection'));
    } finally {
      setSubmitting(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };



  return (
    <div className="min-h-screen w-full flex flex-col relative overflow-hidden bg-slate-50 font-sans">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[100px] opacity-60"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[100px] opacity-60"></div>
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-[420px] animate-soft-float">
          {/* Main Card */}
          <div className="bg-white border border-slate-200/60 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-10 md:p-12 space-y-8 relative overflow-hidden group transition-all duration-500 hover:shadow-[0_20px_60px_rgba(37,99,235,0.1)]">
            
            {/* Header Section */}
            <div className="text-center space-y-3 relative">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 shadow-lg shadow-blue-200 mb-4 transform hover:rotate-3 transition-transform duration-300">
                <Lock className="text-white w-7 h-7" />
              </div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Petty <span className="text-blue-600">Cash</span>
              </h1>
              <p className="text-slate-500 text-xs font-bold tracking-widest uppercase opacity-70">
                Management System
              </p>
            </div>

            {/* Form */}
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* User ID Field */}
              <div className="space-y-2">
                <label htmlFor="id" className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                  username
                </label>
                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400 group-focus-within/input:text-blue-600 transition-colors" />
                  </div>
                  <input
                    id="id"
                    type="text"
                    required
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    className="block w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:bg-white focus:border-blue-600 transition-all duration-300"
                    placeholder="Enter your ID"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                  password
                </label>
                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 group-focus-within/input:text-blue-600 transition-colors" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-12 pr-12 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:bg-white focus:border-blue-600 transition-all duration-300"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-600 transition-colors"
                    onClick={togglePasswordVisibility}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-4 px-6 text-sm font-bold bg-blue-600 text-white rounded-2xl hover:bg-blue-700 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-blue-100 shadow-xl shadow-blue-200 transition-all duration-300 relative overflow-hidden group/btn ${
                  submitting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite]"></div>
                {submitting ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span className="tracking-wide">Authenticating...</span>
                  </div>
                ) : (
                  <span className="tracking-widest uppercase">Login</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-8 text-center relative z-10">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
          Powered By Botivate <span className="mx-2 text-slate-200">|</span> v4.0.1
        </p>
      </div>
    </div>
  );
};

export default Login;

