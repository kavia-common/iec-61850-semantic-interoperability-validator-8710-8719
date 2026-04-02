/**
 * Navigation configuration:
 * - Top-level "contexts" (tabs)
 * - Per-context left-side module menu items
 *
 * IMPORTANT: Per requirements, NO module is global across all tabs.
 */

export const TOP_TABS = [
  { key: 'home', label: 'Home', basePath: '/' },
  { key: 'backend', label: 'Backend Configuration', basePath: '/backend' },
  { key: 'health', label: 'Health', basePath: '/health' },
  { key: 'ai', label: 'AI Analytics', basePath: '/ai' },
  { key: 'ws', label: 'WS', basePath: '/ws' }
];

export const CONTEXT_MODULES = {
  // Global context: intentionally no sidebar modules (per requirements: no global modules shown).
  home: [],
  backend: [
    { to: '/backend/upload', title: 'File Upload', subtitle: 'Ingest SCL files', icon: 'U' },
    { to: '/backend/ln-tree', title: 'LN Tree', subtitle: 'Browse Logical Nodes', icon: 'L' },
    { to: '/backend/datasets', title: 'Dataset Viewer', subtitle: 'GOOSE/SV datasets', icon: 'D' },
    { to: '/backend/results', title: 'Results', subtitle: 'Backend run history', icon: '✓' },
    { to: '/backend/settings', title: 'Settings', subtitle: 'Environment & flags', icon: '⚙' }
  ],
  health: [
    { to: '/health/anomaly', title: 'Anomaly Detection', subtitle: 'Excel outliers', icon: 'A' },
    { to: '/health/recommendations', title: 'Recommendations', subtitle: 'Actionable fixes', icon: '★' },
    { to: '/health/report', title: 'Validation Report', subtitle: 'Issues & recommendations', icon: 'R' },
    { to: '/health/interop-map', title: 'Interoperability Map', subtitle: 'Cross-vendor mapping', icon: 'M' },
    { to: '/health/scada', title: 'SCADA Table', subtitle: 'Points & names', icon: 'S' },
    { to: '/health/results', title: 'Results', subtitle: 'Health run history', icon: '✓' }
  ],
  ai: [{ to: '/ai/analytics', title: 'AI Analytics', subtitle: 'Jobs & results', icon: 'AI' }],
  ws: [
    { to: '/ws/status', title: 'WS Connection Status', subtitle: 'Live connection state', icon: '⇄' },
    { to: '/ws/reconnect', title: 'Reconnect WS', subtitle: 'Reconnect/disconnect control', icon: '⟲' },
    { to: '/ws/logs', title: 'WS Errors / Logs', subtitle: 'Messages & events', icon: '≡' }
  ]
};

/**
 * Infers the active top tab ("context") from the current location pathname.
 * Defaults to 'backend' if unknown.
 */
// PUBLIC_INTERFACE
export function getContextFromPathname(pathname) {
  /** Determine active top tab based on route prefix. */
  const p = pathname || '';

  // Global Home
  if (p === '/' || p === '') return 'home';

  if (p.startsWith('/health')) return 'health';
  if (p.startsWith('/ai')) return 'ai';
  if (p.startsWith('/ws')) return 'ws';
  if (p.startsWith('/backend')) return 'backend';

  // Backward compat: old routes (from earlier UI) map into backend/health as reasonable defaults.
  if (p.startsWith('/upload') || p.startsWith('/ln-tree') || p.startsWith('/datasets') || p.startsWith('/settings')) {
    return 'backend';
  }
  if (
    p.startsWith('/anomaly') ||
    p.startsWith('/recommendations') ||
    p.startsWith('/report') ||
    p.startsWith('/interop-map') ||
    p.startsWith('/scada')
  ) {
    return 'health';
  }

  return 'backend';
}

/**
 * Returns the first module route for the given context, used for default redirects.
 */
// PUBLIC_INTERFACE
export function getDefaultModulePathForContext(contextKey) {
  /** Get default module route for a context. */
  if (contextKey === 'home') return '/';
  const list = CONTEXT_MODULES[contextKey] || [];
  return list[0]?.to || '/backend/upload';
}
