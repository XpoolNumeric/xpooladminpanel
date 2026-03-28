import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, ChevronRight, LogOut, X, Menu, Shield, Wallet, Map, Users, Navigation, Settings as SettingsIcon, FileText, Database, LayoutDashboard } from 'lucide-react';
import xpoolLogo from '../assets/xpool-logo.png';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const Sidebar = ({ isOpen, setIsOpen }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Close sidebar on route change for mobile
    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname, setIsOpen]);

    const handleLogout = () => {
        localStorage.removeItem('adminAuth');
        navigate('/');
    };

    const navItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { label: 'Pending Approvals', icon: Shield, path: '/approvals' },
        { label: 'All Users', icon: Users, path: '/users' },
        { label: 'All Trips', icon: Map, path: '/trips' },
        { label: 'Withdrawals', icon: Wallet, path: '/withdrawals' },
        { label: 'Live Radar', icon: Navigation, path: '/live-tracking' },
        { label: 'Reports', icon: FileText, path: '/reports' },
        { label: 'Logs', icon: Database, path: '/logs' },
        { label: 'Settings', icon: SettingsIcon, path: '/settings' },
    ];

    const sidebarVariants = {
        hidden: { x: '-100%', opacity: 0 },
        visible: { x: 0, opacity: 1, transition: { type: 'keyframes', duration: 0.15 } },
        exit: { x: '-100%', opacity: 0, transition: { duration: 0.1 } }
    };

    const overlayVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.1 } },
        exit: { opacity: 0, transition: { duration: 0.05 } }
    };

    return (
        <>
            {/* Global Header (Top Navbar) */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-lg border-b border-gray-200/50 z-[60] flex items-center justify-between px-4 md:px-8">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsOpen(prev => !prev)}
                        className="p-2 -ml-2 text-gray-700 hover:bg-gray-100/50 rounded-xl transition-colors"
                        aria-label="Toggle Menu"
                    >
                        <Menu size={24} />
                    </button>
                    <div className="flex items-center gap-2">
                        <img src="/xpoolscreen.png" alt="XPOOL" className="h-9 w-9 rounded-xl object-cover shadow-sm bg-white p-0.5" />
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-900 tracking-tight leading-none text-lg">Xpool Admin</span>
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">Operations Panel</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-100">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">System Live</span>
                    </div>
                </div>
            </header>

            {/* Overlay for mobile/collapsed state */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-gray-900/10 z-[55] md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar Container */}
            <motion.aside
                variants={sidebarVariants}
                initial="hidden"
                animate={isOpen ? "visible" : "hidden"}
                className={cn(
                    "fixed top-16 left-0 bottom-0 z-[65] w-64 lg:w-72 flex flex-col pt-6 pb-6 px-4",
                    "bg-white/95 border-r border-gray-200/60 shadow-xl md:shadow-none",
                    !isOpen && "hidden"
                )}
            >
                {/* Close button for mobile */}
                <div className="md:hidden flex justify-end mb-6">
                    <button
                        className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                        onClick={() => setIsOpen(false)}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-1.5 overflow-y-auto pr-2 -mr-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={cn(
                                    "w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-200 group text-sm font-semibold",
                                    isActive
                                        ? "bg-amber-100 text-amber-900 shadow-sm border border-amber-200/50"
                                        : "text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon
                                        size={20}
                                        className={cn(
                                            isActive ? "text-amber-600" : "text-gray-400 group-hover:text-amber-500 transition-colors"
                                        )}
                                    />
                                    <span>{item.label}</span>
                                </div>
                                {isActive && (
                                    <motion.div layoutId="activeNavIndicator" className="w-1.5 h-5 bg-amber-500 rounded-full" />
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="pt-6 mt-6 border-t border-gray-200/60">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                    >
                        <LogOut size={18} />
                        Logout Securely
                    </button>
                </div>
            </motion.aside>
        </>
    );
};

export default Sidebar;

