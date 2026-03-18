const STORAGE_KEY = 'siv_run_history_v1';

/**
 * @typedef {'scl_validation'|'excel_anomaly'} RunType
 */

/**
 * @typedef {Object} RunRecord
 * @property {string} id - Unique run id.
 * @property {RunType} type - Type of module run.
 * @property {string} startedAt - ISO timestamp.
 * @property {string} completedAt - ISO timestamp.
 * @property {'success'|'failed'} status - Final status.
 * @property {string=} fileName - Uploaded/used file name (if any).
 * @property {number=} fileSize - File size in bytes (if available).
 * @property {boolean=} mocked - Whether result was produced from mock/offline fallback.
 * @property {Object=} summary - Small summary object for quick browsing.
 * @property {Object=} meta - Any extra fields for future compatibility.
 */

/**
 * Best-effort JSON parse that never throws.
 */
function safeParseJson(s) {
  try {
    return JSON.parse(s);
  } catch (_e) {
    return null;
  }
}

function readAllUnsafe() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = safeParseJson(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

function writeAllUnsafe(items) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function makeId() {
  // Compact-ish unique id: timestamp + random.
  return `run_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// PUBLIC_INTERFACE
export function listRunHistory({ limit = 200 } = {}) {
  /** Returns run history in reverse chronological order (newest first). */
  const all = readAllUnsafe();
  // Defensive: keep stable sort even if timestamps missing.
  const sorted = [...all].sort((a, b) => String(b?.startedAt || '').localeCompare(String(a?.startedAt || '')));
  return sorted.slice(0, limit);
}

// PUBLIC_INTERFACE
export function addRunRecord(partial) {
  /**
   * Adds a new run record to persisted local history.
   * @param {Partial<RunRecord> & {type: RunType, status: 'success'|'failed'}} partial
   * @returns {RunRecord} the record written.
   */
  const nowIso = new Date().toISOString();
  const record = {
    id: makeId(),
    startedAt: partial.startedAt || nowIso,
    completedAt: partial.completedAt || nowIso,
    mocked: Boolean(partial.mocked),
    meta: partial.meta || undefined,
    summary: partial.summary || undefined,
    fileName: partial.fileName || undefined,
    fileSize: Number.isFinite(partial.fileSize) ? partial.fileSize : undefined,
    type: partial.type,
    status: partial.status
  };

  const all = readAllUnsafe();

  // Keep bounded size to avoid unbounded localStorage growth.
  const next = [record, ...all].slice(0, 500);
  writeAllUnsafe(next);

  return record;
}

// PUBLIC_INTERFACE
export function clearRunHistory() {
  /** Clears all persisted run history records. */
  writeAllUnsafe([]);
}

// PUBLIC_INTERFACE
export function exportRunHistoryJson() {
  /** Exports run history as a JSON string (pretty-printed). */
  const rows = listRunHistory({ limit: 1000 });
  return JSON.stringify({ exportedAt: new Date().toISOString(), rows }, null, 2);
}

function csvEscape(v) {
  if (v === null || typeof v === 'undefined') return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function flattenSummary(summary) {
  // Keep summary compact and stable across modules.
  if (!summary || typeof summary !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(summary)) {
    if (v === null || typeof v === 'undefined') continue;
    if (typeof v === 'object') continue; // don't nest in CSV
    out[`summary_${k}`] = v;
  }
  return out;
}

// PUBLIC_INTERFACE
export function exportRunHistoryCsv() {
  /** Exports run history as a CSV string suitable for spreadsheet import. */
  const rows = listRunHistory({ limit: 1000 });

  const baseCols = [
    'id',
    'type',
    'status',
    'startedAt',
    'completedAt',
    'fileName',
    'fileSize',
    'mocked'
  ];

  // Collect union of summary keys to make a consistent CSV header.
  const summaryKeys = new Set();
  for (const r of rows) {
    const flat = flattenSummary(r.summary);
    Object.keys(flat).forEach((k) => summaryKeys.add(k));
  }
  const summaryCols = Array.from(summaryKeys).sort();

  const header = [...baseCols, ...summaryCols];

  const lines = [header.join(',')];
  for (const r of rows) {
    const flat = flattenSummary(r.summary);
    const values = header.map((c) => csvEscape(r?.[c] ?? flat?.[c] ?? ''));
    lines.push(values.join(','));
  }
  return lines.join('\n');
}
