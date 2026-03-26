import React, { useEffect, useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { useApp } from '../state/AppContext';

/**
 * AI Analytics module scaffold:
 * - Shows how AI analytics jobs/results will be managed.
 * - Uses tolerant API client placeholder endpoints with graceful fallback.
 */

// PUBLIC_INTERFACE
export default function AIAnalyticsPage() {
  /** AI Analytics module scaffold page for managing analytics jobs and viewing results. */
  const { api, lastUpload } = useApp();

  const [status, setStatus] = useState({ phase: 'idle', message: '' });
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [result, setResult] = useState(null);

  const backendHint = useMemo(() => {
    if (api?.hasBackend) return null;
    return 'Backend not configured. This module is running in scaffold mode with mock data.';
  }, [api]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setStatus({ phase: 'loading', message: 'Loading AI analytics jobs…' });
      const res = await api.listAiAnalyticsJobs({ limit: 20 });

      if (!mounted) return;

      if (res.ok) {
        setJobs(Array.isArray(res.data?.jobs) ? res.data.jobs : []);
        setStatus({
          phase: 'ready',
          message: res.mocked
            ? 'Showing mock jobs (backend unavailable or endpoint not implemented).'
            : 'Jobs loaded.'
        });
      } else {
        setStatus({
          phase: 'error',
          message: res.error || 'Failed to load jobs.'
        });
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [api]);

  async function onRunNewJob() {
    setResult(null);
    setSelectedJobId('');

    const uploadId = lastUpload?.uploadId || lastUpload?.id || undefined;

    setStatus({ phase: 'running', message: 'Starting a new AI analytics job…' });
    const res = await api.createAiAnalyticsJob({
      uploadId,
      // Keeping parameters generic; will be extended once backend contract is finalized.
      params: { scope: 'siv-tool', kind: 'ai-analytics' }
    });

    if (!res.ok) {
      setStatus({ phase: 'error', message: res.error || 'Failed to create job.' });
      return;
    }

    const createdJob = res.data?.job;
    const jobId = createdJob?.id || createdJob?.jobId || '';
    setJobs((prev) => [createdJob, ...prev].filter(Boolean));
    setSelectedJobId(jobId);

    setStatus({
      phase: 'ready',
      message: res.mocked
        ? 'Created a mock job (backend unavailable or endpoint not implemented).'
        : 'Job created.'
    });
  }

  async function onLoadResult(jobId) {
    setResult(null);
    if (!jobId) return;

    setStatus({ phase: 'loading', message: `Loading results for job ${jobId}…` });
    const res = await api.getAiAnalyticsResult({ jobId });

    if (res.ok) {
      setResult(res.data?.result ?? res.data);
      setStatus({
        phase: 'ready',
        message: res.mocked
          ? 'Showing mock results (backend unavailable or endpoint not implemented).'
          : 'Result loaded.'
      });
    } else {
      setStatus({ phase: 'error', message: res.error || 'Failed to load result.' });
    }
  }

  return (
    <PageShell
      title="AI Analytics"
      subtitle="Scaffold module for AI-driven analytics jobs and results (placeholder endpoints with graceful fallback)."
      actions={
        <button className="btn btnPrimary" type="button" onClick={onRunNewJob}>
          Run new job
        </button>
      }
    >
      {backendHint ? (
        <div
          className="pill"
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            borderColor: 'rgba(245, 158, 11, 0.30)',
            color: '#92400e',
            fontWeight: 700,
            marginBottom: 12
          }}
        >
          {backendHint}
        </div>
      ) : null}

      <div className="subtle" style={{ marginBottom: 12 }}>
        Status: <strong>{status.phase}</strong>
        {status.message ? <span> — {status.message}</span> : null}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 12
        }}
      >
        <section className="card" aria-label="AI analytics jobs" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 14 }}>
          <header className="cardHeader">
            <div>
              <div className="h2" style={{ margin: 0 }}>
                Jobs
              </div>
              <div className="subtle" style={{ marginTop: 4 }}>
                Latest analytics runs (mocked until backend endpoints are available).
              </div>
            </div>
          </header>
          <div className="cardBody">
            {jobs.length === 0 ? (
              <div className="subtle">No jobs yet. Click “Run new job” to create one.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                {jobs.map((j) => {
                  const id = j?.id || j?.jobId;
                  const title = j?.title || j?.name || `Job ${id}`;
                  const state = j?.state || j?.status || 'unknown';
                  const createdAt = j?.createdAt || j?.ts || null;
                  const isActive = selectedJobId && id === selectedJobId;

                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className={`btn btnGhost${isActive ? ' btnPrimary' : ''}`}
                        style={{
                          width: '100%',
                          justifyContent: 'space-between',
                          borderRadius: 12
                        }}
                        onClick={() => {
                          setSelectedJobId(id);
                          onLoadResult(id);
                        }}
                      >
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                          <strong style={{ color: '#111827' }}>{title}</strong>
                          <span className="subtle">
                            {state}
                            {createdAt ? ` • ${String(createdAt)}` : ''}
                          </span>
                        </span>
                        <span aria-hidden="true">›</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section
          className="card"
          aria-label="AI analytics result"
          style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 14 }}
        >
          <header className="cardHeader">
            <div>
              <div className="h2" style={{ margin: 0 }}>
                Result
              </div>
              <div className="subtle" style={{ marginTop: 4 }}>
                Select a job to view its output (scaffold JSON preview).
              </div>
            </div>
          </header>
          <div className="cardBody">
            {!selectedJobId ? (
              <div className="subtle">Select a job from the left to view its results.</div>
            ) : !result ? (
              <div className="subtle">No result loaded yet.</div>
            ) : (
              <>
                <div className="kv" style={{ marginBottom: 10 }}>
                  <div className="kvKey">Selected job</div>
                  <div className="kvVal">
                    <span className="pill">{selectedJobId}</span>
                  </div>
                </div>

                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    borderRadius: 12,
                    background: 'rgba(37, 99, 235, 0.06)',
                    border: '1px solid rgba(37, 99, 235, 0.18)',
                    overflowX: 'auto',
                    fontSize: 12
                  }}
                >
                  {JSON.stringify(result, null, 2)}
                </pre>
              </>
            )}
          </div>
        </section>
      </div>

      <div style={{ height: 14 }} />
      <hr />
      <div style={{ height: 14 }} />

      <section className="card" aria-label="AI analytics notes" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 14 }}>
        <div className="cardBody">
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Notes</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li className="subtle" style={{ marginBottom: 6 }}>
              This is a UI scaffold. Backend endpoints are probed, and mock data is used when unavailable.
            </li>
            <li className="subtle">
              Future steps: add job status polling, job cancellation, and richer result visualization (recommendations,
              model explanations, and export).
            </li>
          </ul>
        </div>
      </section>
    </PageShell>
  );
}
