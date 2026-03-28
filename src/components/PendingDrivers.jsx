import React, { useEffect, useState, memo } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Loader2, Car, ChevronRight, ShieldAlert, Check } from 'lucide-react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import { useRealtime } from '../hooks/useRealtime';

// Global Styles from Hero
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
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.04);
      }

      .glass-card-hover {
        transition: all 0.2s ease;
      }
      .glass-card-hover:hover {
        background: rgba(255, 255, 255, 0.9);
        border-color: rgba(245, 158, 11, 0.4);
        transform: translateY(-2px);
        box-shadow: 0 15px 40px rgba(245, 158, 11, 0.1);
      }
    `}</style>
);

const PULSE_CONFIG = [
    { x: 10, y: 15, size: 300, delay: 0, dur: 5, opacity: 0.15 },
    { x: 80, y: 25, size: 250, delay: 1, dur: 4.8, opacity: 0.12 },
    { x: 50, y: 50, size: 400, delay: 2, dur: 5.5, opacity: 0.1 },
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
                        filter: "blur(40px)",
                        animationDuration: `${p.dur}s`,
                        animationDelay: `${p.delay}s`,
                    }}
                />
            ))}
        </div>
    );
});
PulseBackground.displayName = "PulseBackground";

function PendingDrivers() {
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();

    const fetchPendingDrivers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('drivers')
            .select('id, full_name, vehicle_type, vehicle_number, created_at')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching drivers:", error);
            if (error.message && (error.message.includes("JWT") || error.code === 'PGRST301')) {
                await supabase.auth.signOut();
            }
        } else {
            setDrivers(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchPendingDrivers();
    }, []);

    useRealtime('drivers', fetchPendingDrivers);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
    };
    
    const itemVariants = {
        hidden: { opacity: 0, scale: 0.98, y: 10 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }
    };

    return (
        <div className="dashboard-container bg-gray-50/50" style={{ minHeight: '100vh', position: 'relative', background: "linear-gradient(160deg, #fffbeb 0%, #fef9e7 45%, #fffdf5 100%)" }}>
            <GlobalStyles />
            <PulseBackground />
            
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <div className="dashboard-content-wrapper relative z-10 h-full md:ml-64 lg:ml-72 pt-16 pb-10">
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">
                    
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-10">
                        <div className="inline-flex flex-col mb-2">
                            <h1 className="text-3xl flex items-center gap-3 sm:text-4xl font-extrabold tracking-tight text-gray-900">
                                Pending <span className="text-amber-500">Approvals</span>
                            </h1>
                            <div className="h-1 w-1/3 bg-amber-500 rounded-full mt-2" />
                        </div>
                        <p className="text-gray-500 font-medium">Review driver applications waiting for your approval.</p>
                    </motion.div>

                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                <ShieldAlert size={24} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">Waiting Queue</h2>
                        </div>
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 text-sm font-bold rounded-full border border-amber-200">
                            {drivers.length} Applications
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader2 size={40} className="animate-spin text-amber-500" />
                        </div>
                    ) : drivers.length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="glass-card flex flex-col items-center justify-center p-16 text-center rounded-3xl"
                        >
                            <div className="w-20 h-20 mb-6 rounded-full bg-emerald-100 flex items-center justify-center border-4 border-emerald-50">
                                <Check size={36} className="text-emerald-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">All Caught Up!</h3>
                            <p className="text-gray-500 max-w-sm">
                                There are no driver applications waiting for your approval right now.
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div 
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5"
                        >
                            <AnimatePresence>
                                {drivers.map(driver => (
                                    <motion.div 
                                        key={driver.id}
                                        variants={itemVariants}
                                        layout
                                        onClick={() => navigate(`/driver/${driver.id}`)}
                                        className="glass-card glass-card-hover rounded-2xl p-5 cursor-pointer relative overflow-hidden group"
                                    >
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110 opacity-50" />
                                        
                                        <div className="flex gap-4 items-start relative z-10">
                                            <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center shrink-0">
                                                <Car size={24} className="text-amber-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg font-bold text-gray-900 truncate mb-1">{driver.full_name}</h3>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">{driver.vehicle_type}</span>
                                                    <span className="text-xs font-bold text-gray-900 border border-gray-200 px-2.5 py-1 rounded-lg bg-white box-shadow-sm">{driver.vehicle_number}</span>
                                                </div>
                                                <div className="flex items-center justify-between mt-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Applied</span>
                                                        <span className="text-xs text-gray-600 font-medium">{new Date(driver.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                    </div>
                                                    <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                                                        <ChevronRight size={16} className="text-amber-600" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </main>
            </div>
        </div>
    );
}

export default PendingDrivers;
