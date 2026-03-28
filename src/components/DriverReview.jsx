import React, { useEffect, useState, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Check, X, Loader2, FileText, Smartphone, Mail, Calendar, Briefcase, MapPin, ZoomIn, Car, FileCheck, Info, Search, Clock, Power, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from './Sidebar';
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
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.04);
      }
      
      .glass-modal {
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border: 1px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
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
    { x: 10, y: 30, size: 300, delay: 0.5, dur: 5.2, opacity: 0.12 },
    { x: 80, y: 80, size: 350, delay: 1.2, dur: 4.8, opacity: 0.15 },
    { x: 50, y: 10, size: 280, delay: 2.1, dur: 6.5, opacity: 0.10 },
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
function DriverReview() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [driver, setDriver] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imageModal, setImageModal] = useState({ open: false, url: '', label: '' });
    const [confirmModal, setConfirmModal] = useState({ open: false, action: '', status: '' });
    const [actionLoading, setActionLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        fetchDriverDetails();
    }, [id]);

    const fetchDriverDetails = async () => {
        const { data } = await supabase.from('drivers').select('*').eq('id', id).single();
        setDriver(data);
        setLoading(false);
    };

    const openConfirmModal = (status) => {
        setConfirmModal({
            open: true,
            action: status === 'approved' ? 'approve' : 'reject',
            status: status
        });
    };

    const closeConfirmModal = () => {
        setConfirmModal({ open: false, action: '', status: '' });
    };

    const updateStatus = async () => {
        setActionLoading(true);
        const { error } = await supabase.from('drivers').update({ status: confirmModal.status }).eq('id', id);

        if (!error) {
            setDriver(prev => ({ ...prev, status: confirmModal.status }));
        }

        setActionLoading(false);
        closeConfirmModal();
    };

    const toggleSuspend = async () => {
        setActionLoading(true);
        const newStatus = driver.status === 'suspended' ? 'approved' : 'suspended';
        const { error } = await supabase.from('drivers').update({ status: newStatus }).eq('id', id);

        if (!error) {
            setDriver(prev => ({ ...prev, status: newStatus }));
            toast.success(`Driver ${newStatus === 'suspended' ? 'Suspended' : 'Activated'}`);
        } else {
            toast.error('Failed to change status');
        }
        setActionLoading(false);
    };

    const sendNotification = async () => {
        const msg = prompt("Enter notification message:");
        if (!msg) return;
        try {
            // Mock: Insert to notifications table
            const { error } = await supabase.from('notifications').insert({ user_id: driver.id, message: msg, type: 'driver_alert' });
            if(error) throw error;
            toast.success("Notification Sent");
        } catch (e) {
            toast.error("Failed to send notification. Table might not exist.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
                <Loader2 className="animate-spin text-amber-500" size={48} />
            </div>
        );
    }

    if (!driver) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50 inter-font">
                <div className="glass-card p-10 rounded-3xl flex flex-col items-center max-w-sm text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-500">
                        <X size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Driver Not Found</h2>
                    <p className="text-gray-500 mb-6">The requested applicant data could not be located in the database.</p>
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="w-full bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold transition-all"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
    };
    const itemVariants = {
        hidden: { opacity: 0, y: 10, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }
    };
    
    // Status color mapping
    const getStatusTheme = (status) => {
        switch(status) {
            case 'approved': return { bg: 'bg-emerald-100 bg-opacity-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: Check };
            case 'rejected': return { bg: 'bg-red-100 bg-opacity-50', text: 'text-red-700', border: 'border-red-200', icon: X };
            default: return { bg: 'bg-amber-100 bg-opacity-50', text: 'text-amber-700', border: 'border-amber-200', icon: Clock };
        }
    };
    
    const StatusIcon = getStatusTheme(driver.status).icon;

    return (
        <div className="dashboard-container inter-font bg-gray-50/50" style={{ minHeight: '100vh', position: 'relative', background: "linear-gradient(160deg, #fffbeb 0%, #fef9e7 45%, #fffdf5 100%)" }}>
            <GlobalStyles />
            <PulseBackground />
            
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <div className="dashboard-content-wrapper relative z-10 h-full md:ml-64 lg:ml-72 pt-16 pb-10">
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">
                    
                    {/* Header Controls */}
                    <div className="flex items-center justify-between mb-8">
                        <button 
                            onClick={() => navigate('/dashboard')} 
                            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-bold transition-colors bg-white/50 backdrop-blur px-4 py-2 rounded-xl border border-gray-200 shadow-sm"
                        >
                            <ArrowLeft size={16} />
                            <span>Dashboard</span>
                        </button>
                    </div>

                    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full flex md:flex-row flex-col gap-6 md:gap-8 lg:gap-10">
                        {/* LEFT COLUMN: Overview & Actions */}
                        <div className="w-full md:w-1/3 flex flex-col gap-6">
                            {/* Profile Card */}
                            <motion.div variants={itemVariants} className="glass-card rounded-[2rem] overflow-hidden flex flex-col relative w-full border border-white">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100 rounded-bl-full -mr-16 -mt-16 opacity-30 pointer-events-none" />
                                
                                <div className="p-8 flex flex-col items-center text-center">
                                    <div className="relative mb-6">
                                        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 shadow-md border-4 border-white flex items-center justify-center overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
                                             onClick={() => driver.profile_photo_url && setImageModal({ open: true, url: driver.profile_photo_url, label: 'Profile Photo' })}>
                                            {driver.profile_photo_url ? (
                                                <>
                                                    <img src={driver.profile_photo_url} alt={driver.full_name} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <Search size={24} className="text-white" />
                                                    </div>
                                                </>
                                            ) : (
                                                <User size={40} className="text-amber-500" />
                                            )}
                                        </div>
                                        <div className={cn(
                                            "absolute bottom-0 right-2 w-7 h-7 rounded-full border-2 border-white flex items-center justify-center bg-white shadow-sm",
                                            getStatusTheme(driver.status).text
                                        )}>
                                            <StatusIcon size={14} />
                                        </div>
                                    </div>
                                    
                                    <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">{driver.full_name}</h1>
                                    <p className="text-gray-500 text-sm font-medium mt-1 mb-4">Application ID: #{driver.id.substring(0,8)}</p>
                                    
                                    <span className={cn(
                                        "px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest border",
                                        getStatusTheme(driver.status).bg,
                                        getStatusTheme(driver.status).text,
                                        getStatusTheme(driver.status).border
                                    )}>
                                        {driver.status}
                                    </span>
                                </div>
                                
                                {/* Actions */}
                                {driver.status === 'pending' && (
                                    <div className="p-4 bg-white/40 border-t border-gray-100/50 flex gap-3">
                                        <button 
                                            onClick={() => openConfirmModal('rejected')}
                                            className="flex-1 bg-white hover:bg-red-50 text-red-600 border border-gray-200 hover:border-red-200 font-bold py-3 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                                        >
                                            <X size={18} /> Reject
                                        </button>
                                        <button 
                                            onClick={() => openConfirmModal('approved')}
                                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                                        >
                                            <Check size={18} /> Approve
                                        </button>
                                    </div>
                                )}
                                {driver.status === 'approved' || driver.status === 'suspended' ? (
                                    <div className="p-4 bg-white/40 border-t border-gray-100/50 flex flex-col gap-3">
                                        <button 
                                            onClick={toggleSuspend}
                                            disabled={actionLoading}
                                            className={`w-full font-bold py-3 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 ${driver.status === 'suspended' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'}`}
                                        >
                                            {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Power size={18} />}
                                            {driver.status === 'suspended' ? 'Activate Driver' : 'Suspend Driver'}
                                        </button>
                                        <button 
                                            onClick={sendNotification}
                                            className="w-full bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 font-bold py-3 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                                        >
                                            <Bell size={18} /> Send Notification
                                        </button>
                                    </div>
                                ) : null}
                            </motion.div>
                            
                            {/* Personal Details Widget */}
                            <motion.div variants={itemVariants} className="glass-card rounded-[2rem] p-6 lg:p-8 flex flex-col gap-4 border border-white">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2"><User size={20} className="text-amber-500" /> Personal Info</h3>
                                <div className="space-y-4 text-sm mt-2">
                                    <DetailRow icon={<Smartphone size={16} />} label="Phone" value={driver.phone} />
                                    <DetailRow icon={<Mail size={16} />} label="Email" value={driver.email} />
                                    <DetailRow icon={<Calendar size={16} />} label="DoB" value={driver.dob} />
                                    <DetailRow icon={<Briefcase size={16} />} label="Profession" value={driver.profession} />
                                    <div className="pt-2 border-t border-gray-100/50">
                                        <DetailRow icon={<MapPin size={16} />} label="Location" value={`${driver.address || ''}, ${driver.city || ''} - ${driver.pincode || ''}`} />
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                        
                        {/* RIGHT COLUMN: Evidence & Documents */}
                        <div className="w-full md:w-2/3 flex flex-col gap-6">
                            
                            {/* Vehicle Segment */}
                            <motion.div variants={itemVariants} className="glass-card rounded-[2rem] p-6 lg:p-8 border border-white">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg"><Car size={24} className="text-amber-500" /> Registered Vehicle</h3>
                                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
                                        <span className="font-semibold text-gray-600 text-sm uppercase">{driver.vehicle_type}</span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                                        <span className="font-black text-gray-900">{driver.vehicle_number}</span>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <PhotoCard label="Front View" url={driver.vehicle_front_url} onOpen={setImageModal} />
                                    <PhotoCard label="Back View" url={driver.vehicle_back_url} onOpen={setImageModal} />
                                    <PhotoCard label="Left Side" url={driver.vehicle_left_url} onOpen={setImageModal} />
                                    <PhotoCard label="Right Side" url={driver.vehicle_right_url} onOpen={setImageModal} />
                                </div>
                            </motion.div>
                            
                            {/* Legal Documents Segment */}
                            <motion.div variants={itemVariants} className="glass-card rounded-[2rem] p-6 lg:p-8 border border-white">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg"><FileCheck size={24} className="text-amber-500" /> Compliance Documents</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {driver.dl_number && <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-bold uppercase border border-indigo-100">DL: {driver.dl_number}</span>}
                                        {driver.aadhaar_pan_number && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded font-bold uppercase border border-emerald-100">{driver.aadhaar_pan_type}: {driver.aadhaar_pan_number}</span>}
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <PhotoCard label="DL Front" url={driver.dl_front_url} onOpen={setImageModal} />
                                    <PhotoCard label="DL Back" url={driver.dl_back_url} onOpen={setImageModal} />
                                    <PhotoCard label="RC Front" url={driver.rc_front_url} onOpen={setImageModal} />
                                    <PhotoCard label="RC Back" url={driver.rc_back_url} onOpen={setImageModal} />
                                    <PhotoCard label="ID Front" url={driver.aadhaar_pan_front_url} onOpen={setImageModal} />
                                    {driver.aadhaar_pan_back_url && (
                                        <PhotoCard label="ID Back" url={driver.aadhaar_pan_back_url} onOpen={setImageModal} />
                                    )}
                                    <PhotoCard label="Insurance" url={driver.insurance_url} onOpen={setImageModal} />
                                </div>
                            </motion.div>
                            
                        </div>
                    </motion.div>
                </main>
            </div>

            {/* View Image Modal */}
            <AnimatePresence>
                {imageModal.open && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setImageModal({ open: false, url: '', label: '' })}
                        className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-8"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-w-4xl w-full max-h-[90vh]"
                        >
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="font-bold text-gray-900 text-lg">{imageModal.label}</h3>
                                <button 
                                    onClick={() => setImageModal({ open: false, url: '', label: '' })}
                                    className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="p-4 bg-gray-100 flex-1 overflow-auto flex items-center justify-center">
                                <img src={imageModal.url} alt={imageModal.label} className="max-w-full max-h-full object-contain rounded-xl shadow-sm border border-gray-200" />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirmation Modal */}
            <AnimatePresence>
                {confirmModal.open && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
                        onClick={closeConfirmModal}
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-modal rounded-3xl p-8 max-w-sm w-full relative overflow-hidden"
                        >
                            {/* Decorative banner */}
                            <div className={cn(
                                "absolute top-0 left-0 right-0 h-2",
                                confirmModal.action === 'approve' ? "bg-emerald-500" : "bg-red-500"
                            )}></div>
                            
                            <div className="flex flex-col items-center text-center mt-2">
                                <div className={cn(
                                    "w-16 h-16 rounded-full flex items-center justify-center mb-5 border-4",
                                    confirmModal.action === 'approve' ? "bg-emerald-50 text-emerald-500 border-emerald-100" : "bg-red-50 text-red-500 border-red-100"
                                )}>
                                    {confirmModal.action === 'approve' ? <Check size={32} /> : <X size={32} />}
                                </div>
                                <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
                                    {confirmModal.action === 'approve' ? 'Approve Driver?' : 'Reject Driver?'}
                                </h2>
                                <p className="text-gray-500 font-medium mb-8">
                                    {confirmModal.action === 'approve'
                                        ? `Are you sure you want to approve ${driver.full_name}? They will immediately gain access to the driver platform.`
                                        : `Are you sure you want to reject ${driver.full_name}? They will be notified to resubmit their application details.`
                                    }
                                </p>
                                
                                <div className="flex gap-3 w-full">
                                    <button 
                                        className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                                        onClick={closeConfirmModal} 
                                        disabled={actionLoading}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className={cn(
                                            "flex-1 px-4 py-3 rounded-xl font-bold text-white transition-all shadow-md flex items-center justify-center gap-2",
                                            confirmModal.action === 'approve' 
                                                ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" 
                                                : "bg-red-500 hover:bg-red-600 shadow-red-500/20"
                                        )}
                                        onClick={updateStatus}
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? <Loader2 size={18} className="animate-spin" /> : (
                                            confirmModal.action === 'approve' ? 'Approve' : 'Reject'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────
const DetailRow = ({ icon, label, value }) => (
    <div className="flex items-start gap-3">
        <div className="mt-0.5 text-gray-400">{icon}</div>
        <div className="flex flex-col flex-1 pb-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">{label}</span>
            <span className="text-gray-900 font-semibold mt-1 break-words">{value || <span className="text-gray-300 italic">Not Provided</span>}</span>
        </div>
    </div>
);

const PhotoCard = ({ label, url, onOpen }) => (
    <div 
        onClick={() => url && onOpen({ open: true, url, label })}
        className={cn(
            "relative aspect-square rounded-2xl border-2 overflow-hidden flex flex-col group transition-all",
            url ? "border-transparent bg-gray-100 cursor-pointer shadow-sm hover:shadow-md" : "border-dashed border-gray-200 bg-gray-50/50"
        )}
    >
        {url ? (
            <>
                <img src={url} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-100" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-white/90 backdrop-blur p-2 rounded-full text-gray-900 transform scale-50 group-hover:scale-100 transition-transform">
                        <ZoomIn size={18} />
                    </div>
                </div>
                <div className="absolute bottom-2 left-2 right-2">
                    <span className="text-white text-xs font-bold truncate block drop-shadow-md">{label}</span>
                </div>
            </>
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                <FileText size={24} className="opacity-50" />
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 text-center text-gray-400">{label}</span>
                <span className="text-xs font-medium text-gray-300">Missing</span>
            </div>
        )}
    </div>
);

export default DriverReview;

