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

function asNumberMaybe(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function extractAnomaliesFlaggedCount(run) {
  // Best-effort extraction from persisted summary.
  // We keep this intentionally defensive because summary shape can evolve.
  const s = run?.summary;
  if (!s || typeof s !== 'object') return 0;

  const candidateKeys = [
    'anomalies',
    'anomalyCount',
    'anomaliesFlagged',
    'flagged',
    'flaggedCount',
    'anomalyRows',
    'outliers',
    'outlierCount'
  ];

  for (const k of candidateKeys) {
    const n = asNumberMaybe(s?.[k]);
    if (n !== null) return Math.max(0, n);
  }

  // If summary contains arrays, use their lengths for likely fields.
  const arrayKeys = ['anomalies', 'outliers', 'flagged', 'rowsFlagged', 'flaggedRows'];
  for (const k of arrayKeys) {
    if (Array.isArray(s?.[k])) return s[k].length;
  }

  return 0;
}

function formatPct(p) {
  if (!Number.isFinite(p)) return '—';
  return `${(p * 100).toFixed(p >= 0.1 ? 0 : 1)}%`;
}

function kpiDeltaText(mockedCount, totalCount) {
  if (!totalCount) return '—';
  if (!mockedCount) return 'All runs used live processing.';
  return `${mockedCount}/${totalCount} run(s) used offline/mock fallback.`;
}

// PUBLIC_INTERFACE
export default function ResultsPage() {
  /** Results page: persisted history of SCL + Excel runs with export as CSV/JSON. */
  const [typeFilter, setTypeFilter] = useState('all');
  const [refreshTick, setRefreshTick] = useState(0);

  const allHistory = useMemo(() => listRunHistory({ limit: 1000 }), [refreshTick]);

  const rows = useMemo(() => {
    if (typeFilter === 'all') return allHistory.slice(0, 200);
    return allHistory.filter((r) => r.type === typeFilter).slice(0, 200);
  }, [typeFilter, allHistory]);

  const counts = useMemo(() => {
    const scl = allHistory.filter((r) => r.type === 'scl_validation').length;
    const xl = allHistory.filter((r) => r.type === 'excel_anomaly').length;
    return { total: allHistory.length, scl, xl };
  }, [allHistory]);

  const aggregates = useMemo(() => {
    const total = allHistory.length;
    const success = allHistory.filter((r) => r.status === 'success').length;
    const failed = allHistory.filter((r) => r.status === 'failed').length;
    const successRate = total ? success / total : NaN;

    const mockedCount = allHistory.filter((r) => r.mocked).length;

    const anomaliesFlagged = allHistory
      .filter((r) => r.type === 'excel_anomaly')
      .reduce((acc, r) => acc + extractAnomaliesFlaggedCount(r), 0);

    const scl = {
      total: allHistory.filter((r) => r.type === 'scl_validation').length,
      success: allHistory.filter((r) => r.type === 'scl_validation' && r.status === 'success').length,
      failed: allHistory.filter((r) => r.type === 'scl_validation' && r.status === 'failed').length
    };

    const excel = {
      total: allHistory.filter((r) => r.type === 'excel_anomaly').length,
      success: allHistory.filter((r) => r.type === 'excel_anomaly' && r.status === 'success').length,
      failed: allHistory.filter((r) => r.type === 'excel_anomaly' && r.status === 'failed').length
    };

    return { total, success, failed, successRate, mockedCount, anomaliesFlagged, scl, excel };
  }, [allHistory]);

  const exportJsonHref = useMemo(() => {
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
      subtitle="Persisted history of data upload/analysis runs across modules (SCL validation + Excel anomaly detection)."
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
            disabled={!counts.total}
            title="Clear persisted history from this browser"
          >
            Clear history
          </button>
        </>
      }
    >
      {/* KPI Summary */}
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
                Run summary
              </div>
              <div className="subtle" style={{ marginTop: 4 }}>
                Aggregates computed from your browser’s persisted run history.
              </div>
            </div>
            <div className="subtle" style={{ textAlign: 'right' }}>
              {kpiDeltaText(aggregates.mockedCount, aggregates.total)}
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))',
              gap: 10
            }}
          >
            <div className="card" style={{ boxShadow: 'var(--shadow-sm)', background: 'rgba(255,255,255,0.86)' }}>
              <div className="cardBody">
                <div className="subtle">Total runs</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                  {aggregates.total}
                </div>
                <div className="subtle" style={{ marginTop: 6 }}>
                  SCL {aggregates.scl.total} • Excel {aggregates.excel.total}
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
                <div className="subtle">Anomalies flagged</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                  {aggregates.anomaliesFlagged}
                </div>
                <div className="subtle" style={{ marginTop: 6 }}>
                  Summed across Excel runs
                </div>
              </div>
            </div>

            <div className="card" style={{ boxShadow: 'var(--shadow-sm)', background: 'rgba(255,255,255,0.86)' }}>
              <div className="cardBody">
                <div className="subtle">Run type breakdown</div>
                <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="pill">SCL</span>
                    <span className="mono" style={{ fontSize: 12 }}>
                      {aggregates.scl.success}/{aggregates.scl.total} success
                    </span>
                  </div>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="pill">Excel</span>
                    <span className="mono" style={{ fontSize: 12 }}>
                      {aggregates.excel.success}/{aggregates.excel.total} success
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="subtle" style={{ marginTop: 10 }}>
            Tip: use the filter below to focus on SCL Validation or Excel Anomaly runs.
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="row">
        <span className="pill">Total runs: {counts.total}</span>
        <span className="pill">SCL: {counts.scl}</span>
        <span className="pill">Excel: {counts.xl}</span>

        <span style={{ flex: 1 }} />

        <label className="subtle">
          Filter:&nbsp;
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="scl_validation">SCL Validation</option>
            <option value="excel_anomaly">Excel Anomaly</option>
          </select>
        </label>

        <button className="btn" onClick={() => setRefreshTick((x) => x + 1)} title="Refresh from localStorage">
          Refresh
        </button>
      </div>

      <div style={{ height: 12 }} />

      {rows.length ? (
        <table className="table" aria-label="Upload and analysis run history table">
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
          No runs recorded yet. Run “Validate” in File Upload or “Run detection” in Anomaly Detection to populate history.
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
