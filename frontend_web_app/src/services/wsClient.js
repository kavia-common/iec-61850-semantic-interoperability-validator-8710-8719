import { getEnvConfig } from '../config/env';

/**
 * WebSocket client scaffold:
 * - connects if wsUrl is available
 * - otherwise acts as a no-op client
 * - provides basic event subscription
 */

// PUBLIC_INTERFACE
export function createWsClient() {
  /** Creates a WS client instance configured via REACT_APP_WS_URL with graceful fallback. */
  const { wsUrl } = getEnvConfig();

  const listeners = new Map(); // eventName -> Set<fn>
  let socket = null;
  let status = 'idle'; // idle|connecting|open|closed|error

  // Lightweight in-memory log buffer (ring).
  const logBuffer = [];
  const LOG_LIMIT = 250;

  function pushLog(entry) {
    logBuffer.push(entry);
    while (logBuffer.length > LOG_LIMIT) logBuffer.shift();
    emit('log', entry);
  }

  function emit(eventName, payload) {
    const fns = listeners.get(eventName);
    if (!fns) return;
    for (const fn of fns) fn(payload);
  }

  function on(eventName, fn) {
    if (!listeners.has(eventName)) listeners.set(eventName, new Set());
    listeners.get(eventName).add(fn);
    return () => listeners.get(eventName)?.delete(fn);
  }

  function setStatus(nextStatus, extra) {
    status = nextStatus;
    const evt = { status, ...extra };
    emit('status', evt);
    pushLog({ ts: new Date().toISOString(), level: 'info', type: 'status', data: evt });
  }

  function connect() {
    if (!wsUrl) {
      setStatus('closed', { message: 'WS URL not configured; running in offline mode.' });
      return;
    }

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setStatus('connecting');

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setStatus('open');
      };

      socket.onmessage = (evt) => {
        // Backend contract not specified: attempt JSON; otherwise pass text.
        try {
          const parsed = JSON.parse(evt.data);
          emit('message', parsed);
          pushLog({ ts: new Date().toISOString(), level: 'info', type: 'message', data: parsed });
        } catch (_e) {
          const payload = { type: 'text', data: evt.data };
          emit('message', payload);
          pushLog({ ts: new Date().toISOString(), level: 'info', type: 'message', data: payload });
        }
      };

      socket.onerror = () => {
        setStatus('error', { message: 'WebSocket error' });
        pushLog({ ts: new Date().toISOString(), level: 'error', type: 'error', data: { message: 'WebSocket error' } });
      };

      socket.onclose = (e) => {
        setStatus('closed', { code: e?.code, reason: e?.reason });
      };
    } catch (e) {
      setStatus('error', { message: String(e) });
      pushLog({ ts: new Date().toISOString(), level: 'error', type: 'exception', data: { message: String(e) } });
    }
  }

  function send(payload) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      pushLog({ ts: new Date().toISOString(), level: 'warn', type: 'send', data: { ok: false, reason: 'socket-not-open' } });
      return false;
    }
    const wire = typeof payload === 'string' ? payload : JSON.stringify(payload);
    socket.send(wire);
    pushLog({ ts: new Date().toISOString(), level: 'info', type: 'send', data: { ok: true, bytes: wire.length } });
    return true;
  }

  function close() {
    try {
      socket?.close();
      pushLog({ ts: new Date().toISOString(), level: 'info', type: 'close', data: { requested: true } });
    } catch (_e) {
      // ignore
    } finally {
      socket = null;
      setStatus('closed');
    }
  }

  return {
    on,
    connect,
    send,
    close,
    getStatus: () => status,
    getLogs: () => [...logBuffer],
    clearLogs: () => {
      logBuffer.splice(0, logBuffer.length);
      pushLog({ ts: new Date().toISOString(), level: 'info', type: 'log', data: { message: 'Logs cleared' } });
    }
  };
}
