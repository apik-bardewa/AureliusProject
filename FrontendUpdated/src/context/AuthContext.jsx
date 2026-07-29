import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => window.localStorage.getItem('aurelius-token'));
  const [user, setUser] = useState(() => {
    const stored = window.localStorage.getItem('aurelius-user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  const persist = (nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    if (nextToken) window.localStorage.setItem('aurelius-token', nextToken);
    else window.localStorage.removeItem('aurelius-token');
    if (nextUser) window.localStorage.setItem('aurelius-user', JSON.stringify(nextUser));
    else window.localStorage.removeItem('aurelius-user');
  };

  // On first load, verify the stored token is still good and refresh profile state.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.me(token);
        if (!cancelled) persist(token, { userId: me.userId, name: me.name, email: me.email, hasProfile: me.hasProfile });
      } catch (_error) {
        if (!cancelled) persist(null, null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await api.login(email, password);
    persist(result.token, { userId: result.userId, name: result.name, email: result.email, hasProfile: result.hasProfile });
    return result;
  }, []);

  const signup = useCallback(async (name, email, password) => {
    const result = await api.signup(name, email, password);
    persist(result.token, { userId: result.userId, name: result.name, email: result.email, hasProfile: result.hasProfile });
    return result;
  }, []);

  const completeOnboarding = useCallback(
    async (articleIds, topics) => {
      await api.onboard(token, articleIds, topics);
      setUser((current) => {
        const next = { ...current, hasProfile: true };
        window.localStorage.setItem('aurelius-user', JSON.stringify(next));
        return next;
      });
    },
    [token],
  );

  const logout = useCallback(() => {
    persist(null, null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, loading, login, signup, logout, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
