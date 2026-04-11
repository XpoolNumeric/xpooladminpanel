import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
    Loader2, Database, AlertCircle, Terminal, RefreshCw,
    Search, Filter, Trash2, ChevronRight, ChevronDown,
    Activity, ShieldAlert, CreditCard, Clock, HardDrive,
    ExternalLink, Code
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import PageLayout from './shared/PageLayout';

// ─── Constants ───────────────────────────────────────────────────────────────
const LOG_TAB_CONFIG = {
    system: {
        label: 'System Errors',
        icon: ShieldAlert,
        type: 'system_error',
        color: 'text-rose-500',
        bg: 'bg-rose-50',
    },
    transactions: {
        label: 'Failed Transactions',
        icon: CreditCard,
        type: 'failed_transaction',
        color: 'text-amber-500',
        bg: 'bg-amber-50',
    },
    activity: {
        label: 'Platform Activity',
        icon: Activity,
        type: 'activity',
        color: 'text-blue-500',
        bg: 'bg-blue-50',
    }
};

const SEVERITY_CONFIG = {
    critical: { color: 'text-purple-700', bg: 'bg-purple-100', icon: ShieldAlert },
    error: { color: 'text-rose-700', bg: 'bg-rose-100', icon: AlertCircle },
    warning: { color: 'text-amber-700', bg: 'bg-amber-100', icon: AlertCircle },
    info: { color: 'text-blue-700', bg: 'bg-blue-100', icon: Database },
};

