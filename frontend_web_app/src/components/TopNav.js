import React, { useEffect, useMemo, useState } from 'react';
import { getEnvConfig } from '../config/env';
import { useApp } from '../state/AppContext';

// PUBLIC_INTERFACE
export default function TopNav() {
  /** Top navigation bar: brand + backend/WS status + primary actions. */
  const { api, ws } = useApp();
  const env = useMemo(() => getEnvConfig(), []);
  const [wsStatus, setWsStatus] = useState(ws.getStatus());
  const [health, setHealth] = useState(null);

  useEffect(() => {
    const unsub = ws.on('status', (s) => setWsStatus(s.status));
    ws.connect();
    return () => unsub();
  }, [ws]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api.getHealth();
      if (cancelled) return;
      setHealth(res);
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const backendLabel = api.hasBackend ? 'Backend configured' : 'Offline mode';
  const healthLabel =
    !health ? 'Health: …' : health.ok ? 'Health: OK' : `Health: Error (${health.status || 'n/a'})`;

  return (
    <div className="topNav" role="banner">
      <div className="brand" aria-label="Application brand">
        <div className="brandMark" aria-hidden="true">
          SIV
        </div>
        <div className="brandTitle">
          <strong>IEC 61850 SIV-Tool</strong>
          <span>Semantic Interoperability Validator</span>
        </div>
      </div>

      <span className="pill" title={api.hasBackend ? env.apiBase : 'No API base configured'}>
        {backendLabel}
      </span>
      <span className="pill" title={health?.mocked ? 'Mock response' : 'Live response (if configured)'}>
        {healthLabel}
      </span>
      <span className="pill" title={env.wsUrl || 'No WS URL configured'}>
        WS: {wsStatus}
      </span>

      <div className="topActions">
        <a className="btn btnGhost" href="https://iec.ch/" target="_blank" rel="noreferrer">
          IEC
        </a>
        <button
          className="btn btnPrimary"
          onClick={() => {
            ws.connect();
          }}
        >
          Reconnect WS
        </button>
      </div>
    </div>
  );
}
