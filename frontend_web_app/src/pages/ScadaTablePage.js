import React, { useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { useApp } from '../state/AppContext';

/**
 * SCADA Mapping Table page
 * - Driven by validationResult when available (robust extraction).
 * - Editable in-place with draft state.
 * - Shows recommendations derived from validation issues + row-level heuristics.
 * - Robust mock fallback when backend payload is missing/unrecognized.
 */

/**
 * @typedef {'OK'|'Warning'|'Error'} Quality
 *
 * @typedef {Object} ScadaMappingRow
 * @property {string} id Stable row id for rendering
 * @property {string} point SCADA point name
 * @property {string} ln IEC 61850 LN instance (e.g., XCBR1)
 * @property {string} path DO/DA path (e.g., Pos.stVal)
 * @property {string} vendor Vendor or source system label
 * @property {Quality} quality
 * @property {string=} sourceRef Optional full object reference / provenance
 * @property {string=} targetRef Optional target object reference (for cross-vendor)
 */

/** @typedef {Object} Recommendation
 * @property {string} id
 * @property {'info'|'warning'|'error'} severity
 * @property {string} title
 * @property {string} message
 * @property {string=} code
 * @property {string=} rowId
 */

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k];
  }
  return undefined;
}

function normalizeQuality(v) {
  const s = String(v || '').toLowerCase();
  if (s.includes('error')) return 'Error';
  if (s.includes('warn')) return 'Warning';
  if (s.includes('ok') || s.includes('pass') || s.includes('good')) return 'OK';
  return 'OK';
}

function qualityPillStyle(quality) {
  if (quality === 'Error') return { borderColor: 'rgba(239, 68, 68, 0.35)', color: '#991b1b' };
  if (quality === 'Warning') return { borderColor: 'rgba(245, 158, 11, 0.35)', color: '#92400e' };
  return { borderColor: 'rgba(37, 99, 235, 0.22)', color: 'rgba(37, 99, 235, 0.95)' };
}

function isLikelyScadaPointName(s) {
  const v = String(s || '').trim();
  if (!v) return false;
  // common SCADA-ish: uppercase with underscores/digits, not insanely long
  if (v.length < 3 || v.length > 64) return false;
  return /^[A-Z0-9_:\-\.]+$/.test(v) && /[A-Z]/.test(v);
}

function isLikelyLnInstance(s) {
  const v = String(s || '').trim();
  if (!v) return false;
  // common LN instance: letters + digits, like XCBR1, MMXU1, CSWI1
  return /^[A-Za-z]{2,}\d+([A-Za-z0-9_]*)$/.test(v);
}

function isLikely61850Path(s) {
  const v = String(s || '').trim();
  if (!v) return false;
  // typical dot-separated "Pos.stVal" or "A.phsA.cVal.mag.f"
  if (v.length > 120) return false;
  return /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)+$/.test(v);
}

function makeIdFromRowLike(point, ln, path, vendor, idx) {
  const base = [point, ln, path, vendor].filter(Boolean).join('|');
  return base ? `row:${base}` : `row:idx:${idx}`;
}

function buildMockScadaRows(validationResult) {
  const hasIssues = safeArray(validationResult?.data?.details).length > 0;

  return [
    {
      id: makeIdFromRowLike('BRK_101_STATUS', 'XCBR1', 'Pos.stVal', 'VendorA', 0),
      point: 'BRK_101_STATUS',
      ln: 'XCBR1',
      path: 'Pos.stVal',
      vendor: 'VendorA',
      quality: 'OK'
    },
    {
      id: makeIdFromRowLike('BRK_101_CMD', 'CSWI1', 'Pos.ctlVal', 'VendorB', 1),
      point: 'BRK_101_CMD',
      ln: 'CSWI1',
      path: 'Pos.ctlVal',
      vendor: 'VendorB',
      quality: hasIssues ? 'Warning' : 'OK'
    },
    {
      id: makeIdFromRowLike('BUS_VA', 'MMXU1', 'A.phsA.cVal.mag.f', 'VendorA', 2),
      point: 'BUS_VA',
      ln: 'MMXU1',
      path: 'A.phsA.cVal.mag.f',
      vendor: 'VendorA',
      quality: 'OK'
    }
  ];
}

