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

  function connect() {
    if (!wsUrl) {
      status = 'closed';
      emit('status', { status, message: 'WS URL not configured; running in offline mode.' });
      return;
    }

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    status = 'connecting';
    emit('status', { status });

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        status = 'open';
        emit('status', { status });
      };

      socket.onmessage = (evt) => {
        // Backend contract not specified: attempt JSON; otherwise pass text.
        try {
          const parsed = JSON.parse(evt.data);
          emit('message', parsed);
        } catch (_e) {
          emit('message', { type: 'text', data: evt.data });
        }
      };

      socket.onerror = () => {
        status = 'error';
        emit('status', { status, message: 'WebSocket error' });
      };

      socket.onclose = () => {
        status = 'closed';
        emit('status', { status });
      };
    } catch (e) {
      status = 'error';
      emit('status', { status, message: String(e) });
    }
  }

  function send(payload) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
    return true;
  }

  function close() {
    try {
      socket?.close();
    } catch (_e) {
      // ignore
    } finally {
      socket = null;
      status = 'closed';
      emit('status', { status });
    }
  }

  return {
    on,
    connect,
    send,
    close,
    getStatus: () => status
  };
}
