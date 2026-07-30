import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import { clearApiCache } from '../utils/apiCache';
import { getStoredUser, setStoredUser, setStoredToken, clearAuthStorage } from '../utils/authStorage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Hydrated from sessionStorage (not localStorage) — a session survives
  // reloads/refreshes within this same tab, but a brand new tab, window, or
  // browser launch always starts at null, so a shared computer can't just
  // inherit whoever last logged in by opening the app fresh.
  const [user, setUser] = useState(() => getStoredUser());

  // Refreshes server-assigned fields (role, hasPassword) into the current
  // user — once on mount if a session was already hydrated from
  // sessionStorage, and again after every fresh login in this tab (user id
  // changing). A role granted after this token was issued (see
  // server/scripts/set-admin.js) wouldn't otherwise show up until the next
  // explicit login. Best-effort: a failed refresh just leaves the user as-is
  // rather than logging anyone out.
  useEffect(() => {
    if (!user) return;
    api.get('/auth/me').then((res) => {
      setUser((prev) => {
        if (!prev) return prev;
        const next = {...prev, role: res.data.role, hasPassword: res.data.hasPassword};
        setStoredUser(next);
        return next;
      });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const login = (userData) => {
    setUser(userData);
    setStoredUser(userData);
    setStoredToken(userData.token);
  };

  // Merges profile fields (name/email) returned from PUT /auth/profile into
  // the current user without touching the token.
  const updateUser = (fields) => {
    setUser((prev) => {
      const next = {...prev, ...fields};
      setStoredUser(next);
      return next;
    });
  };

  const logout = () => {
    setUser(null);
    clearAuthStorage();
    clearApiCache();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- context + hook intentionally share this file
export const useAuth = () => useContext(AuthContext);
