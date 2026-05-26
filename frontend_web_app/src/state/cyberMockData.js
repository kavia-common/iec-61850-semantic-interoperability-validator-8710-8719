import { addRunRecord } from './runHistory';

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

const PERSONAS = [
  {
    id: 'p_ot_engineer',
    name: 'Ava (OT Engineer)',
    role: 'OT Engineering',
    focus: 'Substation operations, IED configuration, SCL validity'
  },
  {
    id: 'p_soc_analyst',
    name: 'Noah (SOC Analyst)',
    role: 'SOC',
    focus: 'Alert review, incident triage, escalation, communications'
  },
  {
    id: 'p_plant_manager',
    name: 'Mia (Plant Manager)',
    role: 'Operations',
    focus: 'Service continuity, risk acceptance, stakeholder updates'
  },
  {
    id: 'p_ir_lead',
    name: 'Ethan (IR Lead)',
    role: 'Incident Response',
    focus: 'Containment, eradication, recovery, post-incident actions'
  }
];

const CHANNELS = [
  { key: 'email', label: 'Email' },
  { key: 'sms', label: 'SMS' },
  { key: 'teams', label: 'MS Teams' },
  { key: 'pager', label: 'PagerDuty' }
];

// A small OT-focused incident seed set; the UI can operate without any backend.
const INITIAL_INCIDENTS = [
  {
    id: 'inc_001',
    title: 'GOOSE burst anomaly near Bay-2 protection IED',
    summary:
      'Detected abnormal GOOSE publication burst inconsistent with baseline. Potential misconfiguration, loop, or malicious injection.',
    severity: 'High',
    status: 'triage', // detection | alert | triage | resolution
    asset: 'Substation A / Bay-2 / PIOC1',
    detectedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    lastUpdatedAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    confidence: 0.82,
    indicators: [
      { label: 'GOOSE rate spike', value: '+320% vs baseline' },
      { label: 'MAC source variance', value: '2 unexpected MACs observed' },
      { label: 'Sequence number drift', value: 'Non-monotonic jumps' }
    ],
    recommendedActions: [
      'Verify switch port mirroring and check for L2 loops',
      'Validate dataset definitions and GOOSE control block settings',
      'Isolate unexpected MAC sources and confirm device inventory'
    ],
    notifications: [
      {
        id: 'n_001',
        channel: 'teams',
        to: 'SOC Channel',
        status: 'placeholder',
        createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
        message: 'High severity: GOOSE burst anomaly detected (Bay-2). Triage requested.'
      }
    ],
    assignedTo: 'p_soc_analyst',
    timeline: [
      {
        at: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
        by: 'System',
        event: 'Detection created from anomaly signal.'
      },
      {
        at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
        by: 'System',
        event: 'Alert routing initiated (placeholder notifications).'
      },
      {
        at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        by: 'Noah (SOC Analyst)',
        event: 'Triage started; collecting packet captures and switch logs.'
      }
    ]
  },
  {
    id: 'inc_002',
    title: 'Unexpected SCADA point remap in gateway configuration',
    summary:
      'SCADA mapping table shows a remap of breaker status points. Could be engineering change, drift, or unauthorized modification.',
    severity: 'Medium',
    status: 'alert',
    asset: 'Gateway G1 / SCADA mapping',
    detectedAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    lastUpdatedAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
    confidence: 0.63,
    indicators: [
      { label: 'Point alias change', value: '52A_ST changed to 52A_STATUS' },
      { label: 'Change control', value: 'No approved ticket found (mock)' }
    ],
    recommendedActions: [
      'Confirm whether an engineering change window occurred',
      'Diff mapping config against last known good baseline',
      'Audit credentials and access logs for gateway'
    ],
    notifications: [
      {
        id: 'n_002',
        channel: 'email',
        to: 'OT Engineering',
        status: 'placeholder',
        createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        message: 'Mapping drift detected in gateway G1. Please verify recent changes.'
      }
    ],
    assignedTo: 'p_ot_engineer',
    timeline: [
      {
        at: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
        by: 'System',
        event: 'Detection created from config drift heuristic.'
      },
      {
        at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        by: 'System',
        event: 'Alert queued for OT Engineering (placeholder email).'
      }
    ]
  }
];

let _incidents = [...INITIAL_INCIDENTS];

function toSorted(incidents) {
  return [...incidents].sort((a, b) => String(b.lastUpdatedAt).localeCompare(String(a.lastUpdatedAt)));
}

// PUBLIC_INTERFACE
export function getCyberPersonas() {
  /** Return supported personas for the incident workflow UI. */
  return [...PERSONAS];
}

// PUBLIC_INTERFACE
export function getCyberNotificationChannels() {
  /** Return supported notification channels (placeholders; no backend integration yet). */
  return [...CHANNELS];
}

// PUBLIC_INTERFACE
export function listCyberIncidents() {
  /** List incidents in descending order of lastUpdatedAt. */
  return toSorted(_incidents);
}

// PUBLIC_INTERFACE
export function getCyberIncidentById(id) {
  /** Retrieve a single incident by id (or null). */
  return _incidents.find((x) => x.id === id) || null;
}

