import React, { useEffect, useMemo, useState } from 'react';
import PageShell from '../../components/PageShell';
import { useApp } from '../../state/AppContext';

/** Small helper to render a readable status label. */
function statusTone(status) {
  if (status === 'open') return { label: 'Connected', color: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.35)' };
  if (status === 'connecting') return { label: 'Connecting', color: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.35)' };
  if (status === 'error') return { label: 'Error', color: 'rgba(239, 68, 68, 0.14)', border: 'rgba(239, 68, 68, 0.35)' };
  if (status === 'closed') return { label: 'Closed', color: 'rgba(107, 114, 128, 0.12)', border: 'rgba(107, 114, 128, 0.30)' };
  return { label: status || 'Unknown', color: 'rgba(107, 114, 128, 0.12)', border: 'rgba(107, 114, 128, 0.30)' };
}

// PUBLIC_INTERFACE
export default function WsStatusPage() {
  /** Displays current WebSocket connection status derived from the app WS client. */
  const { ws } = useApp();
  const [status, setStatus] = useState(ws.getStatus());
  const [lastStatusEvent, setLastStatusEvent] = useState(null);

  useEffect(() => {
    // Ensure we attempt a connection when user opens WS context.
    ws.connect();
    const off = ws.on('status', (evt) => {
      setStatus(evt?.status || ws.getStatus());
      setLastStatusEvent(evt || null);
    });
    return () => off?.();
  }, [ws]);

  const tone = useMemo(() => statusTone(status), [status]);

  return (
    <PageShell
      title="WS Connection Status"
      subtitle="Live WebSocket connection state and last status event."
      actions={
        <button className="btn btnPrimary" onClick={() => ws.connect()}>
          Connect
        </button>
      }
    >
      <div className="kv">
        <div className="kvKey">Current status</div>
        <div className="kvVal">
          <span
            className="pill"
            style={{
              background: tone.color,
              borderColor: tone.border,
              color: 'var(--text)'
            }}
          >
            {tone.label}
          </span>
        </div>

        <div className="kvKey">Last status event</div>
        <div className="kvVal">
          <pre className="mono" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {lastStatusEvent ? JSON.stringify(lastStatusEvent, null, 2) : '—'}
          </pre>
        </div>
      </div>
    </PageShell>
  );
}
