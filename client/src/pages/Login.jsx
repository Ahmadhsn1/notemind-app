import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Watchers from '../components/Watchers';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [watcherMode, setWatcherMode] = useState('watch');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await api.post('/auth/login', { email, password });
      login(response.data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-layout">
        <Watchers mode={watcherMode} />
        <div className="auth-card">
          <div className="brand">NoteMind</div>
          <p className="tagline">Your thoughts, organized and alive</p>
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setWatcherMode('lookAtForm')}
              onBlur={() => setWatcherMode('watch')}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setWatcherMode('shy')}
              onBlur={() => setWatcherMode('watch')}
            />
            {error && <p className="error">{error}</p>}
            <button type="submit">Login</button>
          </form>
          <p className="switch-link">
            Don't have an account? <Link to="/register">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