function appendTimeline(incident, { by, event, at }) {
  const t = {
    at: at || nowIso(),
    by: by || 'System',
    event: event || 'Updated.'
  };
  return { ...incident, timeline: [...(incident.timeline || []), t] };
}

function pushPlaceholderNotifications(incident, { createdByPersonaId, channels, message }) {
  const persona = PERSONAS.find((p) => p.id === createdByPersonaId) || PERSONAS[1];
  const baseMsg = message || `Incident ${incident.id} updated: ${incident.title}`;
  const createdAt = nowIso();

  const notifs = (channels || ['teams']).map((ch) => ({
    id: uid('notif'),
    channel: ch,
    to:
      ch === 'email'
        ? 'Distribution List'
        : ch === 'sms'
          ? 'On-call phone'
          : ch === 'pager'
            ? 'IR on-call'
            : 'SOC Channel',
    status: 'placeholder', // placeholder | sent | failed
    createdAt,
    message: `${baseMsg} (placeholder; no provider configured)`
  }));

  return appendTimeline(
    { ...incident, notifications: [...(incident.notifications || []), ...notifs] },
    { by: persona.name, event: `Queued ${notifs.length} placeholder notification(s).`, at: createdAt }
  );
}

function updateIncidentInternal(id, updater) {
  const before = getCyberIncidentById(id);
  if (!before) return null;

  const updated = updater(before);
  _incidents = _incidents.map((x) => (x.id === id ? updated : x));
  return updated;
}

// PUBLIC_INTERFACE
export function advanceCyberIncidentStage({ id, nextStatus, byPersonaId, addNotifications }) {
  /**
   * Transition an incident through the workflow (detection → alert → triage → resolution).
   * Optionally queues placeholder notifications for UX completeness.
   */
  const allowed = ['detection', 'alert', 'triage', 'resolution'];
  if (!allowed.includes(nextStatus)) throw new Error(`Invalid nextStatus: ${nextStatus}`);

  const persona = PERSONAS.find((p) => p.id === byPersonaId) || PERSONAS[1];
  const updatedAt = nowIso();

  const updated = updateIncidentInternal(id, (inc) => {
    let out = {
      ...inc,
      status: nextStatus,
      lastUpdatedAt: updatedAt
    };

    out = appendTimeline(out, { by: persona.name, event: `Moved incident to stage: ${nextStatus}.`, at: updatedAt });

    if (addNotifications) {
      out = pushPlaceholderNotifications(out, {
        createdByPersonaId: persona.id,
        channels: addNotifications.channels,
        message: addNotifications.message
      });
    }

    return out;
  });

  if (updated) {
    // Record the workflow transition into run history so it shows up alongside other app operations.
    addRunRecord({
      type: 'cyber_incident',
      status: 'success',
      startedAt: updatedAt,
      completedAt: updatedAt,
      mocked: true,
      summary: {
        incidentId: updated.id,
        title: updated.title,
        nextStatus: updated.status,
        severity: updated.severity
      },
      meta: {
        persona: persona.name
      }
    });
  }

  return updated;
}

// PUBLIC_INTERFACE
export function assignCyberIncident({ id, assigneePersonaId, byPersonaId }) {
  /** Assign an incident to a persona and add a timeline entry. */
  const persona = PERSONAS.find((p) => p.id === byPersonaId) || PERSONAS[1];
  const assignee = PERSONAS.find((p) => p.id === assigneePersonaId) || PERSONAS[0];
  const updatedAt = nowIso();

  return updateIncidentInternal(id, (inc) => {
    const out = appendTimeline(
      {
        ...inc,
        assignedTo: assignee.id,
        lastUpdatedAt: updatedAt
      },
      { by: persona.name, event: `Assigned to ${assignee.name}.`, at: updatedAt }
    );
    return out;
  });
}

// PUBLIC_INTERFACE
export function createCyberIncident({ title, summary, severity, asset, byPersonaId }) {
  /** Create a new incident in detection stage (mock, client-side). */
  const persona = PERSONAS.find((p) => p.id === byPersonaId) || PERSONAS[1];
  const t = nowIso();
  const incident = {
    id: uid('inc'),
    title: title || 'New incident',
    summary: summary || 'No summary provided.',
    severity: severity || 'Low',
    status: 'detection',
    asset: asset || 'Unknown asset',
    detectedAt: t,
    lastUpdatedAt: t,
    confidence: 0.55,
    indicators: [{ label: 'Source', value: 'Manual entry (mock)' }],
    recommendedActions: ['Collect evidence', 'Validate change control', 'Determine containment steps'],
    notifications: [],
    assignedTo: persona.id,
    timeline: [{ at: t, by: persona.name, event: 'Incident created (mock).' }]
  };

  _incidents = [incident, ..._incidents];
  addRunRecord({
    type: 'cyber_incident',
    status: 'success',
    startedAt: t,
    completedAt: t,
    mocked: true,
    summary: { incidentId: incident.id, title: incident.title, nextStatus: incident.status, severity: incident.severity },
    meta: { persona: persona.name }
  });

  return incident;
}
