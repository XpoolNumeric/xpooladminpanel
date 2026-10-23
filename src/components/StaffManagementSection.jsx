import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Users, Plus, Search, Shield, ShieldAlert, Check, X,
    Lock, Mail, User, AlertCircle, RefreshCw, KeyRound,
    CheckCircle2, ChevronRight, Sliders, Eye, EyeOff, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
    PERMISSION_DEFINITIONS, ROLE_TEMPLATES, ROLE_LABELS,
    fetchStaffDirectory, provisionStaffMember, toggleStaffStatus,
    updateStaffPermissions, initiatePasswordRecovery
} from '../lib/staffService';
import { useStaffAuth } from '../context/StaffAuthContext';
import { formatDate } from '../lib/utils';

export default function StaffManagementSection() {
    const { staff: currentStaff, hasPermission } = useStaffAuth();
    const canManage = hasPermission('staff.manage');

    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    // Modals
    const [showProvisionModal, setShowProvisionModal] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Provision Form State
    const [provisionForm, setProvisionForm] = useState({
        full_name: '',
        email: '',
        password: '',
        role: 'support',
        showPassword: false,
    });

    // Permission Editor State
    const [editorRole, setEditorRole] = useState('support');
    const [editorPermissions, setEditorPermissions] = useState({});
    const [hasUnsavedPerms, setHasUnsavedPerms] = useState(false);

    // ─── Fetch Staff Directory ──────────────────────────────────────────
    const loadStaff = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await fetchStaffDirectory();
            if (error) throw error;
            setStaffList(data || []);
        } catch (err) {
            console.error('Error loading staff:', err);
            toast.error('Failed to load staff directory');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStaff();
    }, [loadStaff]);

    // ─── Filtered Staff ─────────────────────────────────────────────────
    const filteredStaff = useMemo(() => {
        return staffList.filter(s => {
            const term = searchTerm.toLowerCase();
            const matchesSearch =
                s.full_name?.toLowerCase().includes(term) ||
                s.email?.toLowerCase().includes(term) ||
                s.role?.toLowerCase().includes(term);

            const matchesRole = roleFilter === 'all' || s.role === roleFilter;
            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active' && s.is_active) ||
                (statusFilter === 'disabled' && !s.is_active);

            return matchesSearch && matchesRole && matchesStatus;
        });
    }, [staffList, searchTerm, roleFilter, statusFilter]);

    // ─── Toggle Active Status ───────────────────────────────────────────
    const handleToggleStatus = async (staffMember) => {
        if (!canManage) {
            toast.error('You do not have permission to change staff status.');
            return;
        }

        const nextStatus = !staffMember.is_active;

        // Safety warning for Main Admin
        if (!nextStatus && ['super_admin', 'main_admin'].includes(staffMember.role)) {
            const activeSuperAdmins = staffList.filter(s => s.is_active && ['super_admin', 'main_admin'].includes(s.role));
            if (activeSuperAdmins.length <= 1) {
                toast.error('Safety Guard: Cannot disable the only active Main Admin!');
                return;
            }
        }

        const confirmMsg = nextStatus
            ? `Re-activate ${staffMember.full_name}'s administrative access?`
            : `Disable ${staffMember.full_name}? They will be immediately blocked from all administrative operations.`;

        if (!window.confirm(confirmMsg)) return;

        setActionLoading(true);
        try {
            const { error } = await toggleStaffStatus(staffMember.id, nextStatus);
            if (error) throw error;
            toast.success(`Staff member ${nextStatus ? 'activated' : 'disabled'}`);
            loadStaff();
        } catch (err) {
            toast.error(err.message || 'Failed to update staff status');
        } finally {
            setActionLoading(false);
        }
    };

    // ─── Handle Provisioning ────────────────────────────────────────────
    const handleCreateStaff = async (e) => {
        e.preventDefault();
        if (!provisionForm.full_name.trim() || !provisionForm.email.trim() || !provisionForm.password) {
            toast.error('All fields are required.');
            return;
        }
        if (provisionForm.password.length < 8) {
            toast.error('Password must be at least 8 characters.');
            return;
        }

        setActionLoading(true);
        try {
            const { error } = await provisionStaffMember({
                full_name: provisionForm.full_name.trim(),
                email: provisionForm.email.trim(),
                password: provisionForm.password,
                role: provisionForm.role,
            });

            if (error) throw error;
            toast.success('Staff account created successfully!');
            setShowProvisionModal(false);
            setProvisionForm({ full_name: '', email: '', password: '', role: 'support', showPassword: false });
            loadStaff();
        } catch (err) {
            toast.error(err.message || 'Failed to create staff account');
        } finally {
            setActionLoading(false);
        }
    };

    // ─── Open Permission Editor ─────────────────────────────────────────
    const handleOpenEditor = (staffMember) => {
        setEditingStaff(staffMember);
        setEditorRole(staffMember.role || 'support');

        // Preload permission switches
        const defaults = ROLE_TEMPLATES[staffMember.role] || [];
        const initialPerms = {};
        PERMISSION_DEFINITIONS.forEach(def => {
            if (staffMember.custom_overrides?.[def.key] !== undefined) {
                initialPerms[def.key] = staffMember.custom_overrides[def.key];
            } else {
                initialPerms[def.key] = defaults.includes(def.key);
            }
        });

        setEditorPermissions(initialPerms);
        setHasUnsavedPerms(false);
    };

    // Toggle single permission in editor
    const handleTogglePerm = (key) => {
        setEditorPermissions(prev => ({
            ...prev,
            [key]: !prev[key],
        }));
        setHasUnsavedPerms(true);
    };

    // Reset permissions to role defaults
    const handleResetRoleDefaults = (newRole) => {
        const targetRole = newRole || editorRole;
        const defaults = ROLE_TEMPLATES[targetRole] || [];
        const resetPerms = {};
        PERMISSION_DEFINITIONS.forEach(def => {
            resetPerms[def.key] = defaults.includes(def.key);
        });
        setEditorPermissions(resetPerms);
        setHasUnsavedPerms(true);
    };

    // Save permissions
    const handleSavePermissions = async () => {
        if (!editingStaff) return;
        setActionLoading(true);

        try {
            // Determine custom overrides compared to role defaults
            const defaults = ROLE_TEMPLATES[editorRole] || [];
            const overrides = {};
            PERMISSION_DEFINITIONS.forEach(def => {
                const isDefault = defaults.includes(def.key);
                const currentVal = editorPermissions[def.key];
                if (currentVal !== isDefault) {
                    overrides[def.key] = currentVal;
                }
            });

            const { error } = await updateStaffPermissions({
                staffId: editingStaff.id,
                email: editingStaff.email,
                full_name: editingStaff.full_name,
                role: editorRole,
                isActive: editingStaff.is_active,
                customPermissions: overrides,
            });

            if (error) throw error;
            toast.success('Staff permissions updated successfully!');
            setEditingStaff(null);
            loadStaff();
        } catch (err) {
            toast.error(err.message || 'Failed to update permissions');
        } finally {
            setActionLoading(false);
        }
    };

    // ─── Password Reset ─────────────────────────────────────────────────
    const handlePasswordReset = async (email) => {
        if (!confirm(`Send a password reset instructions link to ${email}?`)) return;
        try {
            const { error } = await initiatePasswordRecovery(email);
            if (error) throw error;
            toast.success('Password reset link sent to work email.');
        } catch (err) {
            toast.error(err.message || 'Failed to initiate password reset.');
        }
    };

    // Group permission definitions by category
    const categories = useMemo(() => {
        const groups = {};
        PERMISSION_DEFINITIONS.forEach(p => {
            if (!groups[p.category]) groups[p.category] = [];
            groups[p.category].push(p);
        });
        return groups;
    }, []);

    const roleBadgeStyles = {
        super_admin: 'bg-purple-100 text-purple-800 border-purple-200',
        main_admin: 'bg-purple-100 text-purple-800 border-purple-200',
        support: 'bg-blue-100 text-blue-800 border-blue-200',
        marketing: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        proofs_manager: 'bg-amber-100 text-amber-800 border-amber-200',
        custom: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    return (
        <div className="space-y-6">
            {/* ── Top Bar: Search, Filters & Provision Action ── */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex flex-1 items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search staff by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-amber-400 outline-none transition-all"
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-amber-400"
                    >
                        <option value="all">All Roles</option>
                        <option value="super_admin">Main Admin</option>
                        <option value="support">Customer Support</option>
                        <option value="marketing">Marketing</option>
                        <option value="proofs_manager">Proofs Manager</option>
                        <option value="custom">Custom Role</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-amber-400"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active Only</option>
                        <option value="disabled">Disabled Only</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={loadStaff}
                        disabled={loading}
                        className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
                        title="Refresh Directory"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                    {canManage && (
                        <button
                            onClick={() => setShowProvisionModal(true)}
                            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all active:scale-95"
                        >
                            <Plus size={16} />
                            Provision Staff Member
                        </button>
                    )}
                </div>
            </div>

            {/* ── Staff Directory Cards ── */}
            {loading ? (
                <div className="flex items-center justify-center p-12 bg-white rounded-3xl border border-gray-100">
                    <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                </div>
            ) : filteredStaff.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 p-6">
                    <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4 text-amber-500">
                        <Users size={32} />
                    </div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">No staff members found</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        {searchTerm ? 'No results matched your search term.' : 'Click "Provision Staff Member" above to create your first delegated staff account.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredStaff.map((member) => {
                        const isSelf = member.id === currentStaff?.id;
                        return (
                            <motion.div
                                key={member.id}
                                layout
                                className={`bg-white rounded-3xl p-5 border transition-all shadow-sm flex flex-col justify-between ${
                                    member.is_active ? 'border-gray-100 hover:border-amber-200' : 'border-red-100 bg-red-50/20 opacity-80'
                                }`}
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="relative shrink-0">
                                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm uppercase shadow-sm ${
                                                    member.is_active ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white' : 'bg-gray-200 text-gray-500'
                                                }`}>
                                                    {member.full_name?.charAt(0) || 'S'}
                                                </div>
                                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                                    member.is_active ? 'bg-emerald-500' : 'bg-red-500'
                                                }`} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-extrabold text-gray-900 text-sm truncate flex items-center gap-1.5">
                                                    {member.full_name}
                                                    {isSelf && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.2 rounded font-bold">You</span>}
                                                </h4>
                                                <p className="text-xs text-gray-400 truncate">{member.email}</p>
                                            </div>
                                        </div>

                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${roleBadgeStyles[member.role] || roleBadgeStyles.custom}`}>
                                            {ROLE_LABELS[member.role] || member.role}
                                        </span>
                                    </div>

                                    {/* Permission summary */}
                                    <div className="bg-gray-50 rounded-2xl p-3 my-3 border border-gray-100">
                                        <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 mb-1.5">
                                            <span>Effective Access</span>
                                            <span className="text-amber-600">
                                                {member.effective_permissions?.length || 0} / {PERMISSION_DEFINITIONS.length} keys
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1 max-h-16 overflow-hidden">
                                            {(member.effective_permissions || []).slice(0, 4).map(p => (
                                                <span key={p} className="text-[9px] font-bold bg-white text-gray-600 px-2 py-0.5 rounded-md border border-gray-200">
                                                    {p.split('.')[1] || p}
                                                </span>
                                            ))}
                                            {(member.effective_permissions?.length || 0) > 4 && (
                                                <span className="text-[9px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md">
                                                    +{member.effective_permissions.length - 4} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2 mt-2">
                                    <div className="flex items-center gap-2">
                                        {canManage && (
                                            <button
                                                onClick={() => handleToggleStatus(member)}
                                                disabled={actionLoading}
                                                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all ${
                                                    member.is_active
                                                        ? 'text-red-600 border-red-200 hover:bg-red-50'
                                                        : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                                                }`}
                                            >
                                                {member.is_active ? 'Disable' : 'Activate'}
                                            </button>
                                        )}
                                        {canManage && (
                                            <button
                                                onClick={() => handlePasswordReset(member.email)}
                                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                                title="Send password recovery link"
                                            >
                                                <KeyRound size={15} />
                                            </button>
                                        )}
                                    </div>

                                    {canManage && (
                                        <button
                                            onClick={() => handleOpenEditor(member)}
                                            className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                                        >
                                            <Sliders size={13} />
                                            Configure Access
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* ── Provisioning Modal ── */}
            <AnimatePresence>
                {showProvisionModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm"
                        onClick={() => setShowProvisionModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100"
                        >
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-amber-500 text-white rounded-2xl shadow-md shadow-amber-500/20">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-extrabold text-gray-900">Provision Staff Member</h3>
                                        <p className="text-xs text-gray-400">Secure server-side account setup</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowProvisionModal(false)} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg">
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateStaff} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Priya Sharma"
                                        value={provisionForm.full_name}
                                        onChange={(e) => setProvisionForm({ ...provisionForm, full_name: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:border-amber-400 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1">Work Email</label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="staff@xpool.app"
                                        value={provisionForm.email}
                                        onChange={(e) => setProvisionForm({ ...provisionForm, email: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:border-amber-400 outline-none"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-bold text-gray-700">Initial Password</label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const autoPass = Math.random().toString(36).slice(-8) + 'Xp!9';
                                                setProvisionForm(prev => ({ ...prev, password: autoPass, showPassword: true }));
                                            }}
                                            className="text-[10px] text-amber-600 font-bold hover:underline"
                                        >
                                            Auto-generate
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={provisionForm.showPassword ? 'text' : 'password'}
                                            required
                                            minLength={8}
                                            placeholder="Min 8 characters"
                                            value={provisionForm.password}
                                            onChange={(e) => setProvisionForm({ ...provisionForm, password: e.target.value })}
                                            className="w-full pl-3.5 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:border-amber-400 outline-none font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setProvisionForm(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {provisionForm.showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1">Assigned Role Template</label>
                                    <select
                                        value={provisionForm.role}
                                        onChange={(e) => setProvisionForm({ ...provisionForm, role: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:border-amber-400 outline-none"
                                    >
                                        <option value="support">Customer Support (User & Trip Management)</option>
                                        <option value="marketing">Marketing (Notifications & Broadcasts)</option>
                                        <option value="proofs_manager">Proofs Manager (KYC & Driver Verification)</option>
                                        <option value="custom">Custom Permission Set</option>
                                        <option value="main_admin">Main Admin (Superuser Authority)</option>
                                    </select>
                                </div>

                                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/60 text-[11px] text-amber-800 leading-relaxed">
                                    <span className="font-bold">Security Note:</span> Accounts are provisioned via Supabase GoTrue Admin API. Passwords are encrypted server-side and never stored in plaintext tables.
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowProvisionModal(false)}
                                        className="flex-1 py-3 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={actionLoading}
                                        className="flex-1 py-3 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {actionLoading ? <RefreshCw size={15} className="animate-spin" /> : 'Provision Account'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Granular Permission Editor Modal ── */}
            <AnimatePresence>
                {editingStaff && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm"
                        onClick={() => setEditingStaff(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]"
                        >
                            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                                <div>
                                    <h3 className="text-base font-extrabold text-gray-900">
                                        Configure Access & Permissions
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                        Target: <span className="font-bold text-gray-800">{editingStaff.full_name}</span> ({editingStaff.email})
                                    </p>
                                </div>
                                <button onClick={() => setEditingStaff(null)} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Role Selector & Default Reset */}
                            <div className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-50/50 p-4 rounded-2xl my-3 border border-amber-100">
                                <div className="flex items-center gap-3">
                                    <label className="text-xs font-bold text-gray-700">Role Base:</label>
                                    <select
                                        value={editorRole}
                                        onChange={(e) => {
                                            const newR = e.target.value;
                                            setEditorRole(newR);
                                            handleResetRoleDefaults(newR);
                                        }}
                                        className="py-1.5 px-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:border-amber-400 outline-none"
                                    >
                                        <option value="support">Customer Support</option>
                                        <option value="marketing">Marketing Operations</option>
                                        <option value="proofs_manager">Proofs & KYC Manager</option>
                                        <option value="custom">Custom Permissions</option>
                                        <option value="main_admin">Main Admin (Superuser)</option>
                                    </select>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleResetRoleDefaults(editorRole)}
                                    className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1"
                                >
                                    <RotateCcw size={13} />
                                    Reset to Role Defaults
                                </button>
                            </div>

                            {/* Permission Categories Scrollable Grid */}
                            <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar py-2">
                                {Object.entries(categories).map(([category, perms]) => (
                                    <div key={category} className="space-y-2">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 px-1">
                                            {category}
                                        </h4>
                                        <div className="space-y-2">
                                            {perms.map(p => {
                                                const isEnabled = Boolean(editorPermissions[p.key]);
                                                const isDefault = (ROLE_TEMPLATES[editorRole] || []).includes(p.key);
                                                const isOverride = isEnabled !== isDefault;

                                                return (
                                                    <div
                                                        key={p.key}
                                                        onClick={() => handleTogglePerm(p.key)}
                                                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                                            isEnabled ? 'bg-amber-50/40 border-amber-200' : 'bg-gray-50/50 border-gray-200/80 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <span className="text-xs font-bold text-gray-900">{p.label}</span>
                                                                {p.highRisk && (
                                                                    <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.2 rounded bg-red-100 text-red-700 border border-red-200">
                                                                        High Risk
                                                                    </span>
                                                                )}
                                                                {isOverride && (
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700">
                                                                        Override
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-gray-500 leading-snug">{p.description}</p>
                                                        </div>

                                                        {/* Accessible Toggle */}
                                                        <div
                                                            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
                                                                isEnabled ? 'bg-amber-500' : 'bg-gray-300'
                                                            }`}
                                                        >
                                                            <motion.div
                                                                layout
                                                                className="w-5 h-5 rounded-full bg-white shadow-sm"
                                                                style={{
                                                                    transform: isEnabled ? 'translateX(20px)' : 'translateX(0px)',
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Footer Actions */}
                            <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                                <span className="text-xs text-gray-500 font-medium">
                                    {hasUnsavedPerms ? '⚠️ You have unsaved changes' : 'All permissions in sync'}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditingStaff(null)}
                                        className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSavePermissions}
                                        disabled={actionLoading}
                                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {actionLoading ? <RefreshCw size={15} className="animate-spin" /> : 'Save Permission Overrides'}
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
