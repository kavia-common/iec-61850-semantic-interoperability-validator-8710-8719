import React, { useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { clearRunHistory, exportRunHistoryCsv, exportRunHistoryJson, listRunHistory } from '../state/runHistory';

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v.toFixed(v >= 10 || u === 0 ? 0 : 1)} ${units[u]}`;
}

function typeLabel(t) {
  if (t === 'scl_validation') return 'SCL Validation';
  if (t === 'excel_anomaly') return 'Excel Anomaly';
  return t || '—';
}

function statusStyle(status) {
  if (status === 'success') return { borderColor: 'rgba(34, 197, 94, 0.35)', color: '#065f46' };
  if (status === 'failed') return { borderColor: 'rgba(239, 68, 68, 0.35)', color: '#991b1b' };
  return {};
}

function formatPct(p) {
  if (!Number.isFinite(p)) return '—';
  return `${(p * 100).toFixed(p >= 0.1 ? 0 : 1)}%`;
}

// PUBLIC_INTERFACE
export default function BackendResultsPage() {
  /** Backend Results page: persisted history of backend/SCL validation runs with export as CSV/JSON. */
  const [refreshTick, setRefreshTick] = useState(0);

  const allHistory = useMemo(() => listRunHistory({ limit: 1000 }), [refreshTick]);
  const rows = useMemo(() => allHistory.filter((r) => r.type === 'scl_validation').slice(0, 200), [allHistory]);

  const aggregates = useMemo(() => {
    const total = rows.length;
    const success = rows.filter((r) => r.status === 'success').length;
    const failed = rows.filter((r) => r.status === 'failed').length;
    const successRate = total ? success / total : NaN;
    const mockedCount = rows.filter((r) => r.mocked).length;
    return { total, success, failed, successRate, mockedCount };
  }, [rows]);

  const exportJsonHref = useMemo(() => {
    // Export remains global because runHistory export helpers are global; users can still export and filter externally.
    const json = exportRunHistoryJson();
    return `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
  }, [refreshTick]);

  const exportCsvHref = useMemo(() => {
    const csv = exportRunHistoryCsv();
    return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  }, [refreshTick]);

  return (
    <PageShell
      title="Results"
      subtitle="Backend Configuration results: persisted SCL validation run history from this browser."
      actions={
        <>
          <a className="btn" href={exportCsvHref} download="siv-results-summary.csv">
            Export CSV
          </a>
          <a className="btn" href={exportJsonHref} download="siv-results-summary.json">
            Export JSON
          </a>
          <button
            className="btn"
            onClick={() => {
              clearRunHistory();
              setRefreshTick((x) => x + 1);
            }}
            disabled={!allHistory.length}
            title="Clear persisted history from this browser"
          >
            Clear history
          </button>
        </>
      }
    >
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(245, 158, 11, 0.06))',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div className="cardBody">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div className="h1" style={{ fontSize: 14 }}>
                Backend run summary
              </div>
              <div className="subtle" style={{ marginTop: 4 }}>
                Aggregates computed from your browser’s persisted run history (SCL Validation only).
              </div>
            </div>
            <div className="subtle" style={{ textAlign: 'right' }}>
              {aggregates.mockedCount
                ? `${aggregates.mockedCount}/${aggregates.total} run(s) used offline/mock fallback.`
                : 'All runs used live processing.'}
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))',
              gap: 10
            }}
          >
            <div className="card" style={{ boxShadow: 'var(--shadow-sm)', background: 'rgba(255,255,255,0.86)' }}>
              <div className="cardBody">
                <div className="subtle">SCL runs</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                  {aggregates.total}
                </div>
              </div>
            </div>

            <div className="card" style={{ boxShadow: 'var(--shadow-sm)', background: 'rgba(255,255,255,0.86)' }}>
              <div className="cardBody">
                <div className="subtle">Success rate</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                  {formatPct(aggregates.successRate)}
                </div>
                <div className="subtle" style={{ marginTop: 6 }}>
                  {aggregates.success} success • {aggregates.failed} failed
                </div>
              </div>
            </div>

            <div className="card" style={{ boxShadow: 'var(--shadow-sm)', background: 'rgba(255,255,255,0.86)' }}>
              <div className="cardBody">
                <div className="subtle">Run type</div>
                <div style={{ marginTop: 6 }}>
                  <span className="pill">SCL Validation</span>
                </div>
              </div>
            </div>
          </div>

          <div className="subtle" style={{ marginTop: 10 }}>
            Tip: this view includes only Backend Configuration (SCL validation) runs.
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="row">
        <span className="pill">SCL runs: {aggregates.total}</span>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => setRefreshTick((x) => x + 1)} title="Refresh from localStorage">
          Refresh
        </button>
      </div>

      <div style={{ height: 12 }} />

      {rows.length ? (
        <table className="table" aria-label="Backend (SCL validation) run history table">
          <thead>
            <tr>
              <th>When</th>
              <th>Type</th>
              <th>Status</th>
              <th>File</th>
              <th>Summary</th>
              <th>Mock</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono" style={{ fontSize: 12 }}>
                  <div>{formatDateTime(r.completedAt || r.startedAt)}</div>
                  <div className="subtle">Started: {formatDateTime(r.startedAt)}</div>
                </td>
                <td>
                  <span className="pill">{typeLabel(r.type)}</span>
                </td>
                <td>
                  <span className="pill" style={statusStyle(r.status)}>
                    {(r.status || '—').toUpperCase()}
                  </span>
                </td>
                <td>
                  {r.fileName ? (
                    <div>
                      <div style={{ fontSize: 13 }}>
                        <strong>{r.fileName}</strong>
                      </div>
                      <div className="subtle">{formatBytes(r.fileSize)}</div>
                    </div>
                  ) : (
                    <span className="subtle">—</span>
                  )}
                </td>
                <td>
                  {r.summary ? (
                    <pre className="mono" style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                      {JSON.stringify(r.summary, null, 2)}
                    </pre>
                  ) : (
                    <span className="subtle">—</span>
                  )}
                </td>
                <td>{r.mocked ? <span className="pill">Yes</span> : <span className="subtle">No</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="subtle">
          No backend runs recorded yet. Run “Validate” in File Upload to populate history.
        </div>
      )}

      <div style={{ height: 14 }} />
      <div className="subtle">
        Notes: History is stored in this browser via localStorage. Export files include only a compact per-run summary (not full raw
        payloads).
      </div>
    </PageShell>
  );
}
