import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from './Auth.jsx';

const TemplatesCtx = createContext(null);
export const useTemplates = () => useContext(TemplatesCtx);

// Single shared list so the sidebar, gallery and pages always agree.
export function TemplatesProvider({ children }) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState(null);
  const [error, setError] = useState('');

  const reload = useCallback(
    () => api.list().then((t) => { setTemplates(t); setError(''); }).catch((e) => setError(e.message)),
    []
  );

  useEffect(() => {
    if (user) reload();
    else setTemplates(null);
  }, [user, reload]);

  return (
    <TemplatesCtx.Provider value={{ templates, error, reload }}>
      {children}
    </TemplatesCtx.Provider>
  );
}
