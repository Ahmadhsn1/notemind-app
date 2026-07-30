import axios from 'axios';
import { clearApiCache } from '../utils/apiCache';
import { getStoredToken, setStoredToken, clearAuthStorage } from '../utils/authStorage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// The client (Vite dev server) and API are different origins (see
// VITE_API_URL) — anything that isn't a plain axios call (Socket.IO's
// connection URL, an <img> src resolved from a relative /uploads/... path)
// needs the bare origin, not the /api-suffixed base used for REST calls.
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

// contentHtml always stores the relative /uploads/... path (keeps notes
// portable across environments) — resolution to an absolute, loadable URL
// happens only here, at the point of use (editor render, saved-note view).
export const resolveUploadUrl = (src) => (src?.startsWith('/uploads/') ? `${API_ORIGIN}${src}` : src);

// Thin aliases over utils/authStorage's sessionStorage-backed token — kept
// here too since every non-axios call site (raw fetch, Socket.IO) that needs
// the current token already imports it from this module.
export const getAuthToken = getStoredToken;
export const setAuthToken = setStoredToken;

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 here only ever means the JWT itself is missing/invalid/expired (the
// `protect` middleware is the only thing that returns 401 — login/register
// failures return 400), so it's always safe to treat as "session over."
// Full reload (not react-router navigate) so AuthContext re-reads the now-
// cleared session storage on mount instead of holding a stale `user` in
// state.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthStorage();
      clearApiCache();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
