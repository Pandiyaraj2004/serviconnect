import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, UserCircle, Wrench, ShieldCheck, ChevronRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { INDIAN_CITIES } from '../utils/helpers';

const ROLE_OPTIONS = [
  {
    id: 'customer',
    label: 'Login as Customer',
    icon: <UserCircle size={28} />,
    description: 'Book services, manage bookings',
    color: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    redirect: '/dashboard',
  },
  {
    id: 'worker',
    label: 'Login as Worker',
    icon: <Wrench size={28} />,
    description: 'Manage jobs, accept bookings',
    color: 'from-green-500 to-emerald-600',
    bg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
    redirect: '/worker-dashboard',
  },
  {
    id: 'admin',
    label: 'Login as Admin',
    icon: <ShieldCheck size={28} />,
    description: 'Platform management & control',
    color: 'from-purple-500 to-violet-600',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-300',
    redirect: '/admin',
  },
];

const AuthPage = ({ initialTab = 'login' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithGoogle, loginWithEmail, registerWithEmail } = useAuth();

  // Step 1: role select, Step 2: login/register form
  const [step, setStep] = useState('role'); // 'role' | 'form'
  const [selectedRole, setSelectedRole] = useState(null);
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [regForm, setRegForm] = useState({ name: '', phone: '', email: '', password: '', confirm: '', city: '' });
  const [errors, setErrors] = useState({});

  const redirectTo = location.state?.from?.pathname || null;

  const getRedirect = (role) => {
    if (redirectTo) return redirectTo;
    return ROLE_OPTIONS.find(r => r.id === role)?.redirect || '/dashboard';
  };

  const handleSelectRole = (role) => {
    setSelectedRole(role);
    setStep('form');
    setErrors({});
    // Admin goes directly to login tab
    if (role.id === 'admin') setTab('login');
  };

  const validateLogin = () => {
    const e = {};
    if (!loginForm.email) e.email = 'Email is required';
    if (!loginForm.password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateRegister = () => {
    const e = {};
    if (!regForm.name.trim()) e.name = 'Name is required';
    if (!regForm.phone.match(/^[6-9]\d{9}$/)) e.phone = 'Enter valid 10-digit phone number';
    if (!regForm.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Enter valid email';
    if (regForm.password.length < 8) e.password = 'Minimum 8 characters';
    if (regForm.password !== regForm.confirm) e.confirm = 'Passwords do not match';
    if (!regForm.city) e.city = 'Select your city';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const isAdminBypass = loginForm.email === 'pandi' && loginForm.password === 'pandi';
    if (!isAdminBypass && !validateLogin()) return;
    setLoading(true);
    try {
      const roleId = selectedRole?.id || 'customer';
      await loginWithEmail(loginForm.email, loginForm.password, roleId);
      navigate(getRedirect(roleId), { replace: true });
    } catch {
      // handled in context
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validateRegister()) return;
    setLoading(true);
    try {
      const roleId = selectedRole?.id || 'customer';
      await registerWithEmail({
        email: regForm.email,
        password: regForm.password,
        name: regForm.name.trim(),
        city: regForm.city,
        phone: regForm.phone,
        role: roleId,
      });
      navigate(getRedirect(roleId), { replace: true });
    } catch {
      // handled in context
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const roleId = selectedRole?.id || 'customer';
      await loginWithGoogle(roleId);
      navigate(getRedirect(roleId), { replace: true });
    } catch {
      // handled in context
    } finally { setLoading(false); }
  };

  const inputClass = (field) => `w-full px-4 py-3 bg-white/80 dark:bg-gray-800/80 border rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-primary-light/30 dark:focus:ring-primary-dark/30
    ${errors[field] ? 'border-red-400' : 'border-gray-200 dark:border-gray-700 focus:border-primary-light dark:focus:border-primary-dark'}
    text-gray-900 dark:text-white placeholder-gray-400`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-black dark:to-blue-950 flex items-center justify-center p-4 pt-20">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 -right-20 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">

        <AnimatePresence mode="wait">

          {/* ─── STEP 1: Role Selection ─── */}
          {step === 'role' && (
            <motion.div key="role" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/30 dark:border-white/10 p-8">
                <div className="text-center mb-8">
                  <div className="text-4xl mb-3">🔧</div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ServiConnect</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Who are you logging in as?</p>
                </div>

                <div className="space-y-3">
                  {ROLE_OPTIONS.map((role, i) => (
                    <motion.button
                      key={role.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectRole(role)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border ${role.bg} ${role.border} transition-all group`}
                    >
                      <div className={`p-2 rounded-xl bg-gradient-to-br ${role.color} text-white`}>
                        {role.icon}
                      </div>
                      <div className="text-left flex-1">
                        <div className={`font-bold text-sm ${role.text}`}>{role.label}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{role.description}</div>
                      </div>
                      <ChevronRight size={16} className={`${role.text} opacity-0 group-hover:opacity-100 transition-opacity`} />
                    </motion.button>
                  ))}
                </div>

                <p className="text-center text-xs text-gray-400 mt-6">
                  New to ServiConnect? Role registration is available after selecting your role.
                </p>
              </div>
            </motion.div>
          )}

          {/* ─── STEP 2: Login / Register Form ─── */}
          {step === 'form' && selectedRole && (
            <motion.div key="form" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}>
              <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/30 dark:border-white/10">
                {/* Role Header */}
                <div className={`bg-gradient-to-r ${selectedRole.color} px-6 py-4 flex items-center gap-3`}>
                  <button
                    onClick={() => setStep('role')}
                    className="p-1 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="text-white">
                    {selectedRole.icon}
                  </div>
                  <div>
                    <p className="text-white/80 text-xs font-medium uppercase tracking-wider">ServiConnect</p>
                    <h2 className="text-white font-bold text-lg leading-tight">{selectedRole.label}</h2>
                  </div>
                </div>

                <div className="px-7 pt-5 pb-0">
                  {/* Tabs — hide register for admin */}
                  {selectedRole.id !== 'admin' && (
                    <div className="flex relative border-b border-gray-100 dark:border-gray-800 mb-5">
                      {['login', 'register'].map(t => (
                        <button
                          key={t}
                          onClick={() => { setTab(t); setErrors({}); }}
                          className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors relative ${
                            tab === t ? 'text-primary-light dark:text-primary-dark' : 'text-gray-400'
                          }`}
                        >
                          {t}
                          {tab === t && (
                            <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-light dark:bg-primary-dark rounded-full" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="px-7 pb-7">
                  <AnimatePresence mode="wait">
                    {tab === 'login' ? (
                      <motion.form
                        key="login-form"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        onSubmit={handleLogin}
                        className="space-y-4"
                      >
                        {selectedRole.id === 'admin' && (
                          <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-3 text-xs text-purple-700 dark:text-purple-300">
                            🔐 Admin access only. Use your admin credentials.
                          </div>
                        )}

                        <div>
                          <input
                            placeholder={selectedRole.id === 'admin' ? 'Admin Username' : 'Email or Phone'}
                            value={loginForm.email}
                            onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                            className={inputClass('email')}
                            autoComplete="email"
                          />
                          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                        </div>

                        <div className="relative">
                          <input
                            type={showPass ? 'text' : 'password'}
                            placeholder="Password"
                            value={loginForm.password}
                            onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                            className={inputClass('password')}
                            autoComplete="current-password"
                          />
                          <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3.5 text-gray-400">
                            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                          {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                          type="submit"
                          disabled={loading}
                          className={`w-full py-3 bg-gradient-to-r ${selectedRole.color} text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg`}
                        >
                          {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                          Login
                        </motion.button>

                        {selectedRole.id !== 'admin' && (
                          <>
                            <div className="relative flex items-center my-3">
                              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                              <span className="px-4 text-xs text-gray-400">or</span>
                              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                              type="button"
                              onClick={handleGoogle}
                              disabled={loading}
                              className="w-full py-3 border border-gray-200 dark:border-gray-700 rounded-xl font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                              Continue with Google
                            </motion.button>
                          </>
                        )}

                        {selectedRole.id !== 'admin' && (
                          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                            No account?{' '}
                            <button type="button" onClick={() => setTab('register')} className="text-primary-light dark:text-primary-dark font-semibold">Register</button>
                          </p>
                        )}
                      </motion.form>
                    ) : (
                      <motion.form
                        key="register-form"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        onSubmit={handleRegister}
                        className="space-y-3"
                      >
                        <div>
                          <input placeholder="Full Name" value={regForm.name} onChange={e => setRegForm({ ...regForm, name: e.target.value })} className={inputClass('name')} />
                          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                        </div>
                        <div>
                          <input placeholder="Phone Number (10 digits)" value={regForm.phone} onChange={e => setRegForm({ ...regForm, phone: e.target.value })} className={inputClass('phone')} maxLength={10} />
                          {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                        </div>
                        <div>
                          <input type="email" placeholder="Email" value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} className={inputClass('email')} />
                          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                        </div>
                        <div className="relative">
                          <input type={showPass ? 'text' : 'password'} placeholder="Password (min 8 chars)" value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} className={inputClass('password')} />
                          <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3.5 text-gray-400">{showPass ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                          {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                        </div>
                        <div className="relative">
                          <input type={showConfirm ? 'text' : 'password'} placeholder="Confirm Password" value={regForm.confirm} onChange={e => setRegForm({ ...regForm, confirm: e.target.value })} className={inputClass('confirm')} />
                          <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-3.5 text-gray-400">{showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                          {errors.confirm && <p className="text-xs text-red-500 mt-1">{errors.confirm}</p>}
                        </div>
                        <div>
                          <select value={regForm.city} onChange={e => setRegForm({ ...regForm, city: e.target.value })} className={`${inputClass('city')} cursor-pointer`}>
                            <option value="">Select City</option>
                            {INDIAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                          type="submit"
                          disabled={loading}
                          className={`w-full py-3 bg-gradient-to-r ${selectedRole.color} text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg mt-2`}
                        >
                          {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                          Create {selectedRole.id === 'worker' ? 'Worker' : 'Customer'} Account
                        </motion.button>

                        <div className="relative flex items-center my-2">
                          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                          <span className="px-4 text-xs text-gray-400">or</span>
                          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                          type="button"
                          onClick={handleGoogle}
                          disabled={loading}
                          className="w-full py-3 border border-gray-200 dark:border-gray-700 rounded-xl font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                          Continue with Google
                        </motion.button>

                        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                          Have account?{' '}
                          <button type="button" onClick={() => setTab('login')} className="text-primary-light dark:text-primary-dark font-semibold">Login</button>
                        </p>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default AuthPage;
