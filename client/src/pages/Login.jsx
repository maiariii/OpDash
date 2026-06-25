import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ShieldAlert, ArrowRight, UserPlus, Key, Info, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../components/ToastContext';
import axios from 'axios';

const Login = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
    const [loading, setLoading] = useState(false);

    // Form inputs
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [authCode, setAuthCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showAuthCode, setShowAuthCode] = useState(false);

    const API_BASE = '/opdash/api';

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        if (!email.toLowerCase().endsWith('@deped.gov.ph')) {
            showToast('Email must end with @deped.gov.ph', 'warning');
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/auth/login`, { email, password });
            localStorage.setItem('opdash_token', res.data.token);
            localStorage.setItem('opdash_user', JSON.stringify(res.data.user));
            showToast('Login successful! Welcome back.', 'success');
            navigate('/');
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.error || 'Login failed. Please check your credentials.';
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        if (!email.toLowerCase().endsWith('@deped.gov.ph')) {
            showToast('Email must end with @deped.gov.ph', 'warning');
            return;
        }
        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'warning');
            return;
        }
        if (!authCode) {
            showToast('Authorization Code is required', 'warning');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API_BASE}/auth/register`, { email, password, authCode });
            showToast('Registration successful! Please log in.', 'success');
            setMode('login');
            setPassword('');
            setConfirmPassword('');
            setAuthCode('');
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.error || 'Registration failed.';
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleResetSubmit = async (e) => {
        e.preventDefault();
        if (!email.toLowerCase().endsWith('@deped.gov.ph')) {
            showToast('Email must end with @deped.gov.ph', 'warning');
            return;
        }
        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'warning');
            return;
        }
        if (!authCode) {
            showToast('Authorization Code is required', 'warning');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API_BASE}/auth/reset-password`, { email, password, authCode });
            showToast('Password reset successfully! Please sign in.', 'success');
            setMode('login');
            setPassword('');
            setConfirmPassword('');
            setAuthCode('');
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.error || 'Password reset failed.';
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-sky-50 relative overflow-hidden select-none">
            {/* Animated background blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-sky-300/20 rounded-full blur-[120px] animate-float-1 pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-amber-200/15 rounded-full blur-[150px] animate-float-2 pointer-events-none" />
            <div className="absolute top-[30%] right-[10%] w-[40vw] h-[40vw] bg-blue-300/10 rounded-full blur-[100px] animate-float-3 pointer-events-none" />

            {/* Premium Glass Card */}
            <div className="w-full max-w-md bg-white/80 backdrop-blur-2xl border border-white/40 shadow-[0_20px_50px_rgba(8,112,184,0.12)] rounded-3xl p-8 hover:shadow-[0_20px_60px_rgba(8,112,184,0.22)] transition-all duration-500 animate-scale-in relative z-10">
                <div className="flex flex-col items-center mb-6">
                    <img 
                        src="/opdash/insighted_logo.png" 
                        alt="InsightED Logo" 
                        className="h-28 w-auto object-contain mb-3 drop-shadow-md"
                    />
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex gap-1">
                        <span>
                            <span className="text-[#075985]">Insight</span>
                            <span className="text-red-600">ED</span>
                        </span>
                        <span className="text-slate-600 font-medium">Portal</span>
                    </h2>
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">
                        {mode === 'login' && 'Sign in to your account'}
                        {mode === 'register' && 'Create your account'}
                        {mode === 'forgot' && 'Reset your password'}
                    </p>
                </div>

                {/* SIGN IN */}
                {mode === 'login' && (
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <Mail size={12} /> DepEd Email
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-3 pr-32 py-3 bg-white/80 border border-slate-200 rounded-xl focus:border-[#075985] focus:ring-4 focus:ring-[#075985]/10 outline-none text-sm font-semibold text-slate-800 transition-all hover:border-slate-300 shadow-sm"
                                    placeholder="username"
                                    value={email.replace('@deped.gov.ph', '')}
                                    onChange={(e) => {
                                        const cleanVal = e.target.value.replace('@deped.gov.ph', '').trim();
                                        setEmail(cleanVal ? cleanVal + '@deped.gov.ph' : '');
                                    }}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                                    @deped.gov.ph
                                </span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                    <Lock size={12} /> Password
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setMode('forgot')}
                                    className="text-xs font-bold text-blue-600 hover:underline"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    className="w-full px-3 pr-10 py-3 bg-white/80 border border-slate-200 rounded-xl focus:border-[#075985] focus:ring-4 focus:ring-[#075985]/10 outline-none text-sm font-semibold text-slate-800 transition-all hover:border-slate-300 shadow-sm"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-[#075985] to-sky-600 hover:from-[#0284C7] hover:to-sky-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-sky-500/10 hover:shadow-sky-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 mt-6 cursor-pointer"
                        >
                            {loading ? 'Signing in...' : 'Sign In'} <ArrowRight size={16} />
                        </button>

                        <div className="text-center mt-6 pt-4 border-t border-slate-200/50">
                            <span className="text-xs text-slate-400 font-bold">New user? </span>
                            <button
                                type="button"
                                onClick={() => setMode('register')}
                                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1.5 mx-auto mt-1"
                            >
                                <UserPlus size={14} /> Create a DepEd Account
                            </button>
                        </div>
                    </form>
                )}

                {/* SIGN UP */}
                {mode === 'register' && (
                    <form onSubmit={handleRegisterSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <Mail size={12} /> DepEd Email
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-3 pr-32 py-3 bg-white/80 border border-slate-200 rounded-xl focus:border-[#075985] focus:ring-4 focus:ring-[#075985]/10 outline-none text-sm font-semibold text-slate-800 transition-all hover:border-slate-300 shadow-sm"
                                    placeholder="username"
                                    value={email.replace('@deped.gov.ph', '')}
                                    onChange={(e) => {
                                        const cleanVal = e.target.value.replace('@deped.gov.ph', '').trim();
                                        setEmail(cleanVal ? cleanVal + '@deped.gov.ph' : '');
                                    }}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                                    @deped.gov.ph
                                </span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <Lock size={12} /> Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    className="w-full px-3 pr-10 py-3 bg-white/80 border border-slate-200 rounded-xl focus:border-[#075985] focus:ring-4 focus:ring-[#075985]/10 outline-none text-sm font-semibold text-slate-800 transition-all hover:border-slate-300 shadow-sm"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <Lock size={12} /> Confirm Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    required
                                    className="w-full px-3 pr-10 py-3 bg-white/80 border border-slate-200 rounded-xl focus:border-[#075985] focus:ring-4 focus:ring-[#075985]/10 outline-none text-sm font-semibold text-slate-800 transition-all hover:border-slate-300 shadow-sm"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <Key size={12} /> Authorization Code
                            </label>
                            <div className="relative">
                                <input
                                    type={showAuthCode ? 'text' : 'password'}
                                    required
                                    className="w-full px-3 pr-10 py-3 bg-white/80 border border-slate-200 rounded-xl focus:border-[#075985] focus:ring-4 focus:ring-[#075985]/10 outline-none text-sm font-semibold text-slate-800 transition-all hover:border-slate-300 shadow-sm"
                                    placeholder="Enter organization code"
                                    value={authCode}
                                    onChange={(e) => setAuthCode(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowAuthCode(!showAuthCode)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showAuthCode ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-[#075985] to-sky-600 hover:from-[#0284C7] hover:to-sky-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-sky-500/10 hover:shadow-sky-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 mt-6 cursor-pointer"
                        >
                            {loading ? 'Creating account...' : 'Create Account'} <ArrowRight size={16} />
                        </button>

                        <div className="text-center mt-6 pt-4 border-t border-slate-200/50">
                            <span className="text-xs text-slate-400 font-bold">Already have an account? </span>
                            <button
                                type="button"
                                onClick={() => setMode('login')}
                                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1.5 mx-auto mt-1"
                            >
                                Sign In here
                            </button>
                        </div>
                    </form>
                )}

                {/* FORGOT PASSWORD */}
                {mode === 'forgot' && (
                    <form onSubmit={handleResetSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <Mail size={12} /> DepEd Email
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-3 pr-32 py-2.5 bg-white/60 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold text-slate-800"
                                    placeholder="username"
                                    value={email.replace('@deped.gov.ph', '')}
                                    onChange={(e) => {
                                        const cleanVal = e.target.value.replace('@deped.gov.ph', '').trim();
                                        setEmail(cleanVal ? cleanVal + '@deped.gov.ph' : '');
                                    }}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                                    @deped.gov.ph
                                </span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <Lock size={12} /> New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    className="w-full px-3 pr-10 py-3 bg-white/80 border border-slate-200 rounded-xl focus:border-[#075985] focus:ring-4 focus:ring-[#075985]/10 outline-none text-sm font-semibold text-slate-800 transition-all hover:border-slate-300 shadow-sm"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <Lock size={12} /> Confirm New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    required
                                    className="w-full px-3 pr-10 py-3 bg-white/80 border border-slate-200 rounded-xl focus:border-[#075985] focus:ring-4 focus:ring-[#075985]/10 outline-none text-sm font-semibold text-slate-800 transition-all hover:border-slate-300 shadow-sm"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <Key size={12} /> Authorization Code
                            </label>
                            <div className="relative">
                                <input
                                    type={showAuthCode ? 'text' : 'password'}
                                    required
                                    className="w-full px-3 pr-10 py-3 bg-white/80 border border-slate-200 rounded-xl focus:border-[#075985] focus:ring-4 focus:ring-[#075985]/10 outline-none text-sm font-semibold text-slate-800 transition-all hover:border-slate-300 shadow-sm"
                                    placeholder="Enter organization code"
                                    value={authCode}
                                    onChange={(e) => setAuthCode(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowAuthCode(!showAuthCode)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showAuthCode ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-1">
                                <Info size={10} className="text-blue-500" /> Verify reset using your organization's code
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-[#075985] to-sky-600 hover:from-[#0284C7] hover:to-sky-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-sky-500/10 hover:shadow-sky-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 mt-6 cursor-pointer"
                        >
                            {loading ? 'Resetting password...' : 'Reset Password'} <ArrowRight size={16} />
                        </button>

                        <div className="text-center mt-6 pt-4 border-t border-slate-200/50">
                            <button
                                type="button"
                                onClick={() => setMode('login')}
                                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1.5 mx-auto"
                            >
                                Back to Sign In
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Login;
