import React, { useMemo } from 'react';
import PageShell from '../../components/PageShell';
import { CyberIncidentBoard } from '../../components/CyberIncidentUI';
import { getCyberPersonas, listCyberIncidents } from '../../state/cyberMockData';

function countByStage(incidents) {
  const out = { detection: 0, alert: 0, triage: 0, resolution: 0 };
  for (const i of incidents) out[i.status] = (out[i.status] || 0) + 1;
  return out;
}

// PUBLIC_INTERFACE
export default function CyberOverviewPage() {
  /** Cybersecurity overview: personas + queue summary + embedded incident board (mock/fallback). */
  const personas = useMemo(() => getCyberPersonas(), []);
  const incidents = useMemo(() => listCyberIncidents(), []);
  const counts = useMemo(() => countByStage(incidents), [incidents]);

  return (
    <PageShell
      title="Cybersecurity Workflow"
      subtitle="Incident workflow UI (detection → alert → triage → resolution) aligned to the app's navigation model; uses mock data when backend APIs are unavailable."
      actions={null}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12
        }}
      >
        {[
          { k: 'detection', label: 'Detection', v: counts.detection },
          { k: 'alert', label: 'Alert', v: counts.alert },
          { k: 'triage', label: 'Triage', v: counts.triage },
          { k: 'resolution', label: 'Resolution', v: counts.resolution }
        ].map((c) => (
          <div key={c.k} className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 14 }}>
            <div className="cardBody">
              <div className="subtle">{c.label}</div>
              <div style={{ fontSize: 26, fontWeight: 950, marginTop: 6 }}>{c.v}</div>
              <div className="subtle" style={{ marginTop: 6 }}>
                incident(s)
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 14 }} />
      <hr />
      <div style={{ height: 14 }} />

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Personas</div>
        <div className="subtle">Used to model responsibilities & handoffs</div>
      </div>

      <div style={{ height: 10 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {personas.map((p) => (
          <div key={p.id} className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 14 }}>
            <div className="cardBody">
              <div style={{ fontWeight: 950 }}>{p.name}</div>
              <div className="subtle" style={{ marginTop: 4 }}>
                {p.role}
              </div>
              <div className="subtle" style={{ marginTop: 8 }}>
                {p.focus}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 14 }} />
      <hr />
      <div style={{ height: 14 }} />

      <CyberIncidentBoard />
    </PageShell>
  );
}
