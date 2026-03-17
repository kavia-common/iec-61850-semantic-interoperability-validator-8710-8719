import { getEnvConfig } from '../config/env';

/**
 * Minimal HTTP client wrapper.
 * - If apiBase is missing, returns mock data so the UI remains usable.
 * - If a request fails, returns a safe error object for display.
 */

// PUBLIC_INTERFACE
export function createApiClient() {
  /** Creates an API client instance using REACT_APP_* configuration. */
  const { apiBase, healthcheckPath } = getEnvConfig();

  const hasBackend = Boolean(apiBase);

  async function safeJson(resp) {
    try {
      return await resp.json();
    } catch (_e) {
      return null;
    }
  }

  async function request(path, { method = 'GET', headers, body } = {}) {
    if (!hasBackend) {
      return {
        ok: true,
        mocked: true,
        data: mockResponse(path, { method, body })
      };
    }

    const url = `${apiBase.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;

    try {
      const resp = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(headers || {})
        },
        body: body ? JSON.stringify(body) : undefined
      });

      const data = await safeJson(resp);
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

    const url = `${apiBase.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
    const form = new FormData();
    form.append('file', file);
    Object.entries(extraFields).forEach(([k, v]) => form.append(k, String(v)));

    return fetch(url, { method: 'POST', body: form })
      .then(async (resp) => ({ ok: resp.ok, status: resp.status, data: await safeJson(resp) }))
      .catch((error) => ({ ok: false, status: 0, data: null, error: String(error) }));
  }

  return {
    hasBackend,
    healthcheckPath,
    request,
    upload,
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
