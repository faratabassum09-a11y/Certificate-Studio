import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from '../api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = signed out
  const [status, setStatus] = useState({ hasUsers: true, allowSignup: false });

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (user === null) api.status().then(setStatus).catch(() => {});
  }, [user]);

  const login = async (email, password) => setUser(await api.login({ email, password }));
  const signup = async (data) => setUser(await api.signup(data));
  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, status, login, signup, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
