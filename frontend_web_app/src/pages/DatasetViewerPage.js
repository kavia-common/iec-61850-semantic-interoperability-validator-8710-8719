import React, { useMemo } from 'react';
import PageShell from '../components/PageShell';
import { useApp } from '../state/AppContext';

function buildMockDatasets(validationResult) {
  const hasAny = Boolean(validationResult);
  return [
    {
      name: 'GOOSE_DS_Protection',
      type: 'GOOSE',
      entries: hasAny ? 6 : 4,
      status: 'OK'
    },
    {
      name: 'SV_DS_Sampling',
      type: 'SV',
      entries: hasAny ? 12 : 10,
      status: hasAny ? 'Warning' : 'OK'
    }
  ];
}

// PUBLIC_INTERFACE
export default function DatasetViewerPage() {
  /** Dataset viewer (GOOSE/SV) scaffold. */
  const { validationResult } = useApp();
  const datasets = useMemo(() => buildMockDatasets(validationResult), [validationResult]);

  return (
    <PageShell
      title="Dataset Viewer"
      subtitle="Inspect GOOSE/SV datasets and FCDA mappings (scaffold)."
    >
      <table className="table" aria-label="Datasets table">
        <thead>
          <tr>
            <th>Dataset</th>
            <th>Type</th>
            <th>Entries</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {datasets.map((d) => (
            <tr key={d.name}>
              <td>{d.name}</td>
              <td>{d.type}</td>
              <td>{d.entries}</td>
              <td>
                <span className="pill" style={{ color: d.status === 'Warning' ? '#92400e' : undefined }}>
                  {d.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ height: 14 }} />
      <div className="subtle">
        Once the backend contract is available, this view should show datasets, FCDA targets, and cross-IED semantic checks.
      </div>
    </PageShell>
  );
}
