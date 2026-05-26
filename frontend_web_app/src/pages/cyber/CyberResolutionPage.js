import React from 'react';
import PageShell from '../../components/PageShell';
import { CyberIncidentBoard } from '../../components/CyberIncidentUI';

// PUBLIC_INTERFACE
export default function CyberResolutionPage() {
  /** Resolution stage: containment, eradication, recovery, and closure (mock). */
  return (
    <PageShell
      title="Resolution"
      subtitle="Containment and closure actions. Record resolution progress and ensure post-incident follow-ups are captured in the timeline."
      actions={null}
    >
      <CyberIncidentBoard initialFilterStage="resolution" />
    </PageShell>
  );
}
