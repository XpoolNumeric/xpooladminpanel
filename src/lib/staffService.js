import { supabase } from '../supabaseClient.js';

/**
 * Centrally defined permission keys, metadata, categories, and risk ratings.
 */
export const PERMISSION_DEFINITIONS = [
    // Dashboard
    { key: 'dashboard.view', category: 'Dashboard', label: 'View Dashboard & Metrics', description: 'Access live dashboard stats and operational heatmaps', highRisk: false },

    // Users
    { key: 'users.view', category: 'Users', label: 'View User Directory', description: 'Browse and search passenger and driver profiles', highRisk: false },
    { key: 'users.manage', category: 'Users', label: 'Manage User Accounts', description: 'Block, unblock, or modify passenger profiles', highRisk: true },

    // Trips
    { key: 'trips.view', category: 'Trips', label: 'View All Rides & Trips', description: 'Access completed, active, and scheduled trip data', highRisk: false },
    { key: 'trips.manage', category: 'Trips', label: 'Manage & Cancel Trips', description: 'Cancel or modify trips on behalf of passengers/drivers', highRisk: true },

    // Driver Approvals
    { key: 'driver_approvals.view', category: 'Driver Approvals', label: 'View Driver Queue', description: 'Inspect pending driver applications and vehicle info', highRisk: false },
    { key: 'driver_approvals.manage', category: 'Driver Approvals', label: 'Approve & Reject Drivers', description: 'Authoritatively grant driver verification or suspend drivers', highRisk: true },

    // Proofs & KYC
    { key: 'proofs.view', category: 'Proofs', label: 'View KYC Proof Documents', description: 'Inspect private Aadhaar, PAN, DL, RC, and Insurance scans', highRisk: false },
    { key: 'proofs.manage', category: 'Proofs', label: 'Manage Document Approvals', description: 'Approve document validity or request resubmission', highRisk: true },

    // Notifications
    { key: 'notifications.view', category: 'Notifications', label: 'View Notification History', description: 'Inspect scheduled and broadcast push notification history', highRisk: false },
    { key: 'notifications.manage', category: 'Notifications', label: 'Broadcast Push Notifications', description: 'Draft, test, and send mass push notifications to audiences', highRisk: true },

    // Financials
    { key: 'financials.view', category: 'Financials', label: 'View Financial Records', description: 'Inspect platform commission, ride payments, and balances', highRisk: false },
    { key: 'financials.manage', category: 'Financials', label: 'Approve Fund Withdrawals', description: 'Approve and finalize driver wallet cash withdrawal requests', highRisk: true },

    // Reports
    { key: 'reports.view', category: 'Reports', label: 'View Analytics & Reports', description: 'Access gross TPV, revenue charts, and performance reports', highRisk: false },

    // Logs
    { key: 'logs.view', category: 'Logs', label: 'View System & Audit Logs', description: 'Inspect server errors, payment logs, and activity events', highRisk: false },
    { key: 'logs.manage', category: 'Logs', label: 'Manage System Logs', description: 'Export or clear system debug and error logs', highRisk: true },

    // Staff Administration
    { key: 'staff.view', category: 'Staff Management', label: 'View Staff Directory', description: 'Browse staff accounts, roles, and assigned access keys', highRisk: false },
    { key: 'staff.manage', category: 'Staff Management', label: 'Full Staff Administration', description: 'Create staff, change roles, grant overrides, deactivate accounts', highRisk: true },

    // Settings
    { key: 'settings.view', category: 'Settings', label: 'View Platform Settings', description: 'Inspect base fare, pricing tiers, and surge rates', highRisk: false },
    { key: 'settings.manage', category: 'Settings', label: 'Modify Platform Settings', description: 'Change platform commission rate, fare tiers, and surge pricing', highRisk: true },
];

/**
 * Standard role default permission lists.
 */
export const ROLE_TEMPLATES = {
    marketing: [
        'dashboard.view',
        'notifications.view',
        'notifications.manage',
    ],
    support: [
        'dashboard.view',
        'users.view',
        'users.manage',
        'trips.view',
    ],
    proofs_manager: [
        'dashboard.view',
        'driver_approvals.view',
        'driver_approvals.manage',
        'proofs.view',
        'proofs.manage',
    ],
    super_admin: PERMISSION_DEFINITIONS.map(p => p.key),
    main_admin: PERMISSION_DEFINITIONS.map(p => p.key),
    custom: ['dashboard.view'],
};

