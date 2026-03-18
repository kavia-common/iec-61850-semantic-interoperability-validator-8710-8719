import React, { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { useApp } from '../state/AppContext';

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function formatPct(x) {
  if (!Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(1)}%`;
}

function riskLabel(score01) {
  const s = clamp01(score01);
  if (s >= 0.75) return { label: 'High', color: '#991b1b', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.30)' };
  if (s >= 0.45) return { label: 'Medium', color: '#92400e', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.30)' };
  return { label: 'Low', color: '#065f46', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.30)' };
}

function getAnomalySummary(validationResult) {
  /**
   * Extract anomaly detection summary from whatever shape is available.
   *
   * We intentionally tolerate multiple potential shapes because:
   * - Some modules compute anomalies client-side (AnomalyDetectionPage stores its own state)
   * - Backend validation may later include anomaly results in validationResult
   */
  const candidates = [
    validationResult?.anomaly,
    validationResult?.anomalies,
    validationResult?.anomalyDetection,
    validationResult?.results?.anomaly,
    validationResult?.results?.anomalies
  ].filter(Boolean);

  const raw = candidates[0] || null;
  if (!raw) return null;

  // Common expected fields (best-effort):
  const rows = raw?.summary?.rows ?? raw?.rows ?? null;
  const outliers = raw?.summary?.outliers ?? raw?.outliersCount ?? raw?.outliers?.length ?? null;
  const outlierRate = raw?.summary?.outlierRate ?? raw?.outlierRate ?? (rows && outliers ? outliers / rows : null);

  // Include a few top contributing features if present.
  const topFeatures =
    raw?.outliers?.[0]?.topFeatures?.map((f) => f?.feature).filter(Boolean).slice(0, 5) ??
    raw?.topFeatures?.slice?.(0, 5) ??
    [];

  return {
    rows,
    outliers,
    outlierRate,
    topFeatures
  };
}

function computeRiskScore01({ anomalySummary, validationResult }) {
  // Start with a small baseline risk if anything has been uploaded/validated.
  let score = 0.15;

  // Factor anomaly rate if available.
  if (anomalySummary?.outlierRate != null) {
    // Treat 0% => +0, 10% => ~+0.45, 20%+ saturates.
    score += clamp01(anomalySummary.outlierRate / 0.2) * 0.55;
  }

  // Factor presence of validation issues if present.
  const issueCount =
    validationResult?.summary?.issues ??
    validationResult?.issues?.length ??
    validationResult?.errors?.length ??
    validationResult?.warnings?.length ??
    null;

  if (Number.isFinite(issueCount)) {
    // 0 => +0, 10 => +0.35, 20+ saturates.
    score += clamp01(issueCount / 20) * 0.35;
  }

  return clamp01(score);
}

function RecommendationCard({ title, priority, impact, description, steps, evidencePills }) {
  const pr = riskLabel(priority);

  return (
    <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 14 }}>
      <div className="cardBody">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>{title}</div>
            <div className="subtle" style={{ marginTop: 4 }}>
              {description}
            </div>
          </div>

          <div
            className="pill"
            style={{
              background: pr.bg,
              borderColor: pr.border,
              color: pr.color,
              fontWeight: 700
            }}
            aria-label={`Priority ${pr.label}`}
            title="Priority derived from risk indicators"
          >
            {pr.label} priority
          </div>
        </div>

        <div style={{ height: 10 }} />

        {evidencePills?.length ? (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {evidencePills.map((p) => (
              <span key={p} className="pill">
                {p}
              </span>
            ))}
          </div>
        ) : null}

        <div style={{ height: 10 }} />

        <div className="kv" style={{ marginTop: 6 }}>
          <div className="kvKey">Expected impact</div>
          <div className="kvVal">
            <span className="subtle">{impact}</span>
          </div>

          <div className="kvKey">Suggested steps</div>
          <div className="kvVal">
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {steps.map((s) => (
                <li key={s} style={{ marginBottom: 6 }}>
                  <span className="subtle">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
export default function RecommendationsPage() {
  /** Dashboard-style page that summarizes anomaly detection and provides actionable cybersecurity recommendations. */
  const { validationResult, lastUpload } = useApp();

  const anomalySummary = useMemo(() => getAnomalySummary(validationResult), [validationResult]);
  const riskScore01 = useMemo(
    () => computeRiskScore01({ anomalySummary, validationResult }),
    [anomalySummary, validationResult]
  );

  const risk = riskLabel(riskScore01);

  const hasAnyResult = Boolean(validationResult);
  const hasAnomaly = Boolean(anomalySummary);

  const summaryCards = useMemo(() => {
    const issuesCount =
      validationResult?.summary?.issues ??
      validationResult?.issues?.length ??
      validationResult?.errors?.length ??
      null;

    const uploadName = lastUpload?.fileName || lastUpload?.name || null;

    return [
      {
        title: 'Overall posture',
        value: risk.label,
        subtitle: `Composite risk score: ${Math.round(riskScore01 * 100)}/100`,
        accent: { bg: risk.bg, border: risk.border, color: risk.color }
      },
      {
        title: 'Validation issues',
        value: issuesCount == null ? '—' : String(issuesCount),
        subtitle: hasAnyResult ? 'From latest validation result' : 'Run validation to populate',
        accent: null
      },
      {
        title: 'Anomaly findings',
        value: hasAnomaly && anomalySummary?.outliers != null ? String(anomalySummary.outliers) : '—',
        subtitle:
          hasAnomaly && anomalySummary?.outlierRate != null
            ? `Outlier rate: ${formatPct(anomalySummary.outlierRate)}`
            : 'No anomaly summary available yet',
        accent: null
      },
      {
        title: 'Current dataset',
        value: uploadName ? 'Loaded' : '—',
        subtitle: uploadName ? uploadName : 'Upload SCL or run Anomaly Detection',
        accent: null
      }
    ];
  }, [hasAnyResult, hasAnomaly, anomalySummary, lastUpload, risk, riskScore01, validationResult]);

  const recommendations = useMemo(() => {
    // Evidence helpers
    const evidence = [];
    if (hasAnomaly && anomalySummary?.outlierRate != null) {
      evidence.push(`Outlier rate: ${formatPct(anomalySummary.outlierRate)}`);
    }
    if (anomalySummary?.topFeatures?.length) {
      evidence.push(`Top features: ${anomalySummary.topFeatures.join(', ')}`);
    }

    // Tuned mock/fallback recommendations that remain relevant even without results.
    return [
      {
        title: 'Harden access control & credential hygiene',
        priority: hasAnyResult ? 0.65 : 0.55,
        impact:
          'Reduces risk of unauthorized configuration changes and lateral movement in OT/SCADA environments.',
        description:
          'IEC 61850 engineering workflows often touch multiple systems (IEDs, gateways, historians). Enforce least privilege and strong authentication across tooling and endpoints.',
        steps: [
          'Enforce role-based access control (RBAC) for engineering tools and configuration repos.',
          'Disable default credentials on IEDs/gateways; require MFA on jump hosts and VPN.',
          'Rotate secrets used for automation (CI, validation pipelines) and store them in a vault.',
          'Log and alert on privileged actions (SCL uploads, dataset changes, mapping edits).'
        ],
        evidencePills: evidence.length ? evidence : ['Best practice baseline']
      },
      {
        title: 'Segment networks and restrict IEC 61850 traffic paths',
        priority: hasAnomaly ? 0.75 : 0.6,
        impact: 'Limits blast radius and reduces likelihood of malicious GOOSE/SV misuse.',
        description:
          'Ensure protection/control networks are segmented from corporate IT and limit where GOOSE/SV, MMS, and engineering protocols can traverse.',
        steps: [
          'Place IEDs and SCADA servers in dedicated zones with strict firewall rules.',
          'Restrict MMS/engineering access to jump hosts; block from user subnets.',
          'Use allow-listing for critical multicast (GOOSE/SV) at switches where feasible.',
          'Continuously verify that routing/VLAN configurations match the intended design.'
        ],
        evidencePills: hasAnomaly ? evidence : ['OT segmentation recommendation']
      },
      {
        title: 'Investigate outliers and validate telemetry integrity',
        priority: hasAnomaly && (anomalySummary?.outlierRate ?? 0) > 0.02 ? 0.85 : 0.55,
        impact: 'Detects misconfigurations and potential data manipulation impacting operator decisions.',
        description:
          'Outliers can indicate benign process events, sensor faults, mis-mapped points, or adversarial manipulation. Triaging outliers improves both cyber and reliability outcomes.',
        steps: [
          'Open the Anomaly Detection module and inspect highest-scoring rows first.',
          'Cross-check outlier features against expected engineering ranges and device specs.',
          'Validate mapping for affected points (SCADA table / interoperability map).',
          'Create a playbook for recurring outlier signatures (fault vs. attack vs. maintenance).'
        ],
        evidencePills: hasAnomaly
          ? evidence
          : ['No anomaly results found — run Anomaly Detection to populate']
      },
      {
        title: 'Strengthen change control for SCL and configuration artifacts',
        priority: hasAnyResult ? 0.7 : 0.55,
        impact: 'Prevents drift, enables rapid rollback, and supports audits.',
        description:
          'Treat SCL files, dataset definitions, and mappings as controlled configuration. Add traceability between vendor files and deployed configurations.',
        steps: [
          'Store SCL files and derived reports in a version-controlled repository.',
          'Require peer review for changes to datasets and SCADA point mappings.',
          'Record tool versions and validation outputs as build artifacts.',
          'Automate regression validation on each change (CI job / scheduled run).'
        ],
        evidencePills: ['Governance & compliance']
      }
    ];
  }, [anomalySummary, hasAnomaly, hasAnyResult]);

  return (
    <PageShell
      title="Recommendations"
      subtitle="Actionable cybersecurity improvements based on available validation and anomaly findings."
      actions={
        <>
          <NavLink to="/anomaly" className="btn">
            Go to Anomaly Detection
          </NavLink>
          <NavLink to="/report" className="btn btnPrimary">
            Go to Validation Report
          </NavLink>
        </>
      }
    >
      <div className="subtle">
        This dashboard uses available results when present and falls back to sensible guidance when they are not.
      </div>

      <div style={{ height: 12 }} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12
        }}
      >
        {summaryCards.map((c) => (
          <div
            key={c.title}
            className="card"
            style={{
              boxShadow: 'var(--shadow-sm)',
              borderRadius: 14,
              borderColor: c.accent?.border
            }}
          >
            <div className="cardBody">
              <div className="subtle" style={{ marginBottom: 6 }}>
                {c.title}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: c.accent?.color || '#111827' }}>{c.value}</div>
              <div className="subtle" style={{ marginTop: 6 }}>
                {c.subtitle}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 14 }} />
      <hr />
      <div style={{ height: 14 }} />

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Recommended actions</div>
        <div className="subtle">
          {hasAnyResult ? 'Derived from latest results (when available)' : 'Baseline guidance (no results yet)'}
        </div>
      </div>

      <div style={{ height: 10 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        {recommendations.map((r) => (
          <RecommendationCard
            key={r.title}
            title={r.title}
            priority={r.priority}
            impact={r.impact}
            description={r.description}
            steps={r.steps}
            evidencePills={r.evidencePills}
          />
        ))}
      </div>

      <div style={{ height: 14 }} />
      <hr />
      <div style={{ height: 14 }} />

      <div className="card" style={{ boxShadow: 'var(--shadow-sm)', borderRadius: 14 }}>
        <div className="cardBody">
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Next steps</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li className="subtle" style={{ marginBottom: 6 }}>
              If you haven’t run anomaly detection yet, open <NavLink to="/anomaly">Anomaly Detection</NavLink> and click
              “Run detection”.
            </li>
            <li className="subtle" style={{ marginBottom: 6 }}>
              Review the <NavLink to="/report">Validation Report</NavLink> for IEC 61850 semantic issues and mapping gaps.
            </li>
            <li className="subtle">
              Use <NavLink to="/scada">SCADA Table</NavLink> and <NavLink to="/interop-map">Interoperability Map</NavLink>{' '}
              to validate point naming, dataset coverage, and cross-vendor alignment.
            </li>
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
