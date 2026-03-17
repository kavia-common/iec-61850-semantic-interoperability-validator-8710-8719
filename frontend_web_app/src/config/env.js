/**
 * Central place to read the CRA-provided environment variables.
 * Keeps the rest of the app testable and avoids scattering process.env usage.
 */

// PUBLIC_INTERFACE
export function getEnvConfig() {
  /** Returns normalized runtime configuration derived from REACT_APP_* env vars. */
  const nodeEnv = process.env.REACT_APP_NODE_ENV || process.env.NODE_ENV || 'development';

  // Prefer explicit vars, but gracefully fall back so the UI works without backend wiring.
  const apiBase =
    process.env.REACT_APP_API_BASE ||
    process.env.REACT_APP_BACKEND_URL ||
    '';

  const wsUrl =
    process.env.REACT_APP_WS_URL ||
    (apiBase ? apiBase.replace(/^http/i, 'ws') : '');

  const frontendUrl =
    process.env.REACT_APP_FRONTEND_URL ||
    process.env.REACT_APP_FRONTEND_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  const featureFlagsRaw = process.env.REACT_APP_FEATURE_FLAGS || '';
  const experimentsEnabledRaw = process.env.REACT_APP_EXPERIMENTS_ENABLED || '';

  return {
    nodeEnv,
    apiBase,
    wsUrl,
    frontendUrl,
    logLevel: process.env.REACT_APP_LOG_LEVEL || 'info',
    healthcheckPath: process.env.REACT_APP_HEALTHCHECK_PATH || '/health',
    featureFlagsRaw,
    experimentsEnabledRaw
  };
}
