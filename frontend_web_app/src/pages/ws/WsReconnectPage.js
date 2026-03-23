import React, { useEffect, useState } from 'react';
import PageShell from '../../components/PageShell';
import { useApp } from '../../state/AppContext';

// PUBLIC_INTERFACE
export default function WsReconnectPage() {
  /** Provides explicit connect/disconnect controls for the WebSocket client. */
  const { ws } = useApp();
  const [status, setStatus] = useState(ws.getStatus());
  const [lastAction, setLastAction] = useState(null);

  useEffect(() => {
    const off = ws.on('status', (evt) => setStatus(evt?.status || ws.getStatus()));
    return () => off?.();
  }, [ws]);

  return (
    <PageShell
      title="Reconnect WS"
      subtitle="Manually disconnect and reconnect the WebSocket."
      actions={
        <div className="row">
          <button
            className="btn"
            onClick={() => {
              ws.close();
              setLastAction({ action: 'close', at: new Date().toISOString() });
            }}
          >
            Disconnect
          </button>
          <button
            className="btn btnPrimary"
            onClick={() => {
              ws.connect();
              setLastAction({ action: 'connect', at: new Date().toISOString() });
            }}
          >
            Reconnect
          </button>
        </div>
      }
    >
      <div className="kv">
        <div className="kvKey">Current status</div>
        <div className="kvVal">
          <span className="pill">Status: {status}</span>
        </div>

        <div className="kvKey">Last action</div>
        <div className="kvVal">
          <pre className="mono" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {lastAction ? JSON.stringify(lastAction, null, 2) : '—'}
          </pre>
        </div>
      </div>
    </PageShell>
  );
}
