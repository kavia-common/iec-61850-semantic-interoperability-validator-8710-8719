import React, { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { listRunHistory } from '../state/runHistory';

function formatPct(v) {
  if (!Number.isFinite(v)) return '—';
  return `${Math.round(v)}%`;
}

function kpiCard({ label, value, hint }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="subtle" style={{ fontSize: 12 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{value}</div>
      {hint ? (
        <div className="subtle" style={{ marginTop: 6 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function hasAnyAnomalyFlag(record) {
  // Different modules may write different summary shapes; we treat any of these as an anomaly signal.
  const s = record?.summary;
  if (!s || typeof s !== 'object') return false;

  if (s.anomaliesFlagged === true) return true;
  if (Number.isFinite(s.anomalies) && s.anomalies > 0) return true;
  if (Number.isFinite(s.flagged) && s.flagged > 0) return true;
  if (Number.isFinite(s.outliers) && s.outliers > 0) return true;

  return false;
}

// PUBLIC_INTERFACE
export default function HomePage() {
  /** Global Home dashboard: high-level KPIs derived from persisted run history + shortcuts into key modules. */
  const runs = useMemo(() => listRunHistory({ limit: 1000 }), []);

  const kpis = useMemo(() => {
    const totalRuns = runs.length;

    const successes = runs.filter((r) => r?.status === 'success').length;
    const successRate = totalRuns > 0 ? (successes / totalRuns) * 100 : NaN;

    const anomaliesFlagged = runs.filter((r) => hasAnyAnomalyFlag(r)).length;

    const latest = runs[0] || null;

    return {
      totalRuns,
      successRate,
      anomaliesFlagged,
      latest
    };
  }, [runs]);

  return (
    <PageShell
      title="Home"
      subtitle="Global dashboard across upload and run history."
      actions={
        <div className="row">
          <NavLink className="btn btnPrimary" to="/backend/upload">
            New validation run
          </NavLink>
          <NavLink className="btn" to="/health/anomaly">
            Run anomaly detection
          </NavLink>
        </div>
      }
    >
      <div
        className="row"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 12,
          alignItems: 'stretch'
        }}
      >
        {kpiCard({
          label: 'Total runs',
          value: String(kpis.totalRuns),
          hint: 'From local run history'
        })}
        {kpiCard({
          label: 'Success rate',
          value: formatPct(kpis.successRate),
          hint: kpis.totalRuns ? `${runs.filter((r) => r?.status === 'success').length} successes` : 'No runs yet'
        })}
        {kpiCard({
          label: 'Anomalies flagged',
          value: String(kpis.anomaliesFlagged),
          hint: 'Runs whose summary indicates anomalies/outliers'
        })}
      </div>

      <div style={{ height: 14 }} />
      <hr />
      <div style={{ height: 14 }} />

      <div className="kv">
        <div className="kvKey">Quick links</div>
        <div className="kvVal">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <NavLink className="btn btnGhost" to="/backend/results">
              Backend Results
            </NavLink>
            <NavLink className="btn btnGhost" to="/health/results">
              Health Results
            </NavLink>
            <NavLink className="btn btnGhost" to="/backend/ln-tree">
              LN Tree
            </NavLink>
            <NavLink className="btn btnGhost" to="/backend/datasets">
              Dataset Viewer
            </NavLink>
            <NavLink className="btn btnGhost" to="/backend/settings">
              Settings
            </NavLink>
          </div>
        </div>

        <div className="kvKey">Latest run</div>
        <div className="kvVal">
          {kpis.latest ? (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <span className="pill">{kpis.latest.type}</span>
              <span className="pill">{kpis.latest.status}</span>
              {kpis.latest.fileName ? <span className="pill">{kpis.latest.fileName}</span> : null}
              {kpis.latest.startedAt ? <span className="pill">Started: {kpis.latest.startedAt}</span> : null}
            </div>
          ) : (
            <span className="subtle">No runs recorded yet. Start with File Upload → Validate, or Health → Anomaly Detection.</span>
          )}
        </div>
      </div>
    </PageShell>
  );
}
