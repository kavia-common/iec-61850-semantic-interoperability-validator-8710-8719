import React from 'react';
import PageShell from '../../components/PageShell';
import { CyberIncidentBoard } from '../../components/CyberIncidentUI';

// PUBLIC_INTERFACE
export default function CyberTriagePage() {
  /** Triage stage: investigation, evidence, and decisioning before containment/recovery. */
  return (
    <PageShell
      title="Triage"
      subtitle="Investigate and decide: assess severity, validate indicators, assign personas, and determine containment steps."
      actions={null}
    >
      <CyberIncidentBoard initialFilterStage="triage" />
    </PageShell>
  );
}
