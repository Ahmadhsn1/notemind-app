import { Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import GraphView from './pages/GraphView';
import Account from './pages/Account';
import Admin from './pages/Admin';
import AdminLogin from './pages/AdminLogin';
import { useAuth } from './context/AuthContext';

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
        element={user ? <GraphView /> : <Navigate to="/login" />}
      />
      <Route
        path="/account"
        element={user ? <Account /> : <Navigate to="/login" />}
      />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={user?.role === 'admin' ? <Admin /> : <Navigate to={user ? '/dashboard' : '/admin/login'} />}
      />
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} />} />
    </Routes>
  );
}

export default App;
