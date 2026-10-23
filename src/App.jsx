
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import AdminLogin from './components/AdminLogin';
import { supabase } from './supabaseClient';
import Dashboard from './components/Dashboard';
import DriverReview from './components/DriverReview';
import WithdrawalRequests from './components/WithdrawalRequests';
import AllUsers from './components/AllUsers';
import AllTrips from './components/AllTrips';
import LiveTracking from './components/LiveTracking';
import Settings from './components/Settings';
import Reports from './components/Reports';
import LogsPanel from './components/LogsPanel';
import AdminNotifications from './components/AdminNotifications';
import PendingDrivers from './components/PendingDrivers';
import PushNotifications from './components/PushNotifications';
import { StaffAuthProvider, useStaffAuth } from './context/StaffAuthContext';
import './App.css';

// ─────────────────────────────────────────────────────────────────────────────
// Error Boundary — Gracefully catch rendering errors
// ─────────────────────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                    <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md text-center border border-gray-100">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h1 className="text-2xl font-extrabold text-gray-900 mb-3">Something went wrong</h1>
                        <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                            An unexpected error occurred. Please try refreshing the page.
                        </p>
                        <pre className="text-xs text-red-500 bg-red-50 p-3 rounded-xl mb-6 text-left overflow-auto max-h-32 border border-red-100">
                            {this.state.error?.message || 'Unknown error'}
                        </pre>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-xl transition-colors"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Access Denied Component (Clean fallback without redirect loops)
// ─────────────────────────────────────────────────────────────────────────────
const AccessDenied = ({ requiredPermission, userRole, permissions = [] }) => {
    const navigate = useNavigate();
    const { logout } = useStaffAuth();

    // Determine an authorized fallback route based on granted permissions
    const fallbackPath = React.useMemo(() => {
        if (permissions.includes('dashboard.view')) return '/dashboard';
        if (permissions.includes('driver_approvals.view')) return '/approvals';
        if (permissions.includes('users.view')) return '/users';
        if (permissions.includes('trips.view')) return '/trips';
        if (permissions.includes('notifications.view')) return '/push-notifications';
        if (permissions.includes('financials.view')) return '/withdrawals';
        return null;
    }, [permissions]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-6">
            <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-gray-100">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
                    <span className="text-3xl">🛡️</span>
                </div>
                <h2 className="text-xl font-extrabold text-gray-900 mb-2">Access Restricted</h2>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                    Your account role (<span className="font-semibold text-gray-800 capitalize">{userRole || 'staff'}</span>) does not have permission to view this section.
                </p>
                <div className="bg-gray-50 rounded-xl p-3 mb-6 text-xs text-gray-500 font-mono">
                    Required: <span className="text-amber-600 font-semibold">{requiredPermission}</span>
                </div>
                <div className="space-y-2.5">
                    {fallbackPath ? (
                        <button
                            onClick={() => navigate(fallbackPath)}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-amber-500/20 text-sm"
                        >
                            Go to Your Permitted Section
                        </button>
                    ) : null}
                    <button
                        onClick={logout}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl transition-colors text-sm"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Private Route — Server-verified permission guard
// ─────────────────────────────────────────────────────────────────────────────
const PrivateRoute = ({ children, requiredPermission = null, allowedRoles = [] }) => {
    const { loading, isAuthenticated, staff, permissions, hasPermission } = useStaffAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    // Role check if specified
    if (allowedRoles.length > 0 && !allowedRoles.includes(staff?.role) && !staff?.is_super_admin) {
        return (
            <AccessDenied
                requiredPermission={`Role ${allowedRoles.join(' or ')}`}
                userRole={staff?.role}
                permissions={permissions}
            />
        );
    }

    // Granular permission check
    if (requiredPermission && !hasPermission(requiredPermission)) {
        return (
            <AccessDenied
                requiredPermission={requiredPermission}
                userRole={staff?.role}
                permissions={permissions}
            />
        );
    }

    return children;
};

// ─────────────────────────────────────────────────────────────────────────────
// 404 Page
// ─────────────────────────────────────────────────────────────────────────────
const NotFound = () => {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-white p-6">
            <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md text-center border border-amber-100/50">
                <div className="text-7xl font-black text-amber-500 mb-4">404</div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-3">Page Not Found</h1>
                <p className="text-gray-500 mb-8 text-sm">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-amber-500/20"
                >
                    Return to Dashboard
                </button>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// App Component
// ─────────────────────────────────────────────────────────────────────────────
function App() {
    return (
        <ErrorBoundary>
            <StaffAuthProvider>
                <Router>
                    <Toaster
                        position="top-right"
                        reverseOrder={false}
                        toastOptions={{
                            duration: 4000,
                            style: {
                                borderRadius: '14px',
                                background: '#1a1a1a',
                                color: '#fff',
                                fontSize: '13px',
                                fontWeight: '600',
                                padding: '12px 18px',
                                boxShadow: '0 15px 30px rgba(0,0,0,0.15)',
                            },
                            success: {
                                iconTheme: { primary: '#10b981', secondary: '#fff' },
                            },
                            error: {
                                iconTheme: { primary: '#ef4444', secondary: '#fff' },
                            },
                        }}
                    />
                    <AdminNotifications />
                    <Routes>
                        <Route path="/" element={<AdminLogin />} />
                        <Route path="/dashboard" element={<PrivateRoute requiredPermission="dashboard.view"><Dashboard /></PrivateRoute>} />
                        <Route path="/users" element={<PrivateRoute requiredPermission="users.view"><AllUsers /></PrivateRoute>} />
                        <Route path="/trips" element={<PrivateRoute requiredPermission="trips.view"><AllTrips /></PrivateRoute>} />
                        <Route path="/approvals" element={<PrivateRoute requiredPermission="driver_approvals.view"><PendingDrivers /></PrivateRoute>} />
                        <Route path="/driver/:id" element={<PrivateRoute requiredPermission="driver_approvals.view"><DriverReview /></PrivateRoute>} />
                        <Route path="/withdrawals" element={<PrivateRoute requiredPermission="financials.view"><WithdrawalRequests /></PrivateRoute>} />
                        <Route path="/live-tracking" element={<PrivateRoute requiredPermission="trips.view"><LiveTracking /></PrivateRoute>} />
                        <Route path="/push-notifications" element={<PrivateRoute requiredPermission="notifications.view"><PushNotifications /></PrivateRoute>} />
                        <Route path="/settings" element={<PrivateRoute requiredPermission="settings.view"><Settings /></PrivateRoute>} />
                        <Route path="/reports" element={<PrivateRoute requiredPermission="reports.view"><Reports /></PrivateRoute>} />
                        <Route path="/logs" element={<PrivateRoute requiredPermission="logs.view"><LogsPanel /></PrivateRoute>} />
                        {/* Catch-all 404 */}
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Router>
            </StaffAuthProvider>
        </ErrorBoundary>
    );
}

export default App;

