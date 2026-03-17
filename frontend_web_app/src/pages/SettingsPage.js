import React, { useMemo } from 'react';
import PageShell from '../components/PageShell';
import { getEnvConfig } from '../config/env';
import { useApp } from '../state/AppContext';

// PUBLIC_INTERFACE
export default function SettingsPage() {
  /** Settings / diagnostics page to expose runtime env config to the user. */
  const env = useMemo(() => getEnvConfig(), []);
  const { api, ws } = useApp();

  return (
    <PageShell
      title="Settings"
      subtitle="Runtime configuration and diagnostics (read from REACT_APP_* env vars)."
    >
      <div className="kv">
        <div className="kvKey">Node environment</div>
        <div className="kvVal"><span className="pill">{env.nodeEnv}</span></div>

        <div className="kvKey">API base</div>
        <div className="kvVal">
          <div className="row">
            <span className="pill">{api.hasBackend ? 'Configured' : 'Not set'}</span>
            <span className="mono">{env.apiBase || '—'}</span>
          </div>
        </div>

        <div className="kvKey">WS URL</div>
        <div className="kvVal">
          <div className="row">
            <span className="pill">Status: {ws.getStatus()}</span>
            <span className="mono">{env.wsUrl || '—'}</span>
          </div>
        </div>

        <div className="kvKey">Frontend URL</div>
        <div className="kvVal"><span className="mono">{env.frontendUrl || '—'}</span></div>

        <div className="kvKey">Healthcheck path</div>
        <div className="kvVal"><span className="mono">{env.healthcheckPath}</span></div>

        <div className="kvKey">Feature flags (raw)</div>
        <div className="kvVal"><pre className="mono" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{env.featureFlagsRaw || '—'}</pre></div>

        <div className="kvKey">Experiments enabled (raw)</div>
        <div className="kvVal"><pre className="mono" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{env.experimentsEnabledRaw || '—'}</pre></div>
      </div>
    </PageShell>
  );
}
