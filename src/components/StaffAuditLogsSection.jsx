import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Shield, Search, RefreshCw, Clock, Filter, User, Terminal, HardDrive } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchStaffAuditLogs } from '../lib/staffService';
import { formatDate, formatRelativeTime } from '../lib/utils';
import toast from 'react-hot-toast';

export default function StaffAuditLogsSection() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState('all');

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await fetchStaffAuditLogs(150);
            if (error) throw error;
            setLogs(data || []);
        } catch (err) {
            console.error('Failed to load audit logs:', err);
            toast.error('Failed to load audit log history');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const term = searchTerm.toLowerCase();
            const matchesSearch =
                log.action?.toLowerCase().includes(term) ||
                log.operator_email?.toLowerCase().includes(term) ||
                log.target_type?.toLowerCase().includes(term) ||
                log.target_id?.toLowerCase().includes(term) ||
                JSON.stringify(log.details || {}).toLowerCase().includes(term);

            const matchesAction = actionFilter === 'all' || log.action === actionFilter;
            return matchesSearch && matchesAction;
        });
    }, [logs, searchTerm, actionFilter]);

    const actionColors = {
        UPDATE_DRIVER_STATUS: 'bg-amber-100 text-amber-800 border-amber-200',
        APPROVE_WITHDRAWAL: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        UPSERT_STAFF_MEMBER: 'bg-purple-100 text-purple-800 border-purple-200',
        ACTIVATE_STAFF: 'bg-blue-100 text-blue-800 border-blue-200',
        DEACTIVATE_STAFF: 'bg-red-100 text-red-800 border-red-200',
        PASSWORD_RECOVERY_INITIATED: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    return (
        <div className="space-y-4">
            {/* ── Search & Filter Controls ── */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex flex-1 items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search audit trail by operator, target, or details..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-amber-400 outline-none transition-all"
                        />
                    </div>
                    <select
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                        className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-amber-400"
                    >
                        <option value="all">All Actions</option>
                        <option value="UPDATE_DRIVER_STATUS">Driver Approvals</option>
                        <option value="APPROVE_WITHDRAWAL">Withdrawals</option>
                        <option value="UPSERT_STAFF_MEMBER">Staff Permissions</option>
                        <option value="ACTIVATE_STAFF">Staff Activated</option>
                        <option value="DEACTIVATE_STAFF">Staff Deactivated</option>
                        <option value="PASSWORD_RECOVERY_INITIATED">Password Recovery</option>
                    </select>
                </div>

                <button
                    onClick={loadLogs}
                    disabled={loading}
                    className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50 flex items-center gap-1.5 text-xs font-semibold"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh Logs
                </button>
            </div>

            {/* ── Log Table / List ── */}
            {loading ? (
                <div className="flex items-center justify-center p-12 bg-white rounded-3xl border border-gray-100">
                    <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                </div>
            ) : filteredLogs.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 p-6">
                    <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4 text-gray-400">
                        <Terminal size={32} />
                    </div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">No audit entries found</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        Administrative decisions (driver approvals, staff modifications, and withdrawals) will appear here in chronological order.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm divide-y divide-gray-100">
                    {filteredLogs.map((log) => {
                        return (
                            <div key={log.id} className="p-4 sm:p-5 hover:bg-gray-50/60 transition-colors">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                                            actionColors[log.action] || 'bg-gray-100 text-gray-700 border-gray-200'
                                        }`}>
                                            {log.action?.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-xs text-gray-500 font-mono">
                                            Target: <span className="font-bold text-gray-700">{log.target_type}</span> ({log.target_id?.slice(0, 8)}…)
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <Clock size={12} />
                                        <span title={log.created_at}>{formatRelativeTime(log.created_at)}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-500">Operator:</span>
                                        <span className="font-bold text-gray-900">{log.operator_email || 'System'}</span>
                                    </div>

                                    <div className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 text-[11px] font-mono text-gray-700 max-w-md truncate">
                                        {JSON.stringify(log.details)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
