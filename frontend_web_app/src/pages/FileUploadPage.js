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

function extractUploadId(uploadRes) {
  // Try multiple likely shapes to avoid coupling to unknown backend contracts.
  const d = uploadRes?.data || uploadRes;
  return d?.uploadId || d?.id || d?.fileId || d?.data?.uploadId || null;
}

function normalizeAsValidationResult(res) {
  // In app state we historically store the API response object (with .data.details)
  // Ensure we keep that shape where possible.
  if (!res) return null;
  if (res.data) return res;
  return { ok: true, data: res };
}

// PUBLIC_INTERFACE
export default function FileUploadPage() {
  /** Upload SCL file(s) for validation with real upload + validation polling, keeping mock fallback when contract is unknown. */
  const { api, setLastUpload, validationResult, setValidationResult, lastUpload } = useApp();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastAction, setLastAction] = useState(null);

  const [pollState, setPollState] = useState(null); // {state, progress, message}
  const [flowError, setFlowError] = useState(null);

  const quickHint = useMemo(() => {
    if (api.hasBackend) {
      return 'Backend configured: the app will try real upload and poll for validation results. If endpoints are unknown/unavailable, it will automatically fall back to mock results.';
    }
    return 'Offline mode: upload/validate will return mock results so you can explore the UI.';
  }, [api.hasBackend]);

  async function doUpload() {
    if (!file) return;
    setBusy(true);
    setFlowError(null);
    try {
      // Uses endpoint probing + safe mock fallback internally.
      const res = api.uploadSclFile ? await api.uploadSclFile(file) : await api.upload('/upload', file);
      setLastUpload(res);
      setLastAction(res);
    } finally {
      setBusy(false);
    }
  }

  async function doValidateWithPolling() {
    if (!file) return;

    setBusy(true);
    setFlowError(null);
    setPollState({ state: 'starting', progress: 0, message: 'Starting validation…' });

    try {
      // Ensure we have an upload record; upload first if needed.
      let uploadRes = lastUpload;
      if (!uploadRes || uploadRes?.data?.fileName !== file.name) {
        uploadRes = api.uploadSclFile ? await api.uploadSclFile(file) : await api.upload('/upload', file);
        setLastUpload(uploadRes);
        setLastAction(uploadRes);
      }

      const uploadId = extractUploadId(uploadRes);

      // Start validation (endpoint probing + mock fallback if needed)
      const startRes = api.startValidation
        ? await api.startValidation({ uploadId, fileName: file.name })
        : await api.request('/validate', { method: 'POST', body: { uploadId, fileName: file.name } });

      setLastAction(startRes);

      // If we don't have polling capability, treat startRes as final (old behavior)
      if (!api.pollValidationUntilDone) {
        const normalized = normalizeAsValidationResult(startRes);
        setValidationResult(normalized);
        setPollState({ state: 'completed', progress: 100, message: 'Validation completed.' });
        return;
      }

      // Determine an id to poll if backend returned one; otherwise fallback to uploadId.
      const validationId =
        startRes?.data?.validationId ||
        startRes?.data?.jobId ||
        startRes?.data?.id ||
        uploadId;

      const finalRes = await api.pollValidationUntilDone(
        { validationId, uploadId, intervalMs: 1200, timeoutMs: 45000 },
        (s) => setPollState(s)
      );

      if (!finalRes.ok) {
        setFlowError(finalRes.error || 'Validation failed.');
        setPollState({ state: 'failed', progress: undefined, message: finalRes.error || 'Validation failed.' });
        return;
      }

      const normalized = normalizeAsValidationResult(finalRes);
      setValidationResult(normalized);
      setPollState({ state: 'completed', progress: 100, message: finalRes.mocked ? 'Validation completed (mock fallback).' : 'Validation completed.' });
      setLastAction(normalized);
    } catch (e) {
      setFlowError(String(e));
      setPollState({ state: 'failed', progress: undefined, message: String(e) });
    } finally {
      setBusy(false);
    }
  }

  const statusPill = useMemo(() => {
    if (!pollState) return null;

    const label = pollState.state || '…';
    const msg = pollState.message ? ` — ${pollState.message}` : '';
    const pct =
      typeof pollState.progress === 'number' ? ` (${Math.max(0, Math.min(100, Math.round(pollState.progress)))}%)` : '';

    return (
      <span className="pill" title={pollState.message || ''}>
        Validation: {label}
        {pct}
        {msg}
      </span>
    );
  }, [pollState]);

  return (
    <PageShell
      title="File Upload"
      subtitle="Upload IEC 61850 SCL files (SCD/ICD/CID) for semantic interoperability validation."
      actions={
        <>
          <button className="btn" disabled={!file || busy} onClick={doUpload}>
            {busy ? 'Working…' : 'Upload'}
          </button>
          <button className="btn btnPrimary" disabled={!file || busy} onClick={doValidateWithPolling}>
            {busy ? 'Working…' : 'Validate'}
          </button>
        </>
      }
    >
      <div className="subtle">{quickHint}</div>

      <div style={{ height: 10 }} />
      <div className="row">
        {statusPill}
        {flowError ? (
          <span className="pill" style={{ borderColor: 'rgba(239, 68, 68, 0.35)', color: '#991b1b' }}>
            Error: {flowError}
          </span>
        ) : null}
      </div>

      <div style={{ height: 14 }} />

      <div className="row">
        <input
          type="file"
          accept=".scd,.icd,.cid,.xml"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setFlowError(null);
            setPollState(null);
          }}
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