// ─── Component ───────────────────────────────────────────────────────────────
const LogsPanel = () => {
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('system');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);

    // ─── Data Fetching ─────────────────────────────────────────────────
    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const currentConfig = LOG_TAB_CONFIG[activeTab];
            
            const { data, error } = await supabase
                .from('logs')
                .select('*')
                .eq('log_type', currentConfig.type)
                .order('created_at', { ascending: false })
                .limit(100);
                
            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error("Database connection issue:", error);
            // toast.error("Check if 'logs' table exists in Supabase.");
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // ─── Filtering ─────────────────────────────────────────────────────
    const filteredLogs = logs.filter(log => 
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.source?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ─── Render Log Card ───────────────────────────────────────────────
    const LogItem = ({ log }) => {
        const sev = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.info;
        const isSelected = selectedLog?.id === log.id;

        return (
            <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`group border-b border-gray-100 transition-all hover:bg-gray-50/80 ${isSelected ? 'bg-amber-50/30' : ''}`}
            >
                <div className="flex items-center gap-4 px-6 py-4 cursor-pointer" onClick={() => setSelectedLog(isSelected ? null : log)}>
                    <div className="flex flex-col items-center justify-center shrink-0 w-12 text-center border-r border-gray-100 pr-4">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">{format(new Date(log.created_at), 'MMM')}</span>
                        <span className="text-sm font-black text-gray-900">{format(new Date(log.created_at), 'dd')}</span>
                        <span className="text-[9px] font-bold text-gray-400">{format(new Date(log.created_at), 'HH:mm')}</span>
                    </div>

                    <div className="shrink-0">
                        <div className={`w-8 h-8 rounded-lg ${sev.bg} flex items-center justify-center`}>
                            <sev.icon size={16} className={sev.color} />
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">{log.source || 'Unknown Source'}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase ${sev.bg} ${sev.color}`}>
                                {log.severity}
                            </span>
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 truncate group-hover:text-amber-600 transition-colors">
                            {log.message}
                        </h4>
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <Code size={14} className="text-gray-300" />
                        )}
                        {isSelected ? <ChevronDown size={18} className="text-amber-500" /> : <ChevronRight size={18} className="text-gray-300" />}
                    </div>
                </div>

                <AnimatePresence>
                    {isSelected && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden bg-gray-50/50 border-t border-gray-100"
                        >
                            <div className="px-16 py-6 flex flex-col gap-4">
                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Full Error Message</p>
                                        <p className="text-sm text-gray-700 leading-relaxed font-mono bg-white p-3 rounded-xl border border-gray-200">
                                            {log.message}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Technical Metadata</p>
                                        <pre className="text-[11px] text-gray-500 bg-gray-900 p-4 rounded-xl overflow-x-auto text-amber-200">
                                            {JSON.stringify(log.metadata || {}, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5">
                                            <Clock size={12} className="text-gray-400" />
                                            <span className="text-[10px] font-bold text-gray-500">{format(new Date(log.created_at), 'PPPPpppp')}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <HardDrive size={12} className="text-gray-400" />
                                            <span className="text-[10px] font-bold text-gray-500 uppercase">ID: {log.id}</span>
                                        </div>
                                    </div>
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                                        <ExternalLink size={12} />
                                        Copy Details
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    };

    // ─── Main Render ───────────────────────────────────────────────────
    return (
        <PageLayout color="amber">
            <div className="flex flex-col h-full bg-transparent overflow-hidden">
                <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 flex flex-col h-full">

                    {/* ── Header ────────────────────────────────────── */}
                    <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl shadow-lg shadow-gray-200/40">
                                <Terminal className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-gray-900 tracking-tight">System Logs</h1>
                                <p className="text-xs text-gray-500 font-medium">Real-time monitoring and debugging console</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search logs..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all w-48 sm:w-64 shadow-sm"
                                />
                            </div>
                            <button
                                onClick={fetchLogs}
                                disabled={loading}
                                className="p-2 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 rounded-xl transition-all shadow-sm disabled:opacity-50"
                            >
                                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                            </button>
                        </div>
                    </div>

                    {/* ── Tabs ──────────────────────────────────────── */}
                    <div className="flex items-center gap-1.5 mb-4 shrink-0 overflow-x-auto pb-1 no-scrollbar">
                        {Object.entries(LOG_TAB_CONFIG).map(([key, config]) => {
                            const Icon = config.icon;
                            const isActive = activeTab === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => { setActiveTab(key); setSelectedLog(null); }}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                                        isActive
                                            ? `${config.bg} ${config.color} ring-1 ring-inset ring-amber-200/50 shadow-sm shadow-amber-100`
                                            : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100 hover:border-gray-200'
                                    }`}
                                >
                                    <Icon size={14} />
                                    {config.label}
                                </button>
                            );
                        })}
                        <div className="ml-auto flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                           Live Fetch
                        </div>
                    </div>

                    {/* ── Main List Area ────────────────────────────── */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-xl flex-1 flex flex-col min-h-0 overflow-hidden">
                        {loading ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-20 text-gray-400">
                                <Loader2 size={40} className="animate-spin text-amber-500 mb-4" />
                                <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Accessing Server Logs...</p>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col min-h-0">
                                {/* Table Headers */}
                                <div className="grid grid-cols-[3rem_2rem_1fr_4rem] gap-4 px-6 py-3 bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                   <span className="text-center">Time</span>
                                   <span>Sev</span>
                                   <span>Event Message</span>
                                   <span className="text-right">Detail</span>
                                </div>
                                
                                {/* Scrollable List */}
                                <div className="flex-1 overflow-y-auto no-scrollbar">
                                    {filteredLogs.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-32 text-gray-300">
                                            <Database size={48} className="mb-4 opacity-20" />
                                            <p className="font-bold text-gray-400">Zero entries found for this category</p>
                                            <p className="text-[10px] font-medium mt-1">Check if the 'logs' table exists and has data</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col">
                                            {filteredLogs.map(log => <LogItem key={log.id} log={log} />)}
                                        </div>
                                    )}
                                </div>

                                {/* Footer Stats */}
                                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[10px] font-bold text-gray-500 lowercase">
                                    <div className="flex items-center gap-4">
                                        <span className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                            {logs.filter(l => l.severity === 'error').length} Errors
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                            {logs.filter(l => l.severity === 'warning').length} Warnings
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        Total: {filteredLogs.length} entries filtered
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PageLayout>
    );
};

export default LogsPanel;
