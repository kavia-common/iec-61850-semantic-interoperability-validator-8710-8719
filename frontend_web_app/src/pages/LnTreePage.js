import React, { useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { useApp } from '../state/AppContext';
import { buildLnTree, formatTreeSourceLabel, getNodeHint, getNodeKindLabel } from './lnTree/buildLnTree';

function kindBadgeStyle(kind) {
  // Minimal, consistent styling without adding dependencies.
  if (kind === 'ied') return { background: 'rgba(37, 99, 235, 0.10)', borderColor: 'rgba(37, 99, 235, 0.22)', color: 'rgba(37, 99, 235, 0.95)' };
  if (kind === 'ld') return { background: 'rgba(17, 24, 39, 0.04)', borderColor: 'rgba(17, 24, 39, 0.10)', color: 'rgba(17, 24, 39, 0.80)' };
  if (kind === 'ln') return { background: 'rgba(245, 158, 11, 0.14)', borderColor: 'rgba(245, 158, 11, 0.22)', color: 'rgba(146, 64, 14, 1)' };
  return { background: 'rgba(17, 24, 39, 0.02)', borderColor: 'rgba(17, 24, 39, 0.08)', color: 'rgba(17, 24, 39, 0.75)' };
}

function severityHintStyle(hint) {
  const h = String(hint || '').toLowerCase();
  if (h.includes('error')) return { borderColor: 'rgba(239, 68, 68, 0.35)', color: '#991b1b' };
  if (h.includes('warning')) return { borderColor: 'rgba(245, 158, 11, 0.35)', color: '#92400e' };
  if (h.includes('issue')) return { borderColor: 'rgba(239, 68, 68, 0.22)', color: '#991b1b' };
  return {};
}

function Toggle({ expanded, onToggle, label }) {
  return (
    <button
      type="button"
      className="btn btnGhost"
      onClick={onToggle}
      aria-label={label}
      style={{
        padding: '6px 8px',
        borderRadius: 10,
        lineHeight: 1,
        fontWeight: 700,
        color: 'rgba(17, 24, 39, 0.65)'
      }}
    >
      {expanded ? '▾' : '▸'}
    </button>
  );
}

function TreeRow({ node, depth, expanded, canExpand, onToggle, onSelect, selected }) {
  const hint = getNodeHint(node);

  return (
    <div
      role="treeitem"
      aria-expanded={canExpand ? expanded : undefined}
      aria-selected={selected ? 'true' : 'false'}
      style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr auto',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        borderRadius: 12,
        border: selected ? '1px solid rgba(37, 99, 235, 0.28)' : '1px solid transparent',
        background: selected ? 'rgba(37, 99, 235, 0.06)' : 'transparent',
        marginLeft: depth * 14,
        cursor: 'pointer'
      }}
      onClick={() => onSelect(node)}
    >
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {canExpand ? (
          <Toggle
            expanded={expanded}
            onToggle={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
          />
        ) : (
          <span aria-hidden="true" style={{ opacity: 0.35 }}>
            •
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
        <span
          className="pill"
          title={getNodeKindLabel(node.kind)}
          style={{
            ...kindBadgeStyle(node.kind),
            fontSize: 11,
            padding: '5px 9px'
          }}
        >
          {getNodeKindLabel(node.kind)}
        </span>

        <strong style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {node.name}
        </strong>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {hint ? (
          <span className="pill" style={{ ...severityHintStyle(hint), fontSize: 12 }}>
            {hint}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TreeView({ root, expandedIds, onToggle, onSelect, selectedId }) {
  function renderNode(node, depth) {
    const children = node.children || [];
    const canExpand = children.length > 0;
    const expanded = expandedIds.has(node.id);

    return (
      <div key={node.id}>
        <TreeRow
          node={node}
          depth={depth}
          canExpand={canExpand}
          expanded={expanded}
          onToggle={onToggle}
          onSelect={onSelect}
          selected={selectedId === node.id}
        />
        {canExpand && expanded ? (
          <div role="group" aria-label={`${node.name} children`} style={{ marginTop: 4 }}>
            {children.map((c) => renderNode(c, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div role="tree" aria-label="Logical node tree" style={{ display: 'grid', gap: 4 }}>
      {renderNode(root, 0)}
    </div>
  );
}

// PUBLIC_INTERFACE
export default function LnTreePage() {
  /** Logical Node tree explorer driven by parsed SCL / validation results (with robust fallback). */
  const { validationResult } = useApp();

  const { tree, source, diagnostics } = useMemo(
    () => buildLnTree(validationResult),
    [validationResult]
  );

  const [expandedIds, setExpandedIds] = useState(() => new Set([tree.id])); // expand root by default
  const [selectedId, setSelectedId] = useState(tree.id);

  // If tree root changes (new run), reset expansion/selection deterministically.
  React.useEffect(() => {
    setExpandedIds(new Set([tree.id]));
    setSelectedId(tree.id);
  }, [tree.id]);

  const selectedNode = useMemo(() => {
    // Simple DFS lookup; tree size is expected to be modest for UI.
    const stack = [tree];
    while (stack.length) {
      const n = stack.pop();
      if (!n) break;
      if (n.id === selectedId) return n;
      if (n.children?.length) {
        for (const c of n.children) stack.push(c);
      }
    }
    return tree;
  }, [tree, selectedId]);

  return (
    <PageShell
      title="LN Tree"
      subtitle="Browse Logical Nodes derived from parsed SCL output and/or validation references."
      actions={
        <div className="row">
          <span className="pill" title={diagnostics?.reason || ''}>
            Source: {formatTreeSourceLabel(source)}
          </span>
          <button
            className="btn"
            onClick={() => {
              // Expand all nodes quickly
              const all = new Set();
              const stack = [tree];
              while (stack.length) {
                const n = stack.pop();
                if (!n) break;
                all.add(n.id);
                if (n.children?.length) {
                  for (const c of n.children) stack.push(c);
                }
              }
              setExpandedIds(all);
            }}
          >
            Expand all
          </button>
          <button
            className="btn"
            onClick={() => {
              // Collapse to just root
              setExpandedIds(new Set([tree.id]));
            }}
          >
            Collapse all
          </button>
        </div>
      }
    >
      <div className="subtle">
        {source === 'parsedScl'
          ? 'Rendering from parsed SCL structure found in the current validation payload.'
          : source === 'validationDetails'
            ? 'No parsed SCL structure found; rendering derived tree by grouping validation items by inferred IED/LD/LN references.'
            : 'No backend-derived structure available; rendering fallback mock tree so you can explore the UI.'}
      </div>

      {source === 'parsedScl' && diagnostics?.parsedKeys?.length ? (
        <div style={{ marginTop: 10 }} className="subtle">
          Parsed payload keys: <span className="mono">{diagnostics.parsedKeys.join(', ')}</span>
        </div>
      ) : null}

      <div style={{ height: 14 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: 12 }}>
        <div className="card" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div className="cardBody">
            <TreeView
              root={tree}
              expandedIds={expandedIds}
              selectedId={selectedId}
              onToggle={(id) => {
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              }}
              onSelect={(node) => {
                setSelectedId(node.id);
                if (node.children?.length) {
                  // Convenience: selecting a parent expands it
                  setExpandedIds((prev) => new Set(prev).add(node.id));
                }
              }}
            />
          </div>
        </div>

        <div className="card" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div className="cardBody">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 13 }}>Selection</strong>
              <span className="pill" style={kindBadgeStyle(selectedNode.kind)}>
                {getNodeKindLabel(selectedNode.kind)}
              </span>
            </div>

            <div style={{ height: 10 }} />

            <div className="kv">
              <div className="kvKey">Name</div>
              <div className="kvVal">{selectedNode.name}</div>

              <div className="kvKey">Id</div>
              <div className="kvVal"><span className="mono">{selectedNode.id}</span></div>

              <div className="kvKey">Hint</div>
              <div className="kvVal">{getNodeHint(selectedNode) || <span className="subtle">—</span>}</div>

              <div className="kvKey">Children</div>
              <div className="kvVal">{selectedNode.children?.length || 0}</div>
            </div>

            <div style={{ height: 12 }} />
            <div className="subtle">
              Next step: clicking an LN can deep-link to related validation items (by LN reference) once the backend payload schema is finalized.
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
