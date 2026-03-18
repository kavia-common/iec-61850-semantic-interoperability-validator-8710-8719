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

// PUBLIC_INTERFACE
export default function ResultsPage() {
  /** Results page: persisted history of SCL + Excel runs with export as CSV/JSON. */
  const [typeFilter, setTypeFilter] = useState('all');
  const [refreshTick, setRefreshTick] = useState(0);

  const rows = useMemo(() => {
    const all = listRunHistory({ limit: 200 });
    if (typeFilter === 'all') return all;
    return all.filter((r) => r.type === typeFilter);
  }, [typeFilter, refreshTick]);

  const counts = useMemo(() => {
    const all = listRunHistory({ limit: 1000 });
    const scl = all.filter((r) => r.type === 'scl_validation').length;
    const xl = all.filter((r) => r.type === 'excel_anomaly').length;
    return { total: all.length, scl, xl };
  }, [refreshTick]);

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
