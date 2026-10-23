import React, { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Loader2, AlertCircle, Shield, Mail, Lock, KeyRound, ChevronRight } from 'lucide-react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import GlobalStyles from './shared/GlobalStyles';
import PulseBackground from './shared/PulseBackground';

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
function AdminLogin() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (error) setError(null);
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const inputEmail = (formData.email || '').trim().toLowerCase();
            const password = formData.password;

            if (!inputEmail || !password) {
                throw new Error("Email and password are required.");
            }

            // Real Supabase Auth login
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: inputEmail,
                password: password
            });

            if (authError) {
                throw authError;
            }

            const user = authData?.user;
            if (!user) {
                throw new Error("Authentication failed: No user returned.");
            }

            // Verify administrative or staff privileges in staff_members or profiles
            const { data: staffMember } = await supabase
                .from('staff_members')
                .select('role, full_name, is_active')
                .eq('id', user.id)
                .maybeSingle();

            const { data: profile } = await supabase
                .from('profiles')
                .select('role, user_role, full_name, email')
                .eq('id', user.id)
                .maybeSingle();

            const role = staffMember?.role || profile?.role || profile?.user_role || user.app_metadata?.role;
            const isAuthorized = staffMember ? Boolean(staffMember.is_active) : (role === 'admin' || role === 'super_admin');

            if (!isAuthorized) {
                await supabase.auth.signOut();
                throw new Error("Access Denied: You do not have staff or administrative privileges.");
            }

            // Set persistent state for the dashboard
            localStorage.setItem('adminAuth', 'true');
            localStorage.setItem('adminRole', role || 'staff');
            localStorage.setItem('adminName', staffMember?.full_name || profile?.full_name || user.user_metadata?.full_name || 'Staff User');
            localStorage.setItem('adminEmail', user.email);
            localStorage.setItem('adminAvatar', '');
            
            // Direct staff to their primary authorized module
            let targetRoute = '/dashboard';
            const effectiveRole = staffMember?.role || role;
            if (effectiveRole === 'marketing') {
                targetRoute = '/push-notifications';
            } else if (effectiveRole === 'support') {
                targetRoute = '/users';
            } else if (effectiveRole === 'proofs_manager') {
                targetRoute = '/approvals';
            }
            
            navigate(targetRoute);
        } catch (err) {
            console.error("Auth Error:", err);
            setError(err.message || "Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 bg-gray-50/50" style={{ background: "linear-gradient(160deg, #fffbeb 0%, #fef9e7 45%, #fffdf5 100%)" }}>
            <GlobalStyles />
            <PulseBackground color="amber" />
            
            <div className="w-full max-w-md relative z-10">
                <motion.div 
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="glass-card rounded-[2rem] p-8 sm:p-10 flex flex-col items-center overflow-hidden relative"
                >
                    {/* Decorative Top Accent */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600"></div>

                    {/* Logo Section */}
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="mb-8 relative"
                    >
                        <div className="absolute inset-0 bg-amber-400 blur-2xl opacity-20 rounded-full"></div>
                        <div className="relative w-20 h-20 bg-white rounded-2xl p-1 shadow-lg border border-gray-100 flex items-center justify-center -rotate-3 hover:rotate-0 transition-transform duration-300">
                            <img src="/XPOOL_LOGO.png" alt="XPOOL" className="w-full h-full object-cover rounded-xl" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-amber-500 rounded-full p-1.5 shadow-md border-2 border-white">
                            <Shield size={16} className="text-white" />
                        </div>
                    </motion.div>

                    <div className="text-center mb-8 w-full">
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
                            Xpool Admin Portal
                        </h2>
                        <p className="text-gray-500 text-sm font-medium">
                            Secure access to operational controls
                        </p>
                    </div>

                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, y: -10, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                exit={{ opacity: 0, y: -10, height: 0 }}
                                className="w-full bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 mb-6 border border-red-100 uppercase tracking-wide"
                            >
                                <AlertCircle size={16} className="shrink-0" />
                                <span>{error}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleAuth} className="w-full space-y-4">

                        <div className="relative flex items-center">
                            <Mail className="absolute left-4 text-amber-500 z-10" size={18} />
                            <input
                                name="email"
                                type="email"
                                required
                                placeholder="Admin Email"
                                value={formData.email}
                                onChange={handleChange}
                                className="glass-input w-full pl-12 pr-4 py-3.5 rounded-xl text-gray-900 font-semibold placeholder-gray-400 shadow-sm"
                            />
                        </div>

                        <div className="relative flex items-center">
                            <Lock className="absolute left-4 text-amber-500 z-10" size={18} />
                            <input
                                name="password"
                                type="password"
                                required
                                minLength={6}
                                placeholder="Secure Password"
                                value={formData.password}
                                onChange={handleChange}
                                className="glass-input w-full pl-12 pr-4 py-3.5 rounded-xl text-gray-900 font-semibold placeholder-gray-400 shadow-sm"
                            />
                        </div>

                        <motion.button 
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit" 
                            disabled={loading} 
                            className="w-full relative group overflow-hidden mt-6 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl text-base shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="absolute w-0 h-0 transition-all duration-500 ease-out bg-white rounded-full group-hover:w-full group-hover:h-56 opacity-10"></span>
                            {loading ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <>
                                    <KeyRound size={18} />
                                    <span>Authenticate securely</span>
                                    <ChevronRight size={18} className="absolute right-4 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                </>
                            )}
                        </motion.button>
                    </form>
                </motion.div>

                {/* Footer Note */}
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                    className="mt-6 text-center"
                >
                    <p className="text-amber-700/60 text-xs font-medium px-6 py-2.5">
                        Admin accounts are provisioned by the system owner.
                    </p>
                </motion.div>
            </div>
            
            {/* Version / Copyright */}
            <div className="absolute bottom-6 font-semibold text-xs text-amber-900/40 uppercase tracking-widest text-center w-full z-10">
                Xpool Admin Operations Panel v3.0
            </div>
        </div>
    );
}

export default AdminLogin;
