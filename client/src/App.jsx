import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Account from './pages/Account';
import AdminLogin from './pages/AdminLogin';
import { useAuth } from './context/AuthContext';

// Admin (703 lines, d3-free but still one of the largest pages) and
// GraphView (pulls in d3-force) are never needed on first paint — most
// sessions never visit either — so they're split into their own chunks
// instead of bloating the single 1MB+ bundle every user downloads to reach
// the dashboard. Same page-level "Loading…" convention already used by
// ForgotPassword/ResetPassword's own loading states and Admin's own system
// panel, so the fallback doesn't look like a different app while the chunk
// downloads.
const GraphView = lazy(() => import('./pages/GraphView'));
const Admin = lazy(() => import('./pages/Admin'));

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center text-ink/40 text-[13px]">Loading…</div>
);

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      {/* Public by necessity — the user can't sign in, which is the point. */}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/dashboard"
        element={user ? <Dashboard /> : <Navigate to="/login" />}
      />
      <Route
        path="/graph"
        element={user ? (
          <Suspense fallback={<RouteFallback />}><GraphView /></Suspense>
        ) : <Navigate to="/login" />}
      />
      <Route
        path="/account"
        element={user ? <Account /> : <Navigate to="/login" />}
      />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={user?.role === 'admin' ? (
          <Suspense fallback={<RouteFallback />}><Admin /></Suspense>
        ) : <Navigate to={user ? '/dashboard' : '/admin/login'} />}
      />
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} />} />
    </Routes>
  );
}

export default App;