export const ROLE_LABELS = {
    super_admin: 'Main Admin (Superuser)',
    main_admin: 'Main Admin',
    support: 'Customer Support',
    marketing: 'Marketing Operations',
    proofs_manager: 'Proofs & KYC Manager',
    custom: 'Custom Role',
};

/**
 * Fetches the currently authenticated session's effective permissions.
 */
export async function getEffectivePermissions() {
    try {
        const { data, error } = await supabase.rpc('get_my_staff_permissions');
        if (error) throw error;
        return data;
    } catch (err) {
        console.warn('[staffService] RPC get_my_staff_permissions fallback:', err);
        // Fallback for legacy admin
        const isAdmin = localStorage.getItem('adminAuth') === 'true';
        const role = localStorage.getItem('adminRole') || 'admin';
        return {
            authenticated: isAdmin,
            is_staff: isAdmin,
            is_active: isAdmin,
            is_super_admin: role === 'super_admin' || role === 'admin',
            role: role,
            permissions: role === 'super_admin' || role === 'admin' ? ROLE_TEMPLATES.super_admin : [],
        };
    }
}

/**
 * Fetches all staff members with their permissions and status.
 */
export async function fetchStaffDirectory() {
    try {
        const { data: staffList, error: staffErr } = await supabase
            .from('staff_members')
            .select('*')
            .order('created_at', { ascending: false });

        if (staffErr) throw staffErr;

        const { data: permissionsList, error: permErr } = await supabase
            .from('staff_permissions')
            .select('*');

        if (permErr) throw permErr;

        // Map permissions to each staff member
        const staffWithPerms = (staffList || []).map(staff => {
            const overrides = {};
            (permissionsList || [])
                .filter(p => p.staff_id === staff.id)
                .forEach(p => { overrides[p.permission_key] = p.granted; });

            const defaults = ROLE_TEMPLATES[staff.role] || [];
            const effective = new Set(defaults);

            Object.entries(overrides).forEach(([key, granted]) => {
                if (granted) effective.add(key);
                else effective.delete(key);
            });

            return {
                ...staff,
                custom_overrides: overrides,
                effective_permissions: Array.from(effective),
            };
        });

        return { data: staffWithPerms, error: null };
    } catch (error) {
        console.error('[staffService] fetchStaffDirectory error:', error);
        return { data: [], error };
    }
}

/**
 * Provisions a new staff member via secure Edge Function.
 */
export async function provisionStaffMember({ email, password, full_name, role, custom_permissions }) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('Unauthenticated session');

        const { data, error } = await supabase.functions.invoke('manage-staff', {
            body: {
                action: 'create_staff',
                email,
                password,
                full_name,
                role,
                custom_permissions,
            },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to provision staff member');

        return { data, error: null };
    } catch (error) {
        console.error('[staffService] provisionStaffMember error:', error);
        return { data: null, error };
    }
}

/**
 * Toggles a staff member's active status.
 */
export async function toggleStaffStatus(staffId, isActive) {
    try {
        const { data, error } = await supabase.functions.invoke('manage-staff', {
            body: {
                action: 'toggle_status',
                staff_id: staffId,
                is_active: isActive,
            },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to update status');

        return { data, error: null };
    } catch (error) {
        console.error('[staffService] toggleStaffStatus error:', error);
        return { data: null, error };
    }
}

/**
 * Updates staff details, role, and custom permission overrides.
 */
export async function updateStaffPermissions({ staffId, email, full_name, role, isActive, customPermissions }) {
    try {
        const { data, error } = await supabase.rpc('admin_upsert_staff_member', {
            p_staff_id: staffId,
            p_email: email,
            p_full_name: full_name,
            p_role: role,
            p_is_active: isActive,
            p_custom_permissions: customPermissions,
        });

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('[staffService] updateStaffPermissions error:', error);
        return { data: null, error };
    }
}

/**
 * Initiates a password recovery request for staff.
 */
export async function initiatePasswordRecovery(email) {
    try {
        const { data, error } = await supabase.functions.invoke('manage-staff', {
            body: {
                action: 'reset_password',
                email,
            },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to send recovery instructions');

        return { data, error: null };
    } catch (error) {
        console.error('[staffService] initiatePasswordRecovery error:', error);
        return { data: null, error };
    }
}

/**
 * Fetches recent administrative audit logs.
 */
export async function fetchStaffAuditLogs(limit = 100) {
    try {
        const { data, error } = await supabase
            .from('staff_audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return { data: data || [], error: null };
    } catch (error) {
        console.error('[staffService] fetchStaffAuditLogs error:', error);
        return { data: [], error };
    }
}
