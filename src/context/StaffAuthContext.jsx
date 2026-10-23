import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getEffectivePermissions, ROLE_TEMPLATES } from '../lib/staffService';
import toast from 'react-hot-toast';

const StaffAuthContext = createContext(null);

export const StaffAuthProvider = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const [staff, setStaff] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const refreshPermissions = useCallback(async () => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session?.user) {
                setStaff(null);
                setPermissions([]);
                setIsAuthenticated(false);
                setLoading(false);
                return;
            }

            const effective = await getEffectivePermissions();

            if (!effective?.authenticated || effective?.is_active === false) {
                console.warn('[StaffAuth] Account disabled or unauthenticated.');
                setStaff(null);
                setPermissions([]);
                setIsAuthenticated(false);
                setLoading(false);
                return;
            }

            const perms = Array.isArray(effective.permissions)
                ? effective.permissions
                : Object.keys(effective.permissions || {});

            setStaff({
                id: session.user.id,
                email: effective.email || session.user.email,
                name: effective.full_name || session.user.user_metadata?.full_name || 'Staff User',
                role: effective.role || 'support',
                is_super_admin: Boolean(effective.is_super_admin || effective.role === 'super_admin' || effective.role === 'main_admin'),
                is_active: Boolean(effective.is_active),
            });

            setPermissions(perms);
            setIsAuthenticated(true);
        } catch (err) {
            console.error('[StaffAuth] Refresh error:', err);
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshPermissions();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                refreshPermissions();
            } else if (event === 'SIGNED_OUT') {
                setStaff(null);
                setPermissions([]);
                setIsAuthenticated(false);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [refreshPermissions]);

    const hasPermission = useCallback((permKey) => {
        if (!staff) return false;
        if (staff.is_super_admin) return true;
        return permissions.includes(permKey);
    }, [staff, permissions]);

    const logout = async () => {
        try {
            await supabase.auth.signOut().catch(() => {});
        } finally {
            localStorage.removeItem('adminAuth');
            localStorage.removeItem('adminRole');
            localStorage.removeItem('adminName');
            localStorage.removeItem('adminEmail');
            localStorage.removeItem('adminAvatar');
            setStaff(null);
            setPermissions([]);
            setIsAuthenticated(false);
            window.location.href = '/';
        }
    };

    return (
        <StaffAuthContext.Provider
            value={{
                loading,
                staff,
                permissions,
                isAuthenticated,
                hasPermission,
                refreshPermissions,
                logout,
            }}
        >
            {children}
        </StaffAuthContext.Provider>
    );
};

export const useStaffAuth = () => {
    const context = useContext(StaffAuthContext);
    if (!context) {
        throw new Error('useStaffAuth must be used within a StaffAuthProvider');
    }
    return context;
};