function toScadaRow(obj, idx) {
  if (!obj || typeof obj !== 'object') return null;

  const point = pick(obj, ['point', 'name', 'scadaPoint', 'scada_point', 'tag', 'signal', 'id']);
  const ln = pick(obj, ['ln', 'lnName', 'lnInst', 'ln_inst', 'logicalNode', 'logical_node']);
  const path = pick(obj, ['path', 'doDaPath', 'do_da_path', 'objectPath', 'object_path', 'ref', 'objectRef', 'object_ref']);
  const vendor = pick(obj, ['vendor', 'sourceVendor', 'source_vendor', 'ied', 'source', 'system']);

  // If this doesn't look like a SCADA row, skip.
  if (!point && !ln && !path) return null;

  const row = {
    id: makeIdFromRowLike(String(point || ''), String(ln || ''), String(path || ''), String(vendor || ''), idx),
    point: point ? String(point) : '',
    ln: ln ? String(ln) : '',
    path: path ? String(path) : '',
    vendor: vendor ? String(vendor) : 'Unknown',
    quality: normalizeQuality(pick(obj, ['quality', 'status', 'severity'])),
    sourceRef: pick(obj, ['sourceRef', 'source_ref', 'sourcePath', 'source_path']),
    targetRef: pick(obj, ['targetRef', 'target_ref', 'targetPath', 'target_path'])
  };

  return row;
}

/**
 * Attempts to extract SCADA mapping table rows from validationResult across multiple possible shapes.
 *
 * @returns {{ rows: ScadaMappingRow[], source: 'backend'|'derived'|'mock', diagnostics: { reason?: string, triedKeys?: string[] } }}
 */
function buildScadaRowsFromAppState(validationResult) {
  const d = validationResult?.data ?? validationResult ?? null;

  // Try common container nodes first.
  const candidateParents = [d, d?.result, d?.report, d?.scada, d?.scadaMappings, d?.mappings];
  const keysToTry = [
    'scadaMappings',
    'scada_mapping',
    'scada_map',
    'scada',
    'points',
    'scadaPoints',
    'scada_points',
    'mappingTable',
    'mapping_table',
    'table',
    'rows'
  ];

  const triedKeys = [];

  for (const parent of candidateParents) {
    if (!parent || typeof parent !== 'object') continue;

    for (const k of keysToTry) {
      triedKeys.push(k);
      const arr = safeArray(parent[k]);
      if (!arr.length) continue;

      const rows = arr.map((it, idx) => toScadaRow(it, idx)).filter(Boolean);
      // Require at least one row with a plausible SCADA point name or LN+path
      const plausible = rows.filter((r) => isLikelyScadaPointName(r.point) || (isLikelyLnInstance(r.ln) && isLikely61850Path(r.path)));
      if (plausible.length) {
        return { rows, source: 'backend', diagnostics: { triedKeys } };
      }
    }
  }

  // Derive from validation details if they mention SCADA.
  const details = safeArray(d?.details);
  const derived = [];
  for (const it of details) {
    const code = String(it?.code || '');
    const msg = String(it?.message || '');
    const sev = String(it?.severity || 'warning').toLowerCase();

    if (!/scada/i.test(code) && !/scada/i.test(msg)) continue;

    const point =
      pick(it, ['point', 'scadaPoint', 'tag', 'name']) ||
      // best-effort parse a point-like token from message
      (msg.match(/([A-Z0-9_]{4,})/) || [])[1] ||
      '';

    const ln = pick(it, ['ln', 'lnRef', 'logicalNode']) || '';
    const path = pick(it, ['path', 'objectRef', 'object']) || '';

    const row = {
      id: makeIdFromRowLike(String(point), String(ln), String(path), 'Derived', derived.length),
      point: String(point || ''),
      ln: String(ln || ''),
      path: String(path || ''),
      vendor: 'Derived',
      quality: sev === 'error' ? 'Error' : 'Warning'
    };

    // Keep only rows that are at least somewhat meaningful.
    if (row.point || row.ln || row.path) derived.push(row);
  }

  if (derived.length) {
    return {
      rows: derived.slice(0, 120),
      source: 'derived',
      diagnostics: { reason: 'Derived from SCADA-related validation details (heuristic).', triedKeys }
    };
  }

  return {
    rows: buildMockScadaRows(validationResult),
    source: 'mock',
    diagnostics: { reason: 'No SCADA mapping payload found in validation result; using robust mock.', triedKeys }
  };
}

