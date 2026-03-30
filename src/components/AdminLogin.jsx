import React, { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Loader2, AlertCircle, Shield, Mail, Lock, User, KeyRound, ChevronRight } from 'lucide-react';
import xpoolLogo from '../assets/xpool-logo.png';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Styles from Hero
// ─────────────────────────────────────────────────────────────────────────────
const GlobalStyles = () => (
    <style>{`
      .inter-font { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  
      :root {
        --color-amber-50: #fffbeb; --color-amber-100: #fef3c7; --color-amber-200: #fde68a;
        --color-amber-300: #fcd34d; --color-amber-400: #fbbf24; --color-amber-500: #f59e0b;
        --color-amber-600: #d97706; --color-amber-700: #b45309; 
        --transition-base: 0.2s ease-in-out;
      }
  
      @keyframes pulse-fade {
        0%, 100% { opacity: 0; } 50% { opacity: 1; }
      }
      .pulse-blob {
        animation: pulse-fade ease-in-out infinite;
        will-change: opacity;
      }

      /* Glassmorphism utilities */
      .glass-card {
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border: 1px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
      }

      .glass-input {
        background: rgba(255, 255, 255, 0.5);
        border: 1px solid rgba(245, 158, 11, 0.2);
        transition: all 0.2s;
      }
      .glass-input:focus {
        background: rgba(255, 255, 255, 0.9);
        border-color: rgba(245, 158, 11, 0.6);
        outline: none;
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
      }

      @media (prefers-reduced-motion: reduce) {
        .pulse-blob { animation: none !important; }
      }
    `}</style>
);

// ─────────────────────────────────────────────────────────────────────────────
// Animated Background
// ─────────────────────────────────────────────────────────────────────────────
const PULSE_CONFIG = [
    { x: 10, y: 15, size: 450, delay: 0.2, dur: 5.5, opacity: 0.15 },
    { x: 85, y: 80, size: 550, delay: 1.5, dur: 6.2, opacity: 0.12 },
    { x: 75, y: 20, size: 300, delay: 2.8, dur: 4.8, opacity: 0.14 },
];

const PulseBackground = memo(() => {
    const prefersReducedMotion = useReducedMotion();
    if (prefersReducedMotion) return null;
    return (
        <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
            {PULSE_CONFIG.map((p, i) => (
                <div
                    key={i}
                    className="pulse-blob"
                    style={{
                        position: "absolute",
                        left: `${p.x}%`, top: `${p.y}%`,
                        width: p.size, height: p.size,
                        borderRadius: "50%",
                        transform: "translate(-50%, -50%)",
                        background: `radial-gradient(circle, rgba(245,158,11,${p.opacity}) 0%, rgba(217,119,6,${p.opacity * 0.5}) 42%, transparent 70%)`,
                        filter: "blur(60px)",
                        animationDuration: `${p.dur}s`,
                        animationDelay: `${p.delay}s`,
                    }}
                />
            ))}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: "radial-gradient(rgba(245,158,11,0.06) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                    zIndex: 1,
                }}
            />
        </div>
    );
});
PulseBackground.displayName = "PulseBackground";

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
function AdminLogin() {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: ''
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
            if (isLogin) {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: formData.password,
                });

                if (error) throw error;

                if (data.user) {
                    // Fetch full profile details to verify administrative status and store display info
                    const { data: profile, error: profileError } = await supabase
                        .from('profiles')
                        .select('role, user_role, full_name, avatar_url, email')
                        .eq('id', data.user.id)
                        .single();

                    if (profileError || !profile) {
                        await supabase.auth.signOut();
                        throw new Error("Administrative profile not found. Please contact system owner.");
                    }

                    // Check for both 'admin' and 'super_admin' roles as per industry standards
                    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
                    
                    if (!isAdmin) {
                        await supabase.auth.signOut();
                        throw new Error("Access denied: Insufficient administrative privileges.");
                    }

                    // Set persistent state for the dashboard
                    localStorage.setItem('adminAuth', 'true');
                    localStorage.setItem('adminRole', profile.role);
                    localStorage.setItem('adminName', profile.full_name || 'Admin User');
                    localStorage.setItem('adminEmail', profile.email || data.user.email);
                    localStorage.setItem('adminAvatar', profile.avatar_url || '');
                    
                    navigate('/dashboard');
                }
            } else {
                const { data, error } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            full_name: formData.fullName,
                            role: 'admin',
                        },
                    },
                });

                if (error) throw error;

                if (data.user) {
                    // Initialize the unified profile record as per the provided schema
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .insert({
                            id: data.user.id,
                            full_name: formData.fullName,
                            email: formData.email,
                            role: 'admin',
                            user_role: 'admin', // Internal role set as admin for unified tracking
                            last_screen: 'dashboard',
                            created_at: new Date(),
                            updated_at: new Date()
                        });

                    if (profileError) {
                        console.error('Critical: Error initializing administrative profile:', profileError);
                        // We continue if the auth user was created, but log the error
                    }

                    localStorage.setItem('adminAuth', 'true');
                    localStorage.setItem('adminRole', 'admin');
                    localStorage.setItem('adminName', formData.fullName);
                    localStorage.setItem('adminEmail', formData.email);
                    
                    navigate('/dashboard');
                }
            }
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
            <PulseBackground />
            
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
                            <img src="/xpoolscreen.png" alt="XPOOL" className="w-full h-full object-cover rounded-xl" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-amber-500 rounded-full p-1.5 shadow-md border-2 border-white">
                            <Shield size={16} className="text-white" />
                        </div>
                    </motion.div>

                    <div className="text-center mb-8 w-full">
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
                            {isLogin ? 'Xpool Admin Portal' : 'Xpool Admin Registration'}
                        </h2>
                        <p className="text-gray-500 text-sm font-medium">
                            {isLogin ? 'Secure access to operational controls' : 'Create an administrative super-user account'}
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
                        <AnimatePresence>
                            {!isLogin && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                    animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                    className="relative flex items-center"
                                >
                                    <User className="absolute left-4 text-amber-500 z-10" size={18} />
                                    <input
                                        name="fullName"
                                        type="text"
                                        required
                                        placeholder="Full Name"
                                        value={formData.fullName}
                                        onChange={handleChange}
                                        className="glass-input w-full pl-12 pr-4 py-3.5 rounded-xl text-gray-900 font-semibold placeholder-gray-400 shadow-sm"
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

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
                                    {isLogin ? <KeyRound size={18} /> : <User size={18} />}
                                    <span>{isLogin ? 'Authenticate securely' : 'Create Admin Account'}</span>
                                    <ChevronRight size={18} className="absolute right-4 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                </>
                            )}
                        </motion.button>
                    </form>
                </motion.div>

                {/* Toggle Footer */}
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                    className="mt-6 text-center"
                >
                    <button
                        onClick={() => { setIsLogin(!isLogin); setError(null); }}
                        className="text-amber-700 hover:text-amber-900 font-bold text-sm bg-amber-100/50 hover:bg-amber-200/50 backdrop-blur-sm px-6 py-2.5 rounded-full transition-colors border border-amber-200/50"
                    >
                        {isLogin ? "Need administrative access? Register" : "Already have access? Login securely"}
                    </button>
                </motion.div>
            </div>
            
            {/* Version / Copyright */}
            <div className="absolute bottom-6 font-semibold text-xs text-amber-900/40 uppercase tracking-widest text-center w-full z-10">
                Xpool Admin Operations Panel v2.5
            </div>
        </div>
    );
}

export default AdminLogin;
