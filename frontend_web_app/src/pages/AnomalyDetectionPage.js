import React, { useEffect, useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { detectAnomalies } from '../utils/anomalyDetection';
import { fetchWorkbookFromPublicAsset, inferNumericColumns, parseWorkbookFileToRows, toNumericMatrix } from '../utils/excel';
import { addRunRecord } from '../state/runHistory';

function formatPct(x) {
  if (!Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(2)}%`;
}

function formatNum(x) {
  if (!Number.isFinite(x)) return '—';
  if (x >= 1000) return x.toFixed(1);
  return x.toFixed(3);
}

function pickDefaultSelectedColumns(numericColumns) {
  // Default to up to 12 features to keep the UI manageable.
  return numericColumns.slice(0, 12);
}

function summarizeRowPreview(row, columns) {
  const o = {};
  for (const c of columns.slice(0, 6)) o[c] = row?.[c];
  return o;
}

// PUBLIC_INTERFACE
export default function AnomalyDetectionPage() {
  /** Excel-based anomaly detection workflow (client-side) for numeric features with user-selectable options and outlier display. */
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [fileMeta, setFileMeta] = useState(null); // {name, size, sheetName, sheetNames, source}
  const [rows, setRows] = useState([]);
  const [numericColumns, setNumericColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);

  const [method, setMethod] = useState('robust_zscore');
  const [missing, setMissing] = useState('skip');
  const [outlierMode, setOutlierMode] = useState('percentile');
  const [percentile, setPercentile] = useState(0.99);
  const [topK, setTopK] = useState(50);
  const [threshold, setThreshold] = useState(3.5);

  const [result, setResult] = useState(null);

  async function loadDefaultDataset() {
    setBusy(true);
    setError(null);
    try {
      const parsed = await fetchWorkbookFromPublicAsset('/assets/Attack_Dataset.csv.xlsx');
      setRows(parsed.rows || []);
      setFileMeta({
        name: 'Attack_Dataset.csv.xlsx',
        size: null,
        sheetName: parsed.sheetName,
        sheetNames: parsed.sheetNames,
        source: 'bundled'
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadUploadedFile(file) {
    setBusy(true);
    setError(null);
    try {
      const parsed = await parseWorkbookFileToRows(file);
      setRows(parsed.rows || []);
      setFileMeta({
        name: file.name,
        size: file.size,
        sheetName: parsed.sheetName,
        sheetNames: parsed.sheetNames,
        source: 'upload'
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // Load the bundled dataset on first visit so the user can click "Run" immediately.
    loadDefaultDataset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!rows?.length) {
      setNumericColumns([]);
      setSelectedColumns([]);
      setResult(null);
      return;
    }

    const inferred = inferNumericColumns(rows, { minNonNull: 5, minNumericRatio: 0.8 });
    setNumericColumns(inferred.numericColumns);

    // Refresh selection only if it no longer makes sense (e.g., new dataset)
    setSelectedColumns((prev) => {
      if (!prev?.length) return pickDefaultSelectedColumns(inferred.numericColumns);
      const stillValid = prev.filter((c) => inferred.numericColumns.includes(c));
      return stillValid.length ? stillValid : pickDefaultSelectedColumns(inferred.numericColumns);
    });

    setResult(null);
  }, [rows]);

  const canRun = rows.length > 0 && selectedColumns.length >= 2 && !busy;

  const summaryPills = useMemo(() => {
    if (!result) return null;
    const s = result.summary;
    return (
      <div className="row">
        <span className="pill">Rows: {s.rows}</span>
        <span className="pill">Features: {s.features}</span>
        <span className="pill">
          Outliers: {s.outliers} ({formatPct(s.outlierRate)})
        </span>
        <span className="pill">Cutoff score: {formatNum(s.scoreThresholdUsed)}</span>
        <span className="pill">Method: {result.method}</span>
      </div>
    );
  }, [result]);

  function runDetection() {
    const startedAt = new Date().toISOString();

    setError(null);
    setBusy(true);
    try {
      const matrix = toNumericMatrix(rows, selectedColumns);
      const res = detectAnomalies(matrix, selectedColumns, {
        method,
        missing,
        outlierMode,
        percentile,
        topK,
        threshold
      });
      setResult(res);

      const s = res?.summary;
      addRunRecord({
        type: 'excel_anomaly',
        status: 'success',
        startedAt,
        completedAt: new Date().toISOString(),
        fileName: fileMeta?.name,
        fileSize: fileMeta?.size ?? undefined,
        mocked: fileMeta?.source === 'bundled',
        summary: {
          rows: s?.rows,
          features: s?.features,
          outliers: s?.outliers,
          outlierRate: s?.outlierRate,
          method: res?.method,
          outlierMode,
          percentile: outlierMode === 'percentile' ? percentile : undefined,
          topK: outlierMode === 'topK' ? topK : undefined,
          threshold: outlierMode === 'threshold' ? threshold : undefined
        },
        meta: {
          sheetName: fileMeta?.sheetName,
          selectedFeatures: selectedColumns.length,
          missing
        }
      });
    } catch (e) {
      const msg = String(e);
      setError(msg);
      setResult(null);

      addRunRecord({
        type: 'excel_anomaly',
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        fileName: fileMeta?.name,
        fileSize: fileMeta?.size ?? undefined,
        mocked: fileMeta?.source === 'bundled',
        summary: { error: msg },
        meta: { sheetName: fileMeta?.sheetName }
      });
    } finally {
      setBusy(false);
    }
  }

  const topOutliers = useMemo(() => {
    if (!result?.outliers?.length) return [];
    return result.outliers.slice(0, 100);
  }, [result]);

  const previewColumns = useMemo(() => {
    // show a few non-numeric columns too if present, but keep simple: just selected numeric columns
    return selectedColumns.slice(0, 6);
  }, [selectedColumns]);

  return (
    <PageShell
      title="Anomaly Detection"
      subtitle="Upload an Excel dataset and detect outliers client-side using numeric feature anomaly scoring."
      actions={
        <>
          <button className="btn" onClick={loadDefaultDataset} disabled={busy}>
            Load default dataset
          </button>
          <button className="btn btnPrimary" onClick={runDetection} disabled={!canRun}>
            {busy ? 'Working…' : 'Run detection'}
          </button>
        </>
      }
    >
      <div className="subtle">
        This module is independent of IEC 61850 SCL validation and does not modify existing validation workflows.
      </div>

      <div style={{ height: 12 }} />

      <div className="row">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            if (f) loadUploadedFile(f);
          }}
          aria-label="Upload Excel file for anomaly detection"
        />
        <span className="pill">
          {fileMeta
            ? `${fileMeta.name}${fileMeta.sheetName ? ` (sheet: ${fileMeta.sheetName})` : ''}`
            : 'No dataset loaded'}
        </span>
        {error ? (
          <span className="pill" style={{ borderColor: 'rgba(239, 68, 68, 0.35)', color: '#991b1b' }}>
            Error: {error}
          </span>
        ) : null}
      </div>

      <div style={{ height: 14 }} />
      <hr />
      <div style={{ height: 14 }} />

      <div className="kv">
        <div className="kvKey">Numeric columns (auto-inferred)</div>
        <div className="kvVal">
          {numericColumns.length ? (
            <span className="pill">{numericColumns.length} columns detected</span>
          ) : (
            <span className="subtle">No numeric columns detected yet (load a dataset first).</span>
          )}
        </div>

        <div className="kvKey">Feature selection</div>
        <div className="kvVal">
          <div className="row">
            <button
              className="btn"
              onClick={() => setSelectedColumns(pickDefaultSelectedColumns(numericColumns))}
              disabled={!numericColumns.length || busy}
            >
              Use defaults
            </button>
            <button
              className="btn"
              onClick={() => setSelectedColumns(numericColumns)}
              disabled={!numericColumns.length || busy}
            >
              Select all
            </button>
            <button className="btn" onClick={() => setSelectedColumns([])} disabled={busy}>
              Clear
            </button>
            <span className="pill">Selected: {selectedColumns.length}</span>
          </div>

          <div style={{ height: 10 }} />
          <div className="subtle">Tip: selecting too many features can increase noise; start with 8–15.</div>

          <div style={{ height: 10 }} />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 8
            }}
          >
            {numericColumns.slice(0, 60).map((c) => {
              const checked = selectedColumns.includes(c);
              return (
                <label
                  key={c}
                  className="pill"
                  style={{
                    cursor: busy ? 'not-allowed' : 'pointer',
                    userSelect: 'none',
                    color: checked ? '#111827' : undefined,
                    borderColor: checked ? 'rgba(37, 99, 235, 0.35)' : undefined
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setSelectedColumns((prev) => {
                        if (on) return Array.from(new Set([...prev, c]));
                        return prev.filter((x) => x !== c);
                      });
                    }}
                    style={{ marginRight: 8 }}
                  />
                  {c}
                </label>
              );
            })}
          </div>

          {numericColumns.length > 60 ? (
            <div className="subtle" style={{ marginTop: 10 }}>
              Showing first 60 columns for usability. Refine inference thresholds in a future iteration if needed.
            </div>
          ) : null}
        </div>

        <div className="kvKey">Algorithm options</div>
        <div className="kvVal">
          <div className="row">
            <label className="subtle">
              Method:&nbsp;
              <select value={method} onChange={(e) => setMethod(e.target.value)} disabled={busy}>
                <option value="robust_zscore">Robust z-score (median/MAD)</option>
                <option value="zscore">Z-score (mean/std)</option>
              </select>
            </label>

            <label className="subtle">
              Missing:&nbsp;
              <select value={missing} onChange={(e) => setMissing(e.target.value)} disabled={busy}>
                <option value="skip">Skip missing</option>
                <option value="impute_median">Impute median</option>
              </select>
            </label>

            <label className="subtle">
              Outliers:&nbsp;
              <select value={outlierMode} onChange={(e) => setOutlierMode(e.target.value)} disabled={busy}>
                <option value="percentile">Percentile cutoff</option>
                <option value="topK">Top-K</option>
                <option value="threshold">Score threshold</option>
              </select>
            </label>

            {outlierMode === 'percentile' ? (
              <label className="subtle">
                Percentile:&nbsp;
                <input
                  type="number"
                  min="0.5"
                  max="0.9999"
                  step="0.0001"
                  value={percentile}
                  disabled={busy}
                  onChange={(e) => setPercentile(Number(e.target.value))}
                  style={{ width: 110 }}
                />
              </label>
            ) : null}

            {outlierMode === 'topK' ? (
              <label className="subtle">
                Top-K:&nbsp;
                <input
                  type="number"
                  min="1"
                  max="5000"
                  step="1"
                  value={topK}
                  disabled={busy}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  style={{ width: 110 }}
                />
              </label>
            ) : null}

            {outlierMode === 'threshold' ? (
              <label className="subtle">
                Threshold:&nbsp;
                <input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={threshold}
                  disabled={busy}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  style={{ width: 110 }}
                />
              </label>
            ) : null}
          </div>

          <div style={{ height: 10 }} />
          <div className="subtle">
            Default uses a robust z-score, then ranks rows by mean absolute feature deviation. This is fast, explainable, and works
            well as a first pass on mixed industrial datasets.
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />
      <hr />
      <div style={{ height: 14 }} />

      {summaryPills}

      {result?.recommendations?.length ? (
        <>
          <div style={{ height: 12 }} />
          <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 14 }}>
            <div className="cardBody">
              <div className="subtle" style={{ marginBottom: 8 }}>
                Recommendations
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {result.recommendations.map((r) => (
                  <li key={r.title} style={{ marginBottom: 6 }}>
                    <strong>{r.title}:</strong> <span className="subtle">{r.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : null}

      <div style={{ height: 14 }} />

      {result ? (
        <table className="table" aria-label="Anomaly detection outliers table">
          <thead>
            <tr>
              <th>#</th>
              <th>Row</th>
              <th>Score</th>
              <th>Top contributing features</th>
              <th>Row preview</th>
            </tr>
          </thead>
          <tbody>
            {topOutliers.length ? (
              topOutliers.map((o, idx) => (
                <tr key={`${o.rowIndex}-${idx}`}>
                  <td>{idx + 1}</td>
                  <td>{o.rowIndex + 1}</td>
                  <td>{formatNum(o.score)}</td>
                  <td>
                    <div className="row">
                      {o.topFeatures?.slice(0, 4).map((f) => (
                        <span key={f.feature} className="pill">
                          {f.feature}: {formatNum(f.contribution)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <pre className="mono" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(summarizeRowPreview(rows[o.rowIndex], previewColumns), null, 2)}
                    </pre>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="subtle">
                  No outliers flagged with the current settings.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <div className="subtle">Load a dataset, select numeric features, then click “Run detection”.</div>
      )}
    </PageShell>
  );
}
