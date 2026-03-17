import React from 'react';
import PageShell from '../components/PageShell';

const mockMappings = [
  { from: 'VendorA: XCBR1.Pos.stVal', to: 'VendorB: CSWI1.Pos.stVal', confidence: 'High' },
  { from: 'VendorA: MMXU1.A.phsA.cVal.mag.f', to: 'VendorB: MMXU1.A.phsA.cVal.mag.f', confidence: 'Medium' },
  { from: 'VendorA: PTRC1.Op.general', to: 'VendorB: PTRC1.Op.general', confidence: 'High' }
];

// PUBLIC_INTERFACE
export default function InteroperabilityMapPage() {
  /** Cross-vendor interoperability mapping scaffold. */
  return (
    <PageShell
      title="Interoperability Map"
      subtitle="Visualize semantic alignment across vendors (LN/DO/DA and SCADA mapping)."
    >
      <table className="table" aria-label="Interoperability mapping table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Target</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {mockMappings.map((m, idx) => (
            <tr key={`${m.from}-${idx}`}>
              <td className="mono">{m.from}</td>
              <td className="mono">{m.to}</td>
              <td>
                <span className="pill">{m.confidence}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ height: 14 }} />
      <div className="subtle">
        Future enhancement: graph view with filters (GOOSE/SV/SCADA), highlight mismatches, and auto-recommend mapping fixes.
      </div>
    </PageShell>
  );
}
