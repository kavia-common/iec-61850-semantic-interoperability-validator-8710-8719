import React from 'react';
import PageShell from '../components/PageShell';

const mockPoints = [
  { point: 'BRK_101_STATUS', ln: 'XCBR1', path: 'Pos.stVal', vendor: 'VendorA', quality: 'OK' },
  { point: 'BRK_101_CMD', ln: 'CSWI1', path: 'Pos.ctlVal', vendor: 'VendorB', quality: 'Warning' },
  { point: 'BUS_VA', ln: 'MMXU1', path: 'A.phsA.cVal.mag.f', vendor: 'VendorA', quality: 'OK' }
];

// PUBLIC_INTERFACE
export default function ScadaTablePage() {
  /** SCADA mapping table scaffold. */
  return (
    <PageShell
      title="SCADA Table"
      subtitle="Review SCADA point naming, paths, and vendor mappings (scaffold)."
    >
      <table className="table" aria-label="SCADA mapping table">
        <thead>
          <tr>
            <th>Point</th>
            <th>LN</th>
            <th>Path</th>
            <th>Vendor</th>
            <th>Quality</th>
          </tr>
        </thead>
        <tbody>
          {mockPoints.map((p) => (
            <tr key={p.point}>
              <td><strong>{p.point}</strong></td>
              <td>{p.ln}</td>
              <td className="mono">{p.path}</td>
              <td>{p.vendor}</td>
              <td>
                <span className="pill" style={{ color: p.quality === 'Warning' ? '#92400e' : undefined }}>
                  {p.quality}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ height: 14 }} />
      <div className="subtle">
        Future enhancement: CSV import/export, naming rules, and remediation suggestions integrated with validation report.
      </div>
    </PageShell>
  );
}
