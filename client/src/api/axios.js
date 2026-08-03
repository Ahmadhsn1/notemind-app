import axios from 'axios';
import { clearApiCache } from '../utils/apiCache';
import { getStoredToken, setStoredToken, clearAuthStorage } from '../utils/authStorage';

// The localhost fallback is a development convenience only. A production
// build can never reach it: vite.config.js fails the build outright when
// VITE_API_URL is unset, because import.meta.env.* is inlined at build time
// and a missing value would otherwise be baked into the shipped bundle.
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

// Signed image URLs.
//
// /uploads can't require an Authorization header (an <img> tag can't send
// one), so the server authorises image access by signature instead: ask
// POST /notes/sign-images — which is protected and refuses to sign a file you
// don't own — and it returns a URL carrying an HMAC and an expiry.
//
// Cached because a note can reference the same image repeatedly and several
// components resolve the same note's images independently. Entries are
// dropped shortly before the signature actually expires so a long-open tab
// re-signs rather than starting to 403.
const signedUrlCache = new Map();
const SIGNATURE_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export const clearSignedUrlCache = () => signedUrlCache.clear();

const filenameFromSrc = (src) => (src?.startsWith('/uploads/') ? src.slice('/uploads/'.length) : null);

const cachedUrl = (filename) => {
  const entry = signedUrlCache.get(filename);
  if (!entry) return null;
  if (entry.expiresAt - SIGNATURE_REFRESH_MARGIN_MS < Date.now()) {
    signedUrlCache.delete(filename);
    return null;
  }
  return entry.url;
};

/**
 * Resolves relative /uploads/... paths to absolute, signed, loadable URLs.
 * Returns a Map keyed by the original src. Anything not an upload path is
 * passed through untouched.
 */
export const signUploadUrls = async (srcs) => {
  const resolved = new Map();
  const needed = new Set();

  for (const src of srcs) {
    const filename = filenameFromSrc(src);
    if (!filename) {
      resolved.set(src, src);
      continue;
    }
    const hit = cachedUrl(filename);
    if (hit) resolved.set(src, `${API_ORIGIN}${hit}`);
    else needed.add(filename);
  }

  if (needed.size > 0) {
    try {
      const res = await api.post('/notes/sign-images', {filenames: [...needed]});
      const expiresAt = Date.now() + (res.data.expiresIn || 3600) * 1000;
      for (const [filename, url] of Object.entries(res.data.signed || {})) {
        signedUrlCache.set(filename, {url, expiresAt});
        resolved.set(`/uploads/${filename}`, `${API_ORIGIN}${url}`);
      }
    } catch {
      // Signing failed (offline, session expired) — leave those entries
      // unresolved rather than substituting an unsigned URL that would only
      // 403. Callers keep the original src, so the image simply doesn't load.
    }
  }

  return resolved;
};

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
