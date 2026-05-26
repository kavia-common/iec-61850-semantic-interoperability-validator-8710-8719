import React from 'react';
import PageShell from '../../components/PageShell';
import { CyberIncidentBoard } from '../../components/CyberIncidentUI';

// PUBLIC_INTERFACE
export default function CyberDetectionPage() {
  /** Detection stage: show incidents currently in detection and allow creating new detections (mock). */
  return (
    <PageShell
      title="Detection"
      subtitle="Signals and indicators that originate a cybersecurity incident. Create mock detections when no backend telemetry is connected."
      actions={null}
    >
      <CyberIncidentBoard initialFilterStage="detection" />
    </PageShell>
  );
}
