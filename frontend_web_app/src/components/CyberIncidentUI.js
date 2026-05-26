import React, { useMemo, useState } from 'react';
import {
  advanceCyberIncidentStage,
  assignCyberIncident,
  createCyberIncident,
  getCyberIncidentById,
  getCyberNotificationChannels,
  getCyberPersonas,
  listCyberIncidents
} from '../state/cyberMockData';

const STAGES = [
  { key: 'detection', label: 'Detection' },
  { key: 'alert', label: 'Alert' },
  { key: 'triage', label: 'Triage' },
  { key: 'resolution', label: 'Resolution' }
];

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function sevStyle(sev) {
  if (sev === 'High') return { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.30)', color: '#991b1b' };
  if (sev === 'Medium')
    return { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.30)', color: '#92400e' };
  return { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.30)', color: '#065f46' };
}

function stageIndex(stageKey) {
  return Math.max(0, STAGES.findIndex((s) => s.key === stageKey));
}

function nextStage(stageKey) {
  const idx = stageIndex(stageKey);
  return STAGES[Math.min(STAGES.length - 1, idx + 1)].key;
}

function formatWhen(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso || '—';
  }
}

function PersonaBadge({ persona }) {
  if (!persona) return <span className="pill">Unassigned</span>;
  return (
    <span className="pill" title={persona.focus}>
      {persona.name} · {persona.role}
    </span>
  );
}

function StageRail({ stage }) {
  const idx = stageIndex(stage);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} aria-label="Incident workflow stages">
      {STAGES.map((s, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <span
            key={s.key}
            className="pill"
            style={{
              background: active ? 'rgba(37, 99, 235, 0.12)' : done ? 'rgba(16, 185, 129, 0.10)' : undefined,
              borderColor: active ? 'rgba(37, 99, 235, 0.30)' : done ? 'rgba(16, 185, 129, 0.22)' : undefined,
              color: active ? '#1d4ed8' : done ? '#065f46' : undefined,
              fontWeight: active ? 800 : 600
            }}
          >
            {i + 1}. {s.label}
          </span>
        );
      })}
    </div>
  );
}

