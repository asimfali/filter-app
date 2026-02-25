import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, tokenStorage } from '../api/auth';
import { sessionsApi } from '../api/sessions';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]                   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [activeSession, setActiveSession] = useState(null);

  // Загружаем активную сессию после успешной авторизации
  const loadActiveSession = useCallback(async () => {
    try {
      const res = await sessionsApi.getCurrent();
      if (res.success && res.data) {
        setActiveSession(res.data);
      }
    } catch {
      // Сессии нет — не критично
    }
  }, []);

  useEffect(() => {
    const restore = async () => {
      if (!tokenStorage.getAccess()) { setLoading(false); return; }
      const { ok, data } = await authApi.profile();
      if (ok) {
        setUser(data);
        await loadActiveSession();
      } else {
        tokenStorage.clear();
      }
      setLoading(false);
    };
    restore();
  }, [loadActiveSession]);

  const login = useCallback(async (email, password) => {
    const result = await authApi.login(email, password);
    if (result.ok && result.data.access) {
      tokenStorage.set(result.data.access, result.data.refresh);
      const { data } = await authApi.profile();
      setUser(data);
      await loadActiveSession();
    }
    return result;
  }, [loadActiveSession]);

  const login2fa = useCallback(async (email, code) => {
    const result = await authApi.login2fa(email, code);
    if (result.ok && result.data.access) {
      tokenStorage.set(result.data.access, result.data.refresh);
      const { data } = await authApi.profile();
      setUser(data);
      await loadActiveSession();
    }
    return result;
  }, [loadActiveSession]);

  const logout = useCallback(async () => {
    await authApi.logout(tokenStorage.getRefresh());
    tokenStorage.clear();
    setUser(null);
    setActiveSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, login, login2fa, logout,
      activeSession, setActiveSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);