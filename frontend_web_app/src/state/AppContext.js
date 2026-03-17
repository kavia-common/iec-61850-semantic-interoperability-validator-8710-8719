import React, { createContext, useContext, useMemo, useState } from 'react';
import { createApiClient } from '../services/apiClient';
import { createWsClient } from '../services/wsClient';

const AppContext = createContext(null);

// PUBLIC_INTERFACE
export function AppProvider({ children }) {
  /** Provides app-wide state and service clients (API + WebSocket). */
  const api = useMemo(() => createApiClient(), []);
  const ws = useMemo(() => createWsClient(), []);

  const [lastUpload, setLastUpload] = useState(null);
  const [validationResult, setValidationResult] = useState(null);

  const value = useMemo(
    () => ({
      api,
      ws,
      lastUpload,
      setLastUpload,
      validationResult,
      setValidationResult
    }),
    [api, ws, lastUpload, validationResult]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// PUBLIC_INTERFACE
export function useApp() {
  /** Hook to access app-wide state/services. */
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>.');
  return ctx;
}
