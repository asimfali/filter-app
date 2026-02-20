import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, tokenStorage } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // пока проверяем токен

  // При монтировании — пробуем восстановить сессию
  useEffect(() => {
    const restore = async () => {
      if (!tokenStorage.getAccess()) { setLoading(false); return; }
      const { ok, data } = await authApi.profile();
      if (ok) setUser(data);
      else tokenStorage.clear();
      setLoading(false);
    };
    restore();
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await authApi.login(email, password);
    if (result.ok && result.data.access) {
      tokenStorage.set(result.data.access, result.data.refresh);
      const { data } = await authApi.profile();
      setUser(data);
    }
    return result;
  }, []);

  const login2fa = useCallback(async (email, code) => {
    const result = await authApi.login2fa(email, code);
    if (result.ok && result.data.access) {
      tokenStorage.set(result.data.access, result.data.refresh);
      const { data } = await authApi.profile();
      setUser(data);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout(tokenStorage.getRefresh());
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, login2fa, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);