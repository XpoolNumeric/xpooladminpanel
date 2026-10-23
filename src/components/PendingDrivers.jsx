import React, { useEffect, useState, memo, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Loader2, Car, ChevronRight, ShieldAlert, Check, Search, Filter, CheckCircle, Clock, XCircle, FileText, ShieldCheck } from 'lucide-react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import { useRealtime } from '../hooks/useRealtime';
import { formatPhoneDisplay } from '../lib/identityUtils';
import { cn } from '../lib/utils';

// Global Styles
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
        background: rgba(255, 255, 255, 0.95);
        border-color: rgba(245, 158, 11, 0.4);
        transform: translateY(-2px);
        box-shadow: 0 15px 40px rgba(245, 158, 11, 0.12);
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
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState(new Date());
    const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
    const [searchQuery, setSearchQuery] = useState('');
    const [vehicleFilter, setVehicleFilter] = useState('all');
    const navigate = useNavigate();

    const fetchAllDrivers = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        else setIsSyncing(true);

        try {
            const { data, error } = await supabase
                .from('drivers')
                .select('id, full_name, vehicle_type, vehicle_number, created_at, phone, email, status, dl_number, aadhaar_pan_number, profile_photo_url')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching drivers:", error);
            } else {
                setDrivers(data || []);
                setLastSynced(new Date());
            }
        } finally {
            setLoading(false);
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        fetchAllDrivers();

        const interval = setInterval(() => {
            fetchAllDrivers(false);
        }, 15000);

        return () => clearInterval(interval);
    }, []);

    useRealtime('drivers', () => fetchAllDrivers(false));

    const counts = useMemo(() => {
        return {
            all: drivers.length,
            pending: drivers.filter(d => d.status === 'pending').length,
            approved: drivers.filter(d => d.status === 'approved').length,
            rejected: drivers.filter(d => d.status === 'rejected').length,
        };
    }, [drivers]);

    const filteredDrivers = useMemo(() => {
        return drivers.filter(d => {
            // Status tab filter
            if (statusFilter !== 'all' && d.status !== statusFilter) {
                return false;
            }
            // Vehicle filter
            if (vehicleFilter !== 'all' && d.vehicle_type?.toLowerCase() !== vehicleFilter.toLowerCase()) {
                return false;
            }
            // Search filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const name = (d.full_name || '').toLowerCase();
                const phone = String(d.phone || d.phone_number || '');
                const veh = (d.vehicle_number || '').toLowerCase();
                const email = (d.email || '').toLowerCase();
                if (!name.includes(q) && !phone.includes(q) && !veh.includes(q) && !email.includes(q)) {
                    return false;
                }
            }
            return true;
        });
    }, [drivers, statusFilter, vehicleFilter, searchQuery]);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.04 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, scale: 0.98, y: 10 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }
    };

    const getStatusPill = (status) => {
        switch (status) {
            case 'approved':
                return {
                    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    dot: 'bg-emerald-500',
                    label: 'Accepted / Approved',
                    icon: CheckCircle
                };
            case 'rejected':
                return {
                    bg: 'bg-red-50 text-red-700 border-red-200',
                    dot: 'bg-red-500',
                    label: 'Rejected',
                    icon: XCircle
                };
            default:
                return {
                    bg: 'bg-amber-50 text-amber-700 border-amber-200',
                    dot: 'bg-amber-500 animate-pulse',
                    label: 'Pending Review',
                    icon: Clock
                };
        }
    };

    return (
        <div className="dashboard-container inter-font bg-gray-50/50" style={{ minHeight: '100vh', position: 'relative', background: "linear-gradient(160deg, #fffbeb 0%, #fef9e7 45%, #fffdf5 100%)" }}>
            <GlobalStyles />
            <PulseBackground />

            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <div className={`dashboard-content-wrapper relative z-10 h-full transition-all duration-300 pt-16 pb-12 ${sidebarOpen ? 'md:ml-64 lg:ml-72' : 'ml-0'}`}>
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">

                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <div className="inline-flex flex-col mb-2">
                                <h1 className="text-3xl flex items-center gap-3 sm:text-4xl font-extrabold tracking-tight text-gray-900">
                                    Driver Verification <span className="text-amber-500">& Proofs</span>
                                </h1>
                                <div className="h-1.5 w-1/3 bg-amber-500 rounded-full mt-2 shadow-sm" />
                            </div>
                            <p className="text-gray-500 font-medium max-w-xl">
                                Inspect driver KYC proof documents (DL, RC, Aadhaar/PAN, Insurance) and verify applications across all onboarding stages.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 bg-white/70 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/80 shadow-sm self-start">
                            <div className={`w-2.5 h-2.5 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                {isSyncing ? 'Syncing...' : 'Live Sync'}
                                <span className="text-gray-400 font-medium normal-case">
                                    {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                            </span>
                        </div>
                    </motion.div>

                    {/* Filter & Search Controls */}
                    <div className="glass-card rounded-3xl p-5 mb-8 border border-white/80 shadow-sm flex flex-col gap-4">
                        {/* Status Tabs */}
                        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-4">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all flex items-center gap-2",
                                    statusFilter === 'all'
                                        ? "bg-gray-900 text-white shadow-md shadow-gray-900/20"
                                        : "bg-white/80 text-gray-600 hover:bg-gray-100 border border-gray-200/60"
                                )}
                            >
                                <span>All Drivers</span>
                                <span className={cn("px-2 py-0.5 rounded-full text-[10px]", statusFilter === 'all' ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700")}>
                                    {counts.all}
                                </span>
                            </button>

                            <button
                                onClick={() => setStatusFilter('approved')}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all flex items-center gap-2",
                                    statusFilter === 'approved'
                                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                                        : "bg-white/80 text-emerald-700 hover:bg-emerald-50 border border-emerald-200/60"
                                )}
                            >
                                <CheckCircle size={14} />
                                <span>Accepted / Approved</span>
                                <span className={cn("px-2 py-0.5 rounded-full text-[10px]", statusFilter === 'approved' ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800")}>
                                    {counts.approved}
                                </span>
                            </button>

                            <button
                                onClick={() => setStatusFilter('pending')}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all flex items-center gap-2",
                                    statusFilter === 'pending'
                                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                                        : "bg-white/80 text-amber-700 hover:bg-amber-50 border border-amber-200/60"
                                )}
                            >
                                <Clock size={14} />
                                <span>Pending Queue</span>
                                <span className={cn("px-2 py-0.5 rounded-full text-[10px]", statusFilter === 'pending' ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800")}>
                                    {counts.pending}
                                </span>
                            </button>

                            <button
                                onClick={() => setStatusFilter('rejected')}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all flex items-center gap-2",
                                    statusFilter === 'rejected'
                                        ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                                        : "bg-white/80 text-red-700 hover:bg-red-50 border border-red-200/60"
                                )}
                            >
                                <XCircle size={14} />
                                <span>Rejected</span>
                                <span className={cn("px-2 py-0.5 rounded-full text-[10px]", statusFilter === 'rejected' ? "bg-white/20 text-white" : "bg-red-100 text-red-800")}>
                                    {counts.rejected}
                                </span>
                            </button>
                        </div>

                        {/* Search Bar & Vehicle Filters */}
                        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                            <div className="relative w-full sm:max-w-md">
                                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by driver name, phone, or vehicle number..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white/80 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all shadow-xs"
                                />
                            </div>

                            <div className="flex items-center gap-1.5 self-end sm:self-auto overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1 shrink-0">Type:</span>
                                {['all', 'car', 'bike', 'auto'].map((v) => (
                                    <button
                                        key={v}
                                        onClick={() => setVehicleFilter(v)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all shrink-0",
                                            vehicleFilter === v
                                                ? "bg-amber-500 text-white shadow-xs"
                                                : "bg-white/70 text-gray-600 hover:bg-gray-100 border border-gray-200/50"
                                        )}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Results Counter */}
                    <div className="flex items-center justify-between mb-6 px-1">
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                            <span>Showing {filteredDrivers.length} of {drivers.length} drivers</span>
                        </div>
                    </div>

                    {/* Driver Cards Grid */}
                    {loading ? (
                        <div className="flex flex-col justify-center items-center py-32 gap-4">
                            <div className="relative">
                                <Loader2 size={48} className="animate-spin text-amber-500" />
                                <div className="absolute inset-0 blur-2xl bg-amber-500/20 rounded-full" />
                            </div>
                            <p className="text-gray-400 font-bold text-sm uppercase tracking-widest animate-pulse">Loading driver proof records...</p>
                        </div>
                    ) : filteredDrivers.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="glass-card flex flex-col items-center justify-center p-16 text-center rounded-[2.5rem] border-2 border-dashed border-gray-200"
                        >
                            <div className="w-20 h-20 mb-4 rounded-full bg-amber-100/60 flex items-center justify-center border-4 border-amber-50 shadow-md text-amber-600">
                                <FileText size={36} />
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 mb-2">No Drivers Found</h3>
                            <p className="text-gray-500 max-w-sm font-medium text-sm mb-6">
                                {searchQuery.trim()
                                    ? `No drivers matched "${searchQuery}". Try a different name, phone, or vehicle number.`
                                    : `There are currently no drivers in the "${statusFilter}" queue.`
                                }
                            </p>
                            {statusFilter !== 'all' && (
                                <button
                                    onClick={() => setStatusFilter('all')}
                                    className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gray-900 text-white hover:bg-black transition-colors shadow-sm"
                                >
                                    View All Drivers
                                </button>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            <AnimatePresence mode="popLayout">
                                {filteredDrivers.map(driver => {
                                    const pill = getStatusPill(driver.status);
                                    const PillIcon = pill.icon;

                                    return (
                                        <motion.div
                                            key={driver.id}
                                            variants={itemVariants}
                                            layout
                                            onClick={() => navigate(`/driver/${driver.id}`)}
                                            className="glass-card glass-card-hover rounded-[2rem] p-6 cursor-pointer relative overflow-hidden group border border-white/60 flex flex-col justify-between"
                                        >
                                            <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-amber-100/30 to-transparent rounded-bl-full -mr-16 -mt-16 transition-all group-hover:scale-110 pointer-events-none" />

                                            <div className="flex flex-col gap-4 relative z-10">
                                                {/* Top Row: Vehicle Icon + Status Pill */}
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="w-13 h-13 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform p-3">
                                                        <Car size={26} className="text-amber-500" />
                                                    </div>

                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border flex items-center gap-1.5 shadow-2xs", pill.bg)}>
                                                            <PillIcon size={12} />
                                                            {pill.label}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-semibold">
                                                            {driver.created_at ? new Date(driver.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown date'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Driver Name & Vehicle Details */}
                                                <div>
                                                    <h3 className="text-lg font-black text-gray-900 truncate group-hover:text-amber-600 transition-colors uppercase tracking-tight">
                                                        {driver.full_name || 'Anonymous Applicant'}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                        <span className="text-[10px] font-black text-white bg-gray-900 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                                            {driver.vehicle_type || 'Vehicle'}
                                                        </span>
                                                        <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full uppercase tracking-wider border border-amber-200">
                                                            {driver.vehicle_number || 'No Plate'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Contact Details */}
                                                <div className="text-xs space-y-1 pt-2 border-t border-gray-100/60 text-gray-600 font-medium">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Phone</span>
                                                        <span className="font-semibold text-gray-800">{formatPhoneDisplay(driver.phone || driver.phone_number)}</span>
                                                    </div>
                                                    {driver.dl_number && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">DL No</span>
                                                            <span className="font-semibold text-gray-700 uppercase">{driver.dl_number}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Bottom Action */}
                                            <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100/60 relative z-10">
                                                <span className="text-[11px] font-extrabold text-amber-600 group-hover:text-amber-700 flex items-center gap-1">
                                                    Inspect Proofs & KYC
                                                </span>
                                                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center transform group-hover:translate-x-1 transition-all shadow-md shadow-amber-500/20">
                                                    <ChevronRight size={18} strokeWidth={2.5} />
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </main>
            </div>
        </div>
    );
}

export default PendingDrivers;
