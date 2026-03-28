import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
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

const PrivateRoute = ({ children, allowedRoles = [] }) => {
  const isAuth = localStorage.getItem('adminAuth') === 'true';
  const role = localStorage.getItem('adminRole') || 'admin'; // fallback

  if (!isAuth) return <Navigate to="/" />;

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    // If authenticated but wrong role, go to dashboard or a not-authorized page
    return <Navigate to="/dashboard" />;
  }
  
  return children;
};

function App() {
  const [session, setSession] = React.useState(null);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_OUT') {
        localStorage.removeItem('adminAuth');
        window.location.href = '/';
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Router>
      <Toaster position="top-right" reverseOrder={false} />
      <AdminNotifications />
      <Routes>
        <Route path="/" element={<AdminLogin />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/users" element={<PrivateRoute allowedRoles={['super_admin', 'admin', 'support']}><AllUsers /></PrivateRoute>} />
        <Route path="/trips" element={<PrivateRoute allowedRoles={['super_admin', 'admin', 'support']}><AllTrips /></PrivateRoute>} />
        <Route path="/approvals" element={<PrivateRoute allowedRoles={['super_admin', 'admin']}><PendingDrivers /></PrivateRoute>} />
        <Route path="/driver/:id" element={<PrivateRoute allowedRoles={['super_admin', 'admin']}><DriverReview /></PrivateRoute>} />
        <Route path="/withdrawals" element={<PrivateRoute allowedRoles={['super_admin', 'admin']}><WithdrawalRequests /></PrivateRoute>} />
        <Route path="/live-tracking" element={<PrivateRoute allowedRoles={['super_admin', 'admin', 'support']}><LiveTracking /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute allowedRoles={['super_admin', 'admin']}><Settings /></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute allowedRoles={['super_admin', 'admin']}><Reports /></PrivateRoute>} />
        <Route path="/logs" element={<PrivateRoute allowedRoles={['super_admin', 'admin']}><LogsPanel /></PrivateRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
