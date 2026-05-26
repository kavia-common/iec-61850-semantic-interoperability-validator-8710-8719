import React from 'react';
import PageShell from '../../components/PageShell';
import { CyberIncidentBoard } from '../../components/CyberIncidentUI';

// PUBLIC_INTERFACE
export default function CyberAlertPage() {
  /** Alerting stage: notification routing and stakeholder awareness (placeholder notifications). */
  return (
    <PageShell
      title="Alerting"
      subtitle="Alert routing and notification placeholders (Email/SMS/Teams/PagerDuty). Move incidents forward and queue placeholder notifications."
      actions={null}
    >
      <CyberIncidentBoard initialFilterStage="alert" />
    </PageShell>
  );
}
