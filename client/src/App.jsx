import { Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { useAuth } from './context/AuthContext';

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={user ? <Dashboard /> : <Navigate to="/login" />}
      />
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} />} />
    </Routes>
  );
}

export default App;
