import React, { useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { useApp } from '../state/AppContext';

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

// PUBLIC_INTERFACE
export default function FileUploadPage() {
  /** Upload SCL file(s) for validation. Backend contract is not yet specified, so we provide mock fallback. */
  const { api, setLastUpload, validationResult, setValidationResult, lastUpload } = useApp();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastAction, setLastAction] = useState(null);

  const quickHint = useMemo(() => {
    if (api.hasBackend) return 'Backend configured: upload/validate will attempt real requests (paths are placeholders until contract is defined).';
    return 'Offline mode: upload/validate will return mock results so you can explore the UI.';
  }, [api.hasBackend]);

  async function doMockValidate() {
    setBusy(true);
    try {
      // Placeholder: backend contract unknown. Use our client mock by calling a path.
      const res = await api.request('/validate', { method: 'POST', body: { fileName: file?.name } });
      setValidationResult(res);
      setLastAction(res);
    } finally {
      setBusy(false);
    }
  }

  async function doUpload() {
    if (!file) return;
    setBusy(true);
    try {
      // Placeholder: backend contract unknown. This can be adjusted once OpenAPI is provided.
      const res = await api.upload('/upload', file);
      setLastUpload(res);
      setLastAction(res);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title="File Upload"
      subtitle="Upload IEC 61850 SCL files (SCD/ICD/CID) for semantic interoperability validation."
      actions={
        <>
          <button className="btn" disabled={!file || busy} onClick={doUpload}>
            {busy ? 'Working…' : 'Upload'}
          </button>
          <button className="btn btnPrimary" disabled={!file || busy} onClick={doMockValidate}>
            {busy ? 'Working…' : 'Validate'}
          </button>
        </>
      }
    >
      <div className="subtle">{quickHint}</div>

      <div style={{ height: 14 }} />

      <div className="row">
        <input
          type="file"
          accept=".scd,.icd,.cid,.xml"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          aria-label="Select SCL file"
        />
        <span className="pill">{file ? `${file.name} (${formatBytes(file.size)})` : 'No file selected'}</span>
      </div>

      <div style={{ height: 14 }} />
      <hr />

      <div style={{ height: 14 }} />

      <div className="kv">
        <div className="kvKey">Last upload</div>
        <div className="kvVal">
          {lastUpload ? (
            <pre className="mono" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(lastUpload, null, 2)}
            </pre>
          ) : (
            <span className="subtle">No upload yet.</span>
          )}
        </div>

        <div className="kvKey">Validation result</div>
        <div className="kvVal">
          {validationResult ? (
            <pre className="mono" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(validationResult, null, 2)}
            </pre>
          ) : (
            <span className="subtle">No validation run yet.</span>
          )}
        </div>

        <div className="kvKey">Last action</div>
        <div className="kvVal">
          {lastAction ? (
            <pre className="mono" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(lastAction, null, 2)}
            </pre>
          ) : (
            <span className="subtle">—</span>
          )}
        </div>
      </div>
    </PageShell>
  );
}
