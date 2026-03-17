import React, { useMemo } from 'react';
import PageShell from '../components/PageShell';
import { useApp } from '../state/AppContext';

function buildMockTree(validationResult) {
  const issues = validationResult?.data?.details || [];
  const hasIssues = Array.isArray(issues) && issues.length > 0;

  return {
    name: 'Substation',
    children: [
      {
        name: 'VoltageLevel',
        children: [
          {
            name: 'Bay',
            children: [
              {
                name: 'IED: VendorA-IED1',
                children: [
                  { name: 'LN: XCBR1 (Circuit Breaker)', hint: hasIssues ? 'Issues present' : 'OK' },
                  { name: 'LN: MMXU1 (Measurements)', hint: 'OK' }
                ]
              },
              {
                name: 'IED: VendorB-IED9',
                children: [
                  { name: 'LN: CSWI1 (Switch Controller)', hint: hasIssues ? 'Warnings present' : 'OK' }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

function TreeNode({ node, depth = 0 }) {
  return (
    <div style={{ paddingLeft: depth * 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <strong style={{ fontSize: 13 }}>{node.name}</strong>
        {node.hint ? <span className="pill">{node.hint}</span> : null}
      </div>
      {node.children?.length ? (
        <div style={{ marginTop: 6 }}>
          {node.children.map((c, idx) => (
            <TreeNode key={`${c.name}-${idx}`} node={c} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// PUBLIC_INTERFACE
export default function LnTreePage() {
  /** Logical Node tree explorer (scaffold). Will be wired to parsed SCL structures once backend contract/data model is specified. */
  const { validationResult } = useApp();
  const tree = useMemo(() => buildMockTree(validationResult), [validationResult]);

  return (
    <PageShell
      title="LN Tree"
      subtitle="Explore SCL structure: IEDs, Logical Devices, and Logical Nodes (scaffold visualization)."
    >
      <div className="subtle">
        This module is currently a frontend scaffold. When SCL parsing output is defined, the tree will be driven by real LN/DO/DA structures.
      </div>

      <div style={{ height: 14 }} />

      <div style={{ display: 'grid', gap: 10 }}>
        <TreeNode node={tree} />
      </div>
    </PageShell>
  );
}