// PUBLIC_INTERFACE
export function CyberIncidentBoard({ initialFilterStage = null }) {
  /** Master-detail incident board with workflow transitions and persona-driven actions (mock data). */
  const personas = useMemo(() => getCyberPersonas(), []);
  const channels = useMemo(() => getCyberNotificationChannels(), []);

  const [selectedId, setSelectedId] = useState(() => listCyberIncidents()[0]?.id || null);
  const [filterStage, setFilterStage] = useState(initialFilterStage);
  const [actorPersonaId, setActorPersonaId] = useState(personas[1]?.id || personas[0]?.id);

  const [createForm, setCreateForm] = useState({
    title: '',
    summary: '',
    severity: 'Low',
    asset: ''
  });

  const incidents = useMemo(() => {
    const all = listCyberIncidents();
    return filterStage ? all.filter((x) => x.status === filterStage) : all;
  }, [filterStage]);

  const selected = useMemo(() => (selectedId ? getCyberIncidentById(selectedId) : null), [selectedId, incidents.length]);

  const selectedAssignee = useMemo(() => {
    if (!selected?.assignedTo) return null;
    return personas.find((p) => p.id === selected.assignedTo) || null;
  }, [personas, selected?.assignedTo]);

  const actorPersona = useMemo(
    () => personas.find((p) => p.id === actorPersonaId) || personas[1] || personas[0],
    [personas, actorPersonaId]
  );

  const progress01 = useMemo(() => {
    if (!selected) return 0;
    return clamp01(stageIndex(selected.status) / (STAGES.length - 1));
  }, [selected]);

  function ensureSelected() {
    const first = incidents[0]?.id || listCyberIncidents()[0]?.id || null;
    if (!selectedId && first) setSelectedId(first);
  }

  function moveNext({ withNotifications }) {
    if (!selected) return;
    const ns = nextStage(selected.status);
    const msg = `Incident ${selected.id} moved to ${ns} by ${actorPersona.name}`;
    const updated = advanceCyberIncidentStage({
      id: selected.id,
      nextStatus: ns,
      byPersonaId: actorPersona.id,
      addNotifications: withNotifications
        ? { channels: ['teams', 'email'], message: msg }
        : null
    });
    if (updated) setSelectedId(updated.id);
  }

  function moveTo(stage) {
    if (!selected) return;
    const msg = `Incident ${selected.id} set to ${stage} by ${actorPersona.name}`;
    const updated = advanceCyberIncidentStage({
      id: selected.id,
      nextStatus: stage,
      byPersonaId: actorPersona.id,
      addNotifications: { channels: ['teams'], message: msg }
    });
    if (updated) setSelectedId(updated.id);
  }

  function assignTo(pid) {
    if (!selected) return;
    const updated = assignCyberIncident({
      id: selected.id,
      assigneePersonaId: pid,
      byPersonaId: actorPersona.id
    });
    if (updated) setSelectedId(updated.id);
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Incident workflow</div>
          <div className="subtle" style={{ marginTop: 4 }}>
            Functional UI with mock/fallback data: detection → alert → triage → resolution, plus personas and notification placeholders.
          </div>
        </div>

        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <label className="subtle">
            Acting as:&nbsp;
            <select value={actorPersonaId} onChange={(e) => setActorPersonaId(e.target.value)}>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.role}
                </option>
              ))}
            </select>
          </label>

          <label className="subtle">
            Filter:&nbsp;
            <select
              value={filterStage || ''}
              onChange={(e) => {
                const v = e.target.value || null;
                setFilterStage(v);
                window.setTimeout(() => ensureSelected(), 0);
              }}
            >
              <option value="">All stages</option>
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div style={{ height: 12 }} />
      <hr />
      <div style={{ height: 12 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 12 }}>
        {/* Left: queue */}
        <section className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 14 }} aria-label="Incident queue">
          <div className="cardBody">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 900 }}>Queue</div>
              <div className="subtle">{incidents.length} incident(s)</div>
            </div>

            <div style={{ height: 10 }} />

            <div style={{ display: 'grid', gap: 8 }}>
              {incidents.map((it) => {
                const active = it.id === selectedId;
                const sev = sevStyle(it.severity);
                return (
                  <button
                    key={it.id}
                    className="btn"
                    onClick={() => setSelectedId(it.id)}
                    style={{
                      textAlign: 'left',
                      justifyContent: 'space-between',
                      display: 'flex',
                      gap: 10,
                      borderColor: active ? 'rgba(37, 99, 235, 0.35)' : undefined,
                      background: active ? 'rgba(37, 99, 235, 0.06)' : undefined
                    }}
                    aria-label={`Open incident ${it.id}`}
                  >
                    <span style={{ display: 'grid', gap: 2 }}>
                      <span style={{ fontWeight: 800, color: '#111827' }}>{it.title}</span>
                      <span className="subtle">
                        {it.asset} · {it.status} · updated {formatWhen(it.lastUpdatedAt)}
                      </span>
                    </span>

                    <span className="pill" style={{ background: sev.bg, borderColor: sev.border, color: sev.color, fontWeight: 800 }}>
                      {it.severity}
                    </span>
                  </button>
                );
              })}

              {!incidents.length ? <div className="subtle">No incidents match this filter.</div> : null}
            </div>

            <div style={{ height: 12 }} />
            <hr />
            <div style={{ height: 12 }} />

            <div style={{ fontWeight: 900, marginBottom: 6 }}>Create (mock)</div>
            <div className="subtle" style={{ marginBottom: 8 }}>
              Use this to simulate “Detection” events when no backend signals are available.
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <input
                value={createForm.title}
                onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Incident title"
                aria-label="Incident title"
              />
              <input
                value={createForm.asset}
                onChange={(e) => setCreateForm((p) => ({ ...p, asset: e.target.value }))}
                placeholder="Asset (e.g., Substation A / Bay-1)"
                aria-label="Asset"
              />
              <select
                value={createForm.severity}
                onChange={(e) => setCreateForm((p) => ({ ...p, severity: e.target.value }))}
                aria-label="Severity"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <textarea
                value={createForm.summary}
                onChange={(e) => setCreateForm((p) => ({ ...p, summary: e.target.value }))}
                placeholder="Summary"
                aria-label="Summary"
                rows={3}
              />
              <button
                className="btn btnPrimary"
                onClick={() => {
                  const inc = createCyberIncident({
                    title: createForm.title || 'New incident (mock)',
                    summary: createForm.summary || 'No summary provided.',
                    severity: createForm.severity,
                    asset: createForm.asset || 'Unknown asset',
                    byPersonaId: actorPersona.id
                  });
                  setSelectedId(inc.id);
                  setCreateForm({ title: '', summary: '', severity: 'Low', asset: '' });
                }}
              >
                Create detection
              </button>
            </div>
          </div>
        </section>

        {/* Right: details */}
        <section className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 14 }} aria-label="Incident details">
          <div className="cardBody">
            {selected ? (
              <>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: 18 }}>{selected.title}</div>
                    <div className="subtle" style={{ marginTop: 4 }}>
                      {selected.id} · {selected.asset}
                    </div>
                  </div>

                  <div className="row" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn" onClick={() => moveNext({ withNotifications: false })}>
                      Move to next stage
                    </button>
                    <button className="btn btnPrimary" onClick={() => moveNext({ withNotifications: true })}>
                      Move + notify (placeholder)
                    </button>
                  </div>
                </div>

                <div style={{ height: 10 }} />
                <StageRail stage={selected.status} />

                <div style={{ height: 10 }} />
                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: 'rgba(17, 24, 39, 0.06)',
                    overflow: 'hidden'
                  }}
                  aria-label="Workflow progress"
                  title="Workflow progress"
                >
                  <div style={{ width: `${progress01 * 100}%`, height: '100%', background: 'rgba(37, 99, 235, 0.55)' }} />
                </div>

                <div style={{ height: 12 }} />
                <div className="kv">
                  <div className="kvKey">Severity</div>
                  <div className="kvVal">
                    <span className="pill" style={{ ...sevStyle(selected.severity), fontWeight: 900 }}>
                      {selected.severity}
                    </span>
                  </div>

                  <div className="kvKey">Confidence</div>
                  <div className="kvVal">
                    <span className="pill">{Math.round(clamp01(selected.confidence) * 100)}%</span>
                  </div>

                  <div className="kvKey">Detected</div>
                  <div className="kvVal">
                    <span className="subtle">{formatWhen(selected.detectedAt)}</span>
                  </div>

                  <div className="kvKey">Assignee</div>
                  <div className="kvVal">
                    <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <PersonaBadge persona={selectedAssignee} />
                      <label className="subtle">
                        Assign:&nbsp;
                        <select value={selected.assignedTo || ''} onChange={(e) => assignTo(e.target.value)}>
                          {personas.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · {p.role}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="kvKey">Summary</div>
                  <div className="kvVal">
                    <div className="subtle">{selected.summary}</div>
                  </div>
                </div>

                <div style={{ height: 12 }} />
                <hr />
                <div style={{ height: 12 }} />

                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontWeight: 900 }}>Stage actions</div>
                  <div className="subtle">Quick jump (adds placeholder notification)</div>
                </div>

                <div style={{ height: 8 }} />
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {STAGES.map((s) => (
                    <button
                      key={s.key}
                      className="btn"
                      onClick={() => moveTo(s.key)}
                      disabled={selected.status === s.key}
                      aria-label={`Set stage to ${s.label}`}
                    >
                      Set: {s.label}
                    </button>
                  ))}
                </div>

                <div style={{ height: 12 }} />
                <hr />
                <div style={{ height: 12 }} />

                <div style={{ fontWeight: 900, marginBottom: 8 }}>Signals / indicators</div>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  {(selected.indicators || []).map((x) => (
                    <span key={`${x.label}:${x.value}`} className="pill" title={x.label}>
                      <strong>{x.label}:</strong>&nbsp;<span className="subtle">{x.value}</span>
                    </span>
                  ))}
                  {!selected.indicators?.length ? <span className="subtle">No indicators captured.</span> : null}
                </div>

                <div style={{ height: 12 }} />
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Recommended next actions</div>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {(selected.recommendedActions || []).map((s) => (
                    <li key={s} style={{ marginBottom: 6 }}>
                      <span className="subtle">{s}</span>
                    </li>
                  ))}
                </ol>

                <div style={{ height: 12 }} />
                <hr />
                <div style={{ height: 12 }} />

                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontWeight: 900 }}>Notifications (placeholders)</div>
                  <div className="subtle">No providers configured; these are UX placeholders</div>
                </div>

                <div style={{ height: 8 }} />

                <div style={{ display: 'grid', gap: 8 }}>
                  {(selected.notifications || []).map((n) => (
                    <div key={n.id} className="pill" style={{ display: 'grid', gap: 2 }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <span>
                          <strong>{n.channel}</strong> → <span className="subtle">{n.to}</span>
                        </span>
                        <span className="subtle">{formatWhen(n.createdAt)}</span>
                      </div>
                      <div className="subtle">{n.message}</div>
                      <div className="subtle">
                        Status: <strong>{n.status}</strong>
                      </div>
                    </div>
                  ))}
                  {!selected.notifications?.length ? <div className="subtle">No notifications queued yet.</div> : null}
                </div>

                <div style={{ height: 10 }} />

                <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <label className="subtle">
                    Placeholder channel:&nbsp;
                    <select
                      onChange={(e) => {
                        const ch = e.target.value;
                        const msg = `Manual placeholder notification requested by ${actorPersona.name}`;
                        advanceCyberIncidentStage({
                          id: selected.id,
                          nextStatus: selected.status,
                          byPersonaId: actorPersona.id,
                          addNotifications: { channels: [ch], message: msg }
                        });
                        setSelectedId(selected.id);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Select channel…
                      </option>
                      {channels.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <span className="subtle">Tip: “Move + notify” is the intended alerting UX without backend integration.</span>
                </div>

                <div style={{ height: 12 }} />
                <hr />
                <div style={{ height: 12 }} />

                <div style={{ fontWeight: 900, marginBottom: 8 }}>Timeline</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {(selected.timeline || []).slice().reverse().map((t, idx) => (
                    <li key={`${t.at}-${idx}`} style={{ marginBottom: 8 }}>
                      <div className="subtle">
                        <strong>{t.by}</strong> · {formatWhen(t.at)}
                      </div>
                      <div>{t.event}</div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="subtle">Select an incident from the queue.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