function computeRowIssues(row) {
  /** @type {Recommendation[]} */
  const issues = [];
  const point = String(row.point || '');
  const ln = String(row.ln || '');
  const path = String(row.path || '');

  if (!point) {
    issues.push({
      id: `rec:missing-point:${row.id}`,
      severity: 'error',
      title: 'Missing SCADA point name',
      message: 'Point name is empty; assign a stable SCADA tag.',
      rowId: row.id,
      code: 'SCADA-ROW-POINT'
    });
  } else if (!isLikelyScadaPointName(point)) {
    issues.push({
      id: `rec:point-format:${row.id}`,
      severity: 'warning',
      title: 'Non-standard point format',
      message: 'Prefer UPPERCASE_WITH_UNDERSCORES (avoid spaces and mixed casing) for SCADA point names.',
      rowId: row.id,
      code: 'SCADA-NAMING'
    });
  }

  if (!ln) {
    issues.push({
      id: `rec:missing-ln:${row.id}`,
      severity: 'warning',
      title: 'Missing LN instance',
      message: 'LN instance is empty; link the SCADA point to an IEC 61850 LN (e.g., XCBR1).',
      rowId: row.id,
      code: 'SCADA-LN'
    });
  } else if (!isLikelyLnInstance(ln)) {
    issues.push({
      id: `rec:ln-format:${row.id}`,
      severity: 'warning',
      title: 'LN instance looks unusual',
      message: 'LN instance should look like XCBR1/MMXU1/CSWI1. Verify spelling and instance number.',
      rowId: row.id,
      code: 'SCADA-LN-FORMAT'
    });
  }

  if (!path) {
    issues.push({
      id: `rec:missing-path:${row.id}`,
      severity: 'warning',
      title: 'Missing DO/DA path',
      message: 'Path is empty; specify DO/DA (e.g., Pos.stVal) to make the mapping actionable.',
      rowId: row.id,
      code: 'SCADA-PATH'
    });
  } else if (!isLikely61850Path(path)) {
    issues.push({
      id: `rec:path-format:${row.id}`,
      severity: 'warning',
      title: 'Path format looks unusual',
      message: 'Use dot-separated DO/DA path like Pos.stVal or A.phsA.cVal.mag.f.',
      rowId: row.id,
      code: 'SCADA-PATH-FORMAT'
    });
  }

  return issues;
}

