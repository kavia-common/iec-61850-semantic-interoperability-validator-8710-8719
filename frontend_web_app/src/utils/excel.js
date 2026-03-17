import * as XLSX from 'xlsx';

function safeToNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    const cleaned = t.replace(/,/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// PUBLIC_INTERFACE
export async function parseWorkbookFileToRows(file, { sheetName } = {}) {
  /** Parse an uploaded .xlsx/.xls file into an array of row objects using the first (or selected) sheet. */
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  const effectiveSheetName =
    sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];

  const ws = wb.Sheets[effectiveSheetName];
  const rows = XLSX.utils.sheet_to_json(ws, {
    defval: null,
    raw: true
  });

  return {
    sheetNames: wb.SheetNames,
    sheetName: effectiveSheetName,
    rows
  };
}

// PUBLIC_INTERFACE
export async function fetchWorkbookFromPublicAsset(url, { sheetName } = {}) {
  /** Load an .xlsx from a public URL (e.g., /assets/Attack_Dataset.csv.xlsx) and parse into rows. */
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch workbook: ${res.status} ${res.statusText}`);
  const buf = await res.arrayBuffer();

  const wb = XLSX.read(buf, { type: 'array' });
  const effectiveSheetName =
    sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
  const ws = wb.Sheets[effectiveSheetName];

  const rows = XLSX.utils.sheet_to_json(ws, {
    defval: null,
    raw: true
  });

  return { sheetNames: wb.SheetNames, sheetName: effectiveSheetName, rows };
}

// PUBLIC_INTERFACE
export function inferNumericColumns(rows, { minNonNull = 10, minNumericRatio = 0.8 } = {}) {
  /** Infer columns that are predominantly numeric. Returns { numericColumns, statsByColumn }. */
  const keys = new Set();
  rows.forEach((r) => Object.keys(r || {}).forEach((k) => keys.add(k)));

  const statsByColumn = {};
  for (const k of keys) {
    let nonNull = 0;
    let numeric = 0;
    for (const r of rows) {
      const v = r?.[k];
      if (v === null || v === undefined || v === '') continue;
      nonNull += 1;
      const n = safeToNumber(v);
      if (n !== null) numeric += 1;
    }
    const numericRatio = nonNull ? numeric / nonNull : 0;
    statsByColumn[k] = { nonNull, numeric, numericRatio };
  }

  const numericColumns = Object.entries(statsByColumn)
    .filter(([, s]) => s.nonNull >= minNonNull && s.numericRatio >= minNumericRatio)
    .map(([k]) => k)
    .sort((a, b) => a.localeCompare(b));

  return { numericColumns, statsByColumn };
}

// PUBLIC_INTERFACE
export function toNumericMatrix(rows, columns) {
  /** Convert rows + selected columns into numeric matrix with null for missing values. */
  return rows.map((r) => columns.map((c) => safeToNumber(r?.[c])));
}
