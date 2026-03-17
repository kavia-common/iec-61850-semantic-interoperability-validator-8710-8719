import { getEnvConfig } from '../config/env';

/**
 * Minimal HTTP client wrapper.
 * - If apiBase is missing, returns mock data so the UI remains usable.
 * - If a request fails, returns a safe error object for display.
 *
 * This file also contains tolerant helpers to support "unknown backend contract":
 * we probe common endpoint patterns and parse results using heuristics, while
 * falling back to mock behavior when backend is unavailable.
 */

// PUBLIC_INTERFACE
export function createApiClient() {
  /** Creates an API client instance using REACT_APP_* configuration. */
  const { apiBase, healthcheckPath } = getEnvConfig();

  const hasBackend = Boolean(apiBase);

  function buildUrl(path) {
    return `${apiBase.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  async function safeJson(resp) {
    try {
      return await resp.json();
    } catch (_e) {
      return null;
    }
  }

  async function safeText(resp) {
    try {
      return await resp.text();
    } catch (_e) {
      return '';
    }
  }

  function isProbablyHtml(s) {
    if (typeof s !== 'string') return false;
    const t = s.trim().toLowerCase();
    return t.startsWith('<!doctype html') || t.startsWith('<html') || t.includes('<body');
  }

  /**
   * Tries to normalize diverse backend shapes into a consistent status model.
   * Expected outputs:
   *   { state: 'queued'|'running'|'completed'|'failed', progress?: number, message?: string, result?: any }
   */
  function normalizeValidationStatus(payload) {
    if (!payload) return { state: 'running' };

    // Some backends may return {status:'completed'} or {state:'done'} etc.
    const rawState =
      payload.state ||
      payload.status ||
      payload.phase ||
      payload.jobStatus ||
      payload.validationStatus;

    const stateStr = String(rawState || '').toLowerCase();

    const progress =
      typeof payload.progress === 'number'
        ? payload.progress
        : typeof payload.percent === 'number'
          ? payload.percent
          : typeof payload.percentage === 'number'
            ? payload.percentage
            : undefined;

    const message = payload.message || payload.detail || payload.error || undefined;

    // Common success terminal markers
    if (
      stateStr.includes('complete') ||
      stateStr === 'done' ||
      stateStr === 'success' ||
      stateStr === 'succeeded' ||
      stateStr === 'ok'
    ) {
      return { state: 'completed', progress: progress ?? 100, message, result: payload.result ?? payload.data ?? payload };
    }

    // Common failure terminal markers
    if (
      stateStr.includes('fail') ||
      stateStr.includes('error') ||
      stateStr === 'failed' ||
      stateStr === 'errored'
    ) {
      return { state: 'failed', progress, message: message || 'Validation failed.', result: payload.result ?? payload };
    }

    // Queue/running markers
    if (stateStr.includes('queue') || stateStr === 'pending') {
      return { state: 'queued', progress, message };
    }
    if (stateStr.includes('run') || stateStr === 'processing' || stateStr === 'in_progress') {
      return { state: 'running', progress, message };
    }

    // Heuristic: if details exist, treat as final report already.
    const details = payload?.details || payload?.data?.details;
    if (Array.isArray(details)) {
      return { state: 'completed', progress: 100, result: payload };
    }

    // Default: still running.
    return { state: 'running', progress, message, result: payload };
  }

  async function request(path, { method = 'GET', headers, body } = {}) {
    if (!hasBackend) {
      return {
        ok: true,
        mocked: true,
        data: mockResponse(path, { method, body })
      };
    }

    const url = buildUrl(path);

    try {
      const resp = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(headers || {})
        },
        body: body ? JSON.stringify(body) : undefined
      });

      // Some misconfigured proxies might return HTML for API routes
      const ct = resp.headers.get('content-type') || '';
      let data = null;

      if (ct.includes('application/json')) {
        data = await safeJson(resp);
      } else {
        const text = await safeText(resp);
        data = isProbablyHtml(text) ? null : text;
      }

      return { ok: resp.ok, status: resp.status, data };
    } catch (error) {
      return { ok: false, status: 0, data: null, error: String(error) };
    }
  }

  function upload(path, file, extraFields = {}) {
    if (!hasBackend) {
      return Promise.resolve({
        ok: true,
        mocked: true,
        data: {
          uploadId: `mock-${Date.now()}`,
          fileName: file?.name || 'unknown.scl',
          message: 'Backend not configured; using mock upload.'
        }
      });
    }

    const url = buildUrl(path);
    const form = new FormData();
    form.append('file', file);
    Object.entries(extraFields).forEach(([k, v]) => form.append(k, String(v)));

    return fetch(url, { method: 'POST', body: form })
      .then(async (resp) => ({ ok: resp.ok, status: resp.status, data: await safeJson(resp) }))
      .catch((error) => ({ ok: false, status: 0, data: null, error: String(error) }));
  }

  async function probeFirstOk(candidates, makeCall) {
    for (const c of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const res = await makeCall(c);
      if (res?.ok) return { candidate: c, res };
    }
    return { candidate: null, res: null };
  }

  /**
   * Attempts to upload with common endpoint patterns.
   * Returns: { ok, mocked?, status?, endpoint?, data?, error? }
   */
  async function uploadSclFile(file) {
    if (!hasBackend) return upload('/upload', file);

    const candidates = ['/upload', '/api/upload', '/files/upload', '/api/files/upload'];
    const { candidate, res } = await probeFirstOk(candidates, (p) => upload(p, file));

    if (res) return { ...res, endpoint: candidate };

    // Robust fallback: if backend exists but endpoints unknown/unreachable, revert to mock
    return {
      ok: true,
      mocked: true,
      data: {
        uploadId: `mock-${Date.now()}`,
        fileName: file?.name || 'unknown.scl',
        message: 'Upload endpoint not found/unreachable; using mock upload.'
      }
    };
  }

  /**
   * Attempts to start validation with common endpoint patterns.
   * Returns: { ok, mocked?, endpoint?, data? }
   */
  async function startValidation({ uploadId, fileName }) {
    if (!hasBackend) {
      return {
        ok: true,
        mocked: true,
        data: mockResponse('/validate', { method: 'POST' })
      };
    }

    const candidates = ['/validate', '/api/validate', '/validation/start', '/api/validation/start'];
    const body = { uploadId, fileName };

    const { candidate, res } = await probeFirstOk(candidates, (p) =>
      request(p, { method: 'POST', body })
    );

    if (res) return { ...res, endpoint: candidate };

    // Robust fallback
    return { ok: true, mocked: true, data: mockResponse('/validate', { method: 'POST' }) };
  }

  /**
   * Attempts to fetch validation status/results with common endpoint patterns.
   * Supports either:
   *  - status endpoint returning a state/progress
   *  - result endpoint returning final report with details[]
   */
  async function getValidationStatus({ validationId, uploadId }) {
    if (!hasBackend) {
      return { ok: true, mocked: true, data: { state: 'completed', result: mockResponse('/validate', { method: 'POST' }) } };
    }

    const id = validationId || uploadId;
    const candidates = [
      `/validate/status/${encodeURIComponent(id)}`,
      `/api/validate/status/${encodeURIComponent(id)}`,
      `/validation/status/${encodeURIComponent(id)}`,
      `/api/validation/status/${encodeURIComponent(id)}`,
      `/validate/${encodeURIComponent(id)}`,
      `/api/validate/${encodeURIComponent(id)}`,
      `/validation/${encodeURIComponent(id)}`,
      `/api/validation/${encodeURIComponent(id)}`
    ];

    const { candidate, res } = await probeFirstOk(candidates, (p) => request(p, { method: 'GET' }));
    if (res) return { ...res, endpoint: candidate };

    return { ok: false, status: 404, data: null, error: 'Validation status endpoint not found.' };
  }

  /**
   * Polls validation status until terminal state or timeout.
   * onProgress is called with {state, progress, message}.
   */
  async function pollValidationUntilDone(
    { validationId, uploadId, intervalMs = 1200, timeoutMs = 45000 },
    onProgress
  ) {
    const startedAt = Date.now();

    // Keep polling until completed/failed/timeout
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const res = await getValidationStatus({ validationId, uploadId });

      if (!res?.ok) {
        // If backend is configured but endpoints unknown, do a safe fallback
        return {
          ok: true,
          mocked: true,
          data: mockResponse('/validate', { method: 'POST' }),
          meta: { reason: res?.error || `status=${res?.status || 'n/a'}` }
        };
      }

      const normalized = normalizeValidationStatus(res.data);
      if (typeof onProgress === 'function') onProgress(normalized);

      if (normalized.state === 'completed') {
        // If backend returns {result: ...} use it; else use payload
        const result = normalized.result ?? res.data;
        return { ok: true, mocked: Boolean(res.mocked), data: result };
      }

      if (normalized.state === 'failed') {
        return { ok: false, mocked: Boolean(res.mocked), status: res.status, data: res.data, error: normalized.message || 'Validation failed.' };
      }

      if (Date.now() - startedAt > timeoutMs) {
        return {
          ok: true,
          mocked: true,
          data: mockResponse('/validate', { method: 'POST' }),
          meta: { reason: 'timeout' }
        };
      }

      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  return {
    hasBackend,
    healthcheckPath,

    // low-level building blocks (kept for existing callers/tests)
    request,
    upload,

    // higher-level helpers used by FileUpload flow
    uploadSclFile,
    startValidation,
    getValidationStatus,
    pollValidationUntilDone,

    getHealth: () => request(healthcheckPath, { method: 'GET' })
  };
}

function mockResponse(path, { method }) {
  if (path.includes('health')) {
    return { status: 'ok', mocked: true, ts: new Date().toISOString() };
  }

  if (path.includes('validate')) {
    return {
      mocked: true,
      summary: {
        issues: 3,
        warnings: 2,
        recommendations: 2
      },
      details: [
        { severity: 'error', code: 'LN-001', message: 'Missing mandatory DO in LN XCBR.' },
        { severity: 'error', code: 'DS-004', message: 'Dataset references unknown FCDA target.' },
        { severity: 'warning', code: 'SCADA-002', message: 'SCADA point name non-standard mapping.' }
      ]
    };
  }

  if (method === 'POST' && path.includes('upload')) {
    return {
      mocked: true,
      uploadId: `mock-${Date.now()}`,
      message: 'Mock upload accepted (no backend configured).'
    };
  }

  return {
    mocked: true,
    message: `No backend configured. Mock response for ${method} ${path}.`
  };
}
