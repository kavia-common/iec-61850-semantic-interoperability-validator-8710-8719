import React, { useMemo } from 'react';
import PageShell from '../components/PageShell';
import { useApp } from '../state/AppContext';

function severityColor(sev) {
  if (sev === 'error') return 'rgba(239, 68, 68, 0.15)';
  if (sev === 'warning') return 'rgba(245, 158, 11, 0.18)';
  return 'rgba(37, 99, 235, 0.12)';
}

function normalize(validationResult) {
  const details = validationResult?.data?.details;
  if (Array.isArray(details) && details.length) return details;

  return [
    { severity: 'info', code: 'INFO-000', message: 'Run validation from File Upload to see issues and recommendations here.' }
  ];
}

// PUBLIC_INTERFACE
export default function ValidationReportPage() {
  /** Validation report (issues/warnings/recommendations). */
  const { validationResult } = useApp();
  const items = useMemo(() => normalize(validationResult), [validationResult]);

  return (
    <PageShell
      title="Validation Report"
      subtitle="Review semantic issues and recommended fixes for IEC 61850 compliance."
      actions={
        validationResult ? (
          <a
            className="btn"
            href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(validationResult, null, 2))}`}
            download="siv-validation-result.json"
          >
            Download JSON
          </a>
        ) : null
      }
    >
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((it, idx) => (
          <div
            key={`${it.code}-${idx}`}
            className="card"
            style={{ boxShadow: 'var(--shadow-sm)', background: severityColor(it.severity) }}
          >
            <div className="cardBody">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="row">
                  <span className="pill">{it.severity?.toUpperCase?.() || 'INFO'}</span>
                  <strong style={{ fontSize: 13 }}>{it.code}</strong>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 13 }}>{it.message}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 14 }} />
      <div className="subtle">
        Future enhancement: include clickable references (IED/LN/DO/DA path), suggested SCL edits, and vendor-specific mappings.
      </div>
    </PageShell>
  );
}
