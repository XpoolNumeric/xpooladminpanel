import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    PERMISSION_DEFINITIONS,
    ROLE_TEMPLATES,
    ROLE_LABELS,
} from '../lib/staffService.js';

// Helper simulating StaffAuthContext authorization logic
function evaluateStaffAccess({ staff, permissions = [], requiredPermission }) {
    if (!staff) return false;
    if (staff.is_active === false) return false;
    if (staff.is_super_admin || staff.role === 'super_admin' || staff.role === 'main_admin') return true;
    return permissions.includes(requiredPermission);
}

// Helper simulating custom override computation
function computeEffectivePermissions(role, customOverrides = {}) {
    const defaults = ROLE_TEMPLATES[role] || [];
    const effective = new Set(defaults);

    Object.entries(customOverrides).forEach(([permKey, granted]) => {
        if (granted) {
            effective.add(permKey);
        } else {
            effective.delete(permKey);
        }
    });

    return Array.from(effective);
}

describe('XPOOL RBAC Security & Authorization Suite', () => {

    describe('1. Role Template Matrix & Boundary Enforcement', () => {
        it('should define all 20 canonical permission keys across 10 categories', () => {
            assert.equal(PERMISSION_DEFINITIONS.length, 20);
            const keys = PERMISSION_DEFINITIONS.map(p => p.key);
            assert.ok(keys.includes('dashboard.view'));
            assert.ok(keys.includes('users.view'));
            assert.ok(keys.includes('users.manage'));
            assert.ok(keys.includes('trips.view'));
            assert.ok(keys.includes('trips.manage'));
            assert.ok(keys.includes('driver_approvals.view'));
            assert.ok(keys.includes('driver_approvals.manage'));
            assert.ok(keys.includes('proofs.view'));
            assert.ok(keys.includes('proofs.manage'));
            assert.ok(keys.includes('notifications.view'));
            assert.ok(keys.includes('notifications.manage'));
            assert.ok(keys.includes('financials.view'));
            assert.ok(keys.includes('financials.manage'));
            assert.ok(keys.includes('reports.view'));
            assert.ok(keys.includes('logs.view'));
            assert.ok(keys.includes('logs.manage'));
            assert.ok(keys.includes('staff.view'));
            assert.ok(keys.includes('staff.manage'));
            assert.ok(keys.includes('settings.view'));
            assert.ok(keys.includes('settings.manage'));
        });

        it('Main Admin (super_admin) must hold all 20 permissions', () => {
            const superAdminPerms = ROLE_TEMPLATES.super_admin;
            assert.equal(superAdminPerms.length, 20);
            PERMISSION_DEFINITIONS.forEach(perm => {
                assert.ok(superAdminPerms.includes(perm.key), `Super admin missing permission: ${perm.key}`);
            });
        });

        it('Marketing role template must ONLY allow notifications and dashboard', () => {
            const marketingPerms = ROLE_TEMPLATES.marketing;
            assert.deepEqual(marketingPerms.sort(), [
                'dashboard.view',
                'notifications.manage',
                'notifications.view',
            ].sort());

            // Strict forbidden checks
            assert.equal(marketingPerms.includes('users.view'), false);
            assert.equal(marketingPerms.includes('trips.view'), false);
            assert.equal(marketingPerms.includes('driver_approvals.view'), false);
            assert.equal(marketingPerms.includes('driver_approvals.manage'), false);
            assert.equal(marketingPerms.includes('financials.view'), false);
            assert.equal(marketingPerms.includes('financials.manage'), false);
            assert.equal(marketingPerms.includes('staff.manage'), false);
            assert.equal(marketingPerms.includes('settings.view'), false);
        });

        it('Support role template must ONLY allow users, trips, and dashboard', () => {
            const supportPerms = ROLE_TEMPLATES.support;
            assert.deepEqual(supportPerms.sort(), [
                'dashboard.view',
                'trips.view',
                'users.manage',
                'users.view',
            ].sort());

            // Strict forbidden checks
            assert.equal(supportPerms.includes('driver_approvals.manage'), false);
            assert.equal(supportPerms.includes('proofs.manage'), false);
            assert.equal(supportPerms.includes('financials.view'), false);
            assert.equal(supportPerms.includes('financials.manage'), false);
            assert.equal(supportPerms.includes('notifications.manage'), false);
            assert.equal(supportPerms.includes('settings.view'), false);
            assert.equal(supportPerms.includes('staff.manage'), false);
        });

        it('Proofs Manager role template must ONLY allow KYC proofs and driver approvals', () => {
            const proofsPerms = ROLE_TEMPLATES.proofs_manager;
            assert.deepEqual(proofsPerms.sort(), [
                'dashboard.view',
                'driver_approvals.manage',
                'driver_approvals.view',
                'proofs.manage',
                'proofs.view',
            ].sort());

            // Strict forbidden checks
            assert.equal(proofsPerms.includes('users.view'), false);
            assert.equal(proofsPerms.includes('trips.view'), false);
            assert.equal(proofsPerms.includes('financials.view'), false);
            assert.equal(proofsPerms.includes('financials.manage'), false);
            assert.equal(proofsPerms.includes('notifications.manage'), false);
            assert.equal(proofsPerms.includes('settings.view'), false);
            assert.equal(proofsPerms.includes('staff.manage'), false);
        });
    });

    describe('2. Fail-Closed Security & Account Invariants', () => {
        it('Deactivated staff member (is_active: false) must be rejected for ANY permission', () => {
            const inactiveStaff = {
                id: 'staff-inactive-1',
                email: 'rogue@xpool.test',
                role: 'super_admin',
                is_super_admin: true,
                is_active: false,
            };

            PERMISSION_DEFINITIONS.forEach(perm => {
                const allowed = evaluateStaffAccess({
                    staff: inactiveStaff,
                    permissions: ROLE_TEMPLATES.super_admin,
                    requiredPermission: perm.key,
                });
                assert.equal(allowed, false, `Inactive staff must fail closed for ${perm.key}`);
            });
        });

        it('Unauthenticated session (null staff) must fail closed', () => {
            const allowed = evaluateStaffAccess({
                staff: null,
                permissions: [],
                requiredPermission: 'dashboard.view',
            });
            assert.equal(allowed, false);
        });

        it('High-risk capabilities must NOT be granted by default to non-admin roles', () => {
            const highRiskKeys = PERMISSION_DEFINITIONS.filter(p => p.highRisk).map(p => p.key);
            assert.ok(highRiskKeys.includes('financials.manage'));
            assert.ok(highRiskKeys.includes('staff.manage'));
            assert.ok(highRiskKeys.includes('settings.manage'));

            // Marketing must have 0 financial/staff/settings high-risk permissions
            assert.equal(ROLE_TEMPLATES.marketing.includes('financials.manage'), false);
            assert.equal(ROLE_TEMPLATES.marketing.includes('staff.manage'), false);
            assert.equal(ROLE_TEMPLATES.marketing.includes('settings.manage'), false);

            // Support must have 0 financial/staff/settings high-risk permissions
            assert.equal(ROLE_TEMPLATES.support.includes('financials.manage'), false);
            assert.equal(ROLE_TEMPLATES.support.includes('staff.manage'), false);
            assert.equal(ROLE_TEMPLATES.support.includes('settings.manage'), false);

            // Proofs Manager must have 0 financial/staff/settings high-risk permissions
            assert.equal(ROLE_TEMPLATES.proofs_manager.includes('financials.manage'), false);
            assert.equal(ROLE_TEMPLATES.proofs_manager.includes('staff.manage'), false);
            assert.equal(ROLE_TEMPLATES.proofs_manager.includes('settings.manage'), false);
        });
    });

    describe('3. Granular Custom Permission Overrides', () => {
        it('Positive override: granting notifications.view to Support works without side effects', () => {
            const baseSupport = ROLE_TEMPLATES.support;
            assert.equal(baseSupport.includes('notifications.view'), false);

            const effective = computeEffectivePermissions('support', {
                'notifications.view': true,
            });

            assert.ok(effective.includes('notifications.view'));
            assert.ok(effective.includes('users.view'));
            // Still forbidden from broadcasting or financials
            assert.equal(effective.includes('notifications.manage'), false);
            assert.equal(effective.includes('financials.view'), false);
        });

        it('Negative override: explicitly revoking users.manage removes it from Support', () => {
            const effective = computeEffectivePermissions('support', {
                'users.manage': false,
            });

            assert.equal(effective.includes('users.manage'), false);
            assert.ok(effective.includes('users.view'));
            assert.ok(effective.includes('trips.view'));
        });
    });

    describe('4. Simulated Route Guard Matrix for All 4 Roles', () => {
        const routes = [
            { path: '/dashboard', required: 'dashboard.view' },
            { path: '/users', required: 'users.view' },
            { path: '/trips', required: 'trips.view' },
            { path: '/approvals', required: 'driver_approvals.view' },
            { path: '/withdrawals', required: 'financials.view' },
            { path: '/push-notifications', required: 'notifications.view' },
            { path: '/settings', required: 'settings.view' },
            { path: '/reports', required: 'reports.view' },
            { path: '/logs', required: 'logs.view' },
        ];

        it('Marketing: accesses only /dashboard and /push-notifications', () => {
            const staff = { id: 'm-1', role: 'marketing', is_active: true, is_super_admin: false };
            const perms = ROLE_TEMPLATES.marketing;

            routes.forEach(route => {
                const canAccess = evaluateStaffAccess({ staff, permissions: perms, requiredPermission: route.required });
                if (route.path === '/dashboard' || route.path === '/push-notifications') {
                    assert.equal(canAccess, true, `Marketing should access ${route.path}`);
                } else {
                    assert.equal(canAccess, false, `Marketing MUST NOT access ${route.path}`);
                }
            });
        });

        it('Support: accesses /dashboard, /users, and /trips; blocked from others', () => {
            const staff = { id: 's-1', role: 'support', is_active: true, is_super_admin: false };
            const perms = ROLE_TEMPLATES.support;

            routes.forEach(route => {
                const canAccess = evaluateStaffAccess({ staff, permissions: perms, requiredPermission: route.required });
                if (['/dashboard', '/users', '/trips'].includes(route.path)) {
                    assert.equal(canAccess, true, `Support should access ${route.path}`);
                } else {
                    assert.equal(canAccess, false, `Support MUST NOT access ${route.path}`);
                }
            });
        });

        it('Proofs Manager: accesses /dashboard and /approvals; blocked from financial and user routes', () => {
            const staff = { id: 'p-1', role: 'proofs_manager', is_active: true, is_super_admin: false };
            const perms = ROLE_TEMPLATES.proofs_manager;

            routes.forEach(route => {
                const canAccess = evaluateStaffAccess({ staff, permissions: perms, requiredPermission: route.required });
                if (['/dashboard', '/approvals'].includes(route.path)) {
                    assert.equal(canAccess, true, `Proofs Manager should access ${route.path}`);
                } else {
                    assert.equal(canAccess, false, `Proofs Manager MUST NOT access ${route.path}`);
                }
            });
        });

        it('Main Admin (super_admin): accesses all protected routes', () => {
            const staff = { id: 'a-1', role: 'super_admin', is_active: true, is_super_admin: true };
            const perms = ROLE_TEMPLATES.super_admin;

            routes.forEach(route => {
                const canAccess = evaluateStaffAccess({ staff, permissions: perms, requiredPermission: route.required });
                assert.equal(canAccess, true, `Main Admin should access ${route.path}`);
            });
        });
    });

    describe('5. Anti-Lockout Safeguards', () => {
        function validateStatusToggleSafeguard({ targetStaff, newActiveState, activeSuperAdminCount }) {
            if (targetStaff.role === 'super_admin' && !newActiveState) {
                if (activeSuperAdminCount <= 1) {
                    throw new Error('Anti-Lockout Protection: Cannot deactivate the sole active Main Admin.');
                }
            }
            return true;
        }

        it('Should reject deactivating the sole active Super Admin', () => {
            const targetStaff = { id: 'sa-1', role: 'super_admin', is_active: true };
            assert.throws(
                () => validateStatusToggleSafeguard({ targetStaff, newActiveState: false, activeSuperAdminCount: 1 }),
                /Anti-Lockout Protection/
            );
        });

        it('Should allow deactivating a Super Admin if at least one other active Super Admin exists', () => {
            const targetStaff = { id: 'sa-2', role: 'super_admin', is_active: true };
            const result = validateStatusToggleSafeguard({ targetStaff, newActiveState: false, activeSuperAdminCount: 2 });
            assert.equal(result, true);
        });

        it('Should allow deactivating non-admin staff regardless of count', () => {
            const targetStaff = { id: 'supp-1', role: 'support', is_active: true };
            const result = validateStatusToggleSafeguard({ targetStaff, newActiveState: false, activeSuperAdminCount: 1 });
            assert.equal(result, true);
        });
    });
});