function normalizeRecommendationsFromValidation(validationResult) {
  const d = validationResult?.data ?? validationResult ?? null;
  const details = safeArray(d?.details);
  /** @type {Recommendation[]} */
  const out = [];

  for (const it of details) {
    const code = String(it?.code || '');
    const msg = String(it?.message || '');
    const severity = String(it?.severity || 'info').toLowerCase();

    // Prefer SCADA-related items, but also consider explicit recommendations field if it exists.
    if (/scada/i.test(code) || /scada/i.test(msg)) {
      out.push({
        id: `val:${code || 'SCADA'}:${out.length}`,
        severity: severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info',
        title: code || 'SCADA',
        message: msg || 'SCADA-related validation item.'
      });
    }
  }

  // Try explicit "recommendations" arrays if provided by backend (unknown schema tolerant).
  const parents = [d, d?.result, d?.report];
  const recKeys = ['recommendations', 'recommendation', 'suggestions', 'actions', 'fixes'];
  for (const p of parents) {
    if (!p || typeof p !== 'object') continue;
    for (const k of recKeys) {
      const arr = safeArray(p[k]);
      for (const r of arr) {
        if (!r || typeof r !== 'object') continue;
        const msg = pick(r, ['message', 'detail', 'text', 'recommendation']) || '';
        const title = pick(r, ['title', 'code', 'name']) || 'Recommendation';
        const sev = String(pick(r, ['severity', 'level', 'priority']) || 'info').toLowerCase();
        out.push({
          id: `rec:${k}:${out.length}`,
          severity: sev.includes('error') ? 'error' : sev.includes('warn') ? 'warning' : 'info',
          title: String(title),
          message: String(msg)
        });
      }
    }
  }

  // De-dupe by (title,message)
  const seen = new Set();
  return out.filter((r) => {
    const key = `${r.title}|${r.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function textInputStyle({ invalid } = {}) {
  return {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 10,
    border: invalid ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid var(--border)',
    background: 'rgba(255,255,255,0.92)',
    boxShadow: 'var(--shadow-sm)'
  };
}

function severityPillStyle(sev) {
  if (sev === 'error') return { borderColor: 'rgba(239, 68, 68, 0.35)', color: '#991b1b' };
  if (sev === 'warning') return { borderColor: 'rgba(245, 158, 11, 0.35)', color: '#92400e' };
  return { borderColor: 'rgba(37, 99, 235, 0.22)', color: 'rgba(37, 99, 235, 0.95)' };
}

// PUBLIC_INTERFACE
export default function ScadaTablePage() {
  /** SCADA mapping table with editing and recommendations, driven by app state with robust mock fallback. */
  const { validationResult } = useApp();

  const { rows: baseRows, source, diagnostics } = useMemo(
    () => buildScadaRowsFromAppState(validationResult),
    [validationResult]
  );

  const [draftRows, setDraftRows] = useState(() => baseRows);
  const [filter, setFilter] = useState('');
  const [selectedRowId, setSelectedRowId] = useState(null);

  // Keep draft in sync when base changes (new validation run), but preserve ongoing edits when possible.
  React.useEffect(() => {
    setDraftRows(baseRows);
    setSelectedRowId(null);
  }, [baseRows]);

  const filteredRows = useMemo(() => {
    const q = String(filter || '').trim().toLowerCase();
    if (!q) return draftRows;

    return draftRows.filter((r) => {
      const hay = `${r.point} ${r.ln} ${r.path} ${r.vendor}`.toLowerCase();
      return hay.includes(q);
    });
  }, [draftRows, filter]);

  const selectedRow = useMemo(() => {
    if (!selectedRowId) return null;
    return draftRows.find((r) => r.id === selectedRowId) || null;
  }, [draftRows, selectedRowId]);

  const rowRecommendations = useMemo(() => {
    /** @type {Recommendation[]} */
    const out = [];
    for (const r of draftRows) {
      const issues = computeRowIssues(r);
      out.push(...issues);
    }
    return out;
  }, [draftRows]);

  const validationRecommendations = useMemo(
    () => normalizeRecommendationsFromValidation(validationResult),
    [validationResult]
  );

  const allRecommendations = useMemo(() => {
    // Put validation-derived first (global), then row-level (actionable).
    const combined = [...validationRecommendations, ...rowRecommendations];

    // Dedupe by id
    const seen = new Set();
    return combined.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [validationRecommendations, rowRecommendations]);

  const stats = useMemo(() => {
    const byQuality = { OK: 0, Warning: 0, Error: 0 };
    for (const r of draftRows) byQuality[r.quality] += 1;

    const recCounts = { error: 0, warning: 0, info: 0 };
    for (const rec of allRecommendations) recCounts[rec.severity] += 1;

    return { byQuality, recCounts };
  }, [draftRows, allRecommendations]);

  const sourceLabel = source === 'backend' ? 'App State' : source === 'derived' ? 'Derived' : 'Fallback Mock';

  function updateRow(rowId, patch) {
    setDraftRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const idx = draftRows.length;
    const newRow = {
      id: makeIdFromRowLike('', '', '', 'Manual', idx),
      point: '',
      ln: '',
      path: '',
      vendor: 'Manual',
      quality: 'Warning'
    };
    setDraftRows((prev) => [newRow, ...prev]);
    setSelectedRowId(newRow.id);
  }

  function deleteRow(rowId) {
    setDraftRows((prev) => prev.filter((r) => r.id !== rowId));
    setSelectedRowId((prevSelected) => (prevSelected === rowId ? null : prevSelected));
  }

  const actions = (
    <div className="row">
      <span className="pill" title={diagnostics?.reason || ''}>Source: {sourceLabel}</span>
      <span className="pill" style={qualityPillStyle('OK')}>OK: {stats.byQuality.OK}</span>
      <span className="pill" style={qualityPillStyle('Warning')}>Warn: {stats.byQuality.Warning}</span>
      <span className="pill" style={qualityPillStyle('Error')}>Err: {stats.byQuality.Error}</span>

      <span className="pill" style={severityPillStyle('error')}>Rec: {stats.recCounts.error} err</span>
      <span className="pill" style={severityPillStyle('warning')}>{stats.recCounts.warning} warn</span>
      <span className="pill" style={severityPillStyle('info')}>{stats.recCounts.info} info</span>

      <button className="btn btnPrimary" onClick={addRow}>Add row</button>
      <button
        className="btn"
        onClick={() => {
          setDraftRows(baseRows);
          setSelectedRowId(null);
        }}
        disabled={draftRows === baseRows}
        title="Reset edits to the latest extracted dataset"
      >
        Reset
      </button>
    </div>
  );

  return (
    <PageShell
      title="SCADA Table"
      subtitle="Edit SCADA point mappings and review recommendations derived from validation results."
      actions={actions}
    >
      <div className="subtle">
        {source === 'backend'
          ? 'Rendering SCADA mapping rows from available validation payload. Edit values inline; recommendations update automatically.'
          : source === 'derived'
            ? 'No explicit SCADA mapping table detected; rows were derived from SCADA-related validation messages. Edit and refine as needed.'
            : 'No SCADA mapping payload detected; rendering robust mock data so you can explore the editing and recommendation workflow.'}
      </div>

      <div style={{ height: 12 }} />

      <div className="row" style={{ alignItems: 'center' }}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by point, LN, path, vendor…"
          aria-label="Filter SCADA mappings"
          style={{ ...textInputStyle(), maxWidth: 520 }}
        />
        <span className="pill" title="Filtered rows">{filteredRows.length} rows</span>
        {selectedRow ? <span className="pill">Selected: <span className="mono">{selectedRow.point || selectedRow.id}</span></span> : null}
      </div>

      <div style={{ height: 14 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: 12, alignItems: 'start' }}>
        <div className="card" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div className="cardBody">
            <table className="table" aria-label="SCADA mapping table (editable)">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Point</th>
                  <th style={{ width: '14%' }}>LN</th>
                  <th style={{ width: '30%' }}>Path</th>
                  <th style={{ width: '14%' }}>Vendor</th>
                  <th style={{ width: '10%' }}>Quality</th>
                  <th style={{ width: '10%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const pointInvalid = Boolean(r.point) && !isLikelyScadaPointName(r.point);
                  const lnInvalid = Boolean(r.ln) && !isLikelyLnInstance(r.ln);
                  const pathInvalid = Boolean(r.path) && !isLikely61850Path(r.path);

                  const selected = selectedRowId === r.id;

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRowId(r.id)}
                      style={{
                        background: selected ? 'rgba(37, 99, 235, 0.06)' : undefined,
                        cursor: 'pointer'
                      }}
                    >
                      <td>
                        <input
                          value={r.point}
                          onChange={(e) => updateRow(r.id, { point: e.target.value })}
                          aria-label={`Point name for row ${r.id}`}
                          style={textInputStyle({ invalid: !r.point ? false : pointInvalid })}
                          placeholder="e.g., BRK_101_STATUS"
                        />
                      </td>
                      <td>
                        <input
                          value={r.ln}
                          onChange={(e) => updateRow(r.id, { ln: e.target.value })}
                          aria-label={`LN for ${r.point || r.id}`}
                          style={textInputStyle({ invalid: !r.ln ? false : lnInvalid })}
                          placeholder="e.g., XCBR1"
                        />
                      </td>
                      <td>
                        <input
                          value={r.path}
                          onChange={(e) => updateRow(r.id, { path: e.target.value })}
                          aria-label={`Path for ${r.point || r.id}`}
                          style={textInputStyle({ invalid: !r.path ? false : pathInvalid })}
                          placeholder="e.g., Pos.stVal"
                        />
                      </td>
                      <td>
                        <input
                          value={r.vendor}
                          onChange={(e) => updateRow(r.id, { vendor: e.target.value })}
                          aria-label={`Vendor for ${r.point || r.id}`}
                          style={textInputStyle()}
                          placeholder="VendorA"
                        />
                      </td>
                      <td>
                        <select
                          value={r.quality}
                          onChange={(e) => updateRow(r.id, { quality: e.target.value })}
                          aria-label={`Quality for ${r.point || r.id}`}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.92)',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                        >
                          <option value="OK">OK</option>
                          <option value="Warning">Warning</option>
                          <option value="Error">Error</option>
                        </select>
                        <div style={{ height: 8 }} />
                        <span className="pill" style={qualityPillStyle(r.quality)}>{r.quality}</span>
                      </td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <button
                            className="btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteRow(r.id);
                            }}
                            title="Delete row"
                            style={{ padding: '8px 10px' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredRows.length ? (
                  <tr>
                    <td colSpan={6} className="subtle">
                      No rows match the current filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            <div style={{ height: 12 }} />
            <div className="subtle">
              Note: edits are currently local to the browser session. Once backend endpoints are finalized, this page can persist mappings (e.g., save/export).
            </div>
          </div>
        </div>

        <div className="card" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div className="cardBody">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 13 }}>Recommendations</strong>
              <span className="pill" title="Total recommendations">{allRecommendations.length}</span>
            </div>

            <div style={{ height: 10 }} />

            {selectedRow ? (
              <div className="subtle">
                Showing recommendations for selected row:{' '}
                <span className="mono">{selectedRow.point || selectedRow.id}</span>
              </div>
            ) : (
              <div className="subtle">
                Select a row to focus recommendations; otherwise you will see global + top actionable items.
              </div>
            )}

            <div style={{ height: 12 }} />

            <div style={{ display: 'grid', gap: 10 }}>
              {(selectedRow
                ? allRecommendations.filter((r) => !r.rowId || r.rowId === selectedRow.id)
                : allRecommendations
              )
                .slice(0, 14)
                .map((rec) => (
                  <div
                    key={rec.id}
                    className="card"
                    style={{
                      boxShadow: 'var(--shadow-sm)',
                      background:
                        rec.severity === 'error'
                          ? 'rgba(239, 68, 68, 0.10)'
                          : rec.severity === 'warning'
                            ? 'rgba(245, 158, 11, 0.12)'
                            : 'rgba(37, 99, 235, 0.08)'
                    }}
                  >
                    <div className="cardBody">
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <div className="row">
                          <span className="pill" style={severityPillStyle(rec.severity)}>
                            {rec.severity.toUpperCase()}
                          </span>
                          <strong style={{ fontSize: 13 }}>{rec.title}</strong>
                        </div>
                        {rec.code ? <span className="pill"><span className="mono">{rec.code}</span></span> : null}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 13 }}>{rec.message}</div>
                      {rec.rowId ? (
                        <div style={{ marginTop: 8 }} className="subtle">
                          Row: <span className="mono">{rec.rowId.replace(/^row:/, '')}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}

              {!allRecommendations.length ? (
                <div className="subtle">No recommendations available.</div>
              ) : null}
            </div>

            <div style={{ height: 12 }} />
            <div className="subtle">
              Diagnostic: <span className="mono">{diagnostics?.reason || 'OK'}</span>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
