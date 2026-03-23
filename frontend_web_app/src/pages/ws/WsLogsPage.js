import React, { useEffect, useMemo, useState } from 'react';
import PageShell from '../../components/PageShell';
import { useApp } from '../../state/AppContext';

function formatLogLine(entry) {
  const ts = entry?.ts || '';
  const level = (entry?.level || 'info').toUpperCase().padEnd(5, ' ');
  const type = (entry?.type || 'log').padEnd(8, ' ');
  const data = entry?.data != null ? JSON.stringify(entry.data) : '';
  return `${ts}  ${level}  ${type}  ${data}`;
}

// PUBLIC_INTERFACE
export default function WsLogsPage() {
  /** Displays recent WebSocket status/messages/errors from the WS client's in-memory log buffer. */
  const { ws } = useApp();

  const [logs, setLogs] = useState(() => (typeof ws.getLogs === 'function' ? ws.getLogs() : []));
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    // Subscribe to incoming logs.
    const off = ws.on('log', () => {
      if (typeof ws.getLogs === 'function') setLogs(ws.getLogs());
    });
    return () => off?.();
  }, [ws]);

  const text = useMemo(() => logs.map(formatLogLine).join('\n'), [logs]);

  useEffect(() => {
    if (!autoScroll) return;
    const el = document.getElementById('ws-log-pre');
    if (el) el.scrollTop = el.scrollHeight;
  }, [text, autoScroll]);

  return (
    <PageShell
      title="WS Errors / Logs"
      subtitle="Local in-memory log of WebSocket events (status, messages, errors)."
      actions={
        <div className="row">
          <label className="pill" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Auto-scroll
          </label>

          <button
            className="btn"
            onClick={() => {
              ws.clearLogs?.();
              if (typeof ws.getLogs === 'function') setLogs(ws.getLogs());
            }}
          >
            Clear logs
          </button>

          <button
            className="btn btnPrimary"
            onClick={() => {
              ws.connect();
            }}
          >
            Connect
          </button>
        </div>
      }
    >
      <pre
        id="ws-log-pre"
        className="mono"
        style={{
          margin: 0,
          whiteSpace: 'pre',
          maxHeight: 420,
          overflow: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 12,
          background: 'rgba(17, 24, 39, 0.02)'
        }}
        aria-label="WS logs"
      >
        {text || '—'}
      </pre>
    </PageShell>
  );
}
