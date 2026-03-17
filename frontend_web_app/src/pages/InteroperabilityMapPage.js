import React, { useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { useApp } from '../state/AppContext';

/**
 * Interoperability Map visualization (dependency-free).
 *
 * Goals:
 * - Use whatever interoperability/mapping data exists in app state (likely within validationResult).
 * - Be tolerant to unknown backend contract changes.
 * - Always render a useful visualization (fallback mock) when data is missing.
 */

/**
 * @typedef {'High'|'Medium'|'Low'} Confidence
 *
 * @typedef {Object} MappingRow
 * @property {string} from Source reference label (may include vendor prefix)
 * @property {string} to Target reference label (may include vendor prefix)
 * @property {Confidence} confidence
 * @property {string=} kind Optional category like "SCADA", "LN/DO/DA", "GOOSE", "SV"
 *
 * @typedef {Object} GraphNode
 * @property {string} id
 * @property {string} label
 * @property {'source'|'target'} side
 * @property {number} x
 * @property {number} y
 * @property {number} r
 *
 * @typedef {Object} GraphEdge
 * @property {string} id
 * @property {string} fromNodeId
 * @property {string} toNodeId
 * @property {Confidence} confidence
 * @property {string=} kind
 */

/** Small helpers */
function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function clipText(s, max = 44) {
  const str = String(s ?? '');
  if (str.length <= max) return str;
  return `${str.slice(0, Math.max(0, max - 1))}…`;
}

function normalizeConfidence(v) {
  const s = String(v || '').toLowerCase();
  if (s.includes('high')) return 'High';
  if (s.includes('med')) return 'Medium';
  if (s.includes('low')) return 'Low';

  // numeric heuristics (0..1 or 0..100)
  if (typeof v === 'number') {
    if (v >= 0.8 || v >= 80) return 'High';
    if (v >= 0.5 || v >= 50) return 'Medium';
    return 'Low';
  }

  return 'Medium';
}

function confidenceColor(confidence) {
  if (confidence === 'High') return 'rgba(37, 99, 235, 0.95)'; // ocean primary
  if (confidence === 'Medium') return 'rgba(245, 158, 11, 0.95)'; // amber
  return 'rgba(239, 68, 68, 0.9)'; // error red
}

function confidencePillStyle(confidence) {
  if (confidence === 'High') return { borderColor: 'rgba(37, 99, 235, 0.28)', color: 'rgba(37, 99, 235, 0.95)' };
  if (confidence === 'Medium') return { borderColor: 'rgba(245, 158, 11, 0.30)', color: 'rgba(146, 64, 14, 1)' };
  return { borderColor: 'rgba(239, 68, 68, 0.28)', color: '#991b1b' };
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k];
  }
  return undefined;
}

function toMappingRow(obj) {
  if (!obj || typeof obj !== 'object') return null;

  const from = pick(obj, ['from', 'source', 'src', 'left', 'a', 'origin', 'producer', 'fromRef', 'sourceRef', 'sourcePath', 'sourcePoint', 'source_id']);
  const to = pick(obj, ['to', 'target', 'dst', 'right', 'b', 'destination', 'consumer', 'toRef', 'targetRef', 'targetPath', 'targetPoint', 'target_id']);
  if (!from || !to) return null;

  const confidence = normalizeConfidence(pick(obj, ['confidence', 'score', 'similarity', 'match', 'probability']));
  const kind = pick(obj, ['kind', 'category', 'type', 'domain', 'group']);

  return { from: String(from), to: String(to), confidence, kind: kind ? String(kind) : undefined };
}

function buildRobustMockMappings(validationResult) {
  const hasAnyIssues = safeArray(validationResult?.data?.details).length > 0;

  return [
    { from: 'VendorA: XCBR1.Pos.stVal', to: 'VendorB: CSWI1.Pos.stVal', confidence: 'High', kind: 'LN/DO/DA' },
    { from: 'VendorA: MMXU1.A.phsA.cVal.mag.f', to: 'VendorB: MMXU1.A.phsA.cVal.mag.f', confidence: 'Medium', kind: 'LN/DO/DA' },
    { from: 'VendorA: PTRC1.Op.general', to: 'VendorB: PTRC1.Op.general', confidence: hasAnyIssues ? 'Medium' : 'High', kind: 'LN/DO/DA' },
    { from: 'VendorA: BRK_101_STATUS', to: 'VendorB: BRK_101_STATUS', confidence: 'High', kind: 'SCADA' },
    { from: 'VendorA: BUS_VA', to: 'VendorB: BUS_VA', confidence: 'Medium', kind: 'SCADA' }
  ];
}

/**
 * Attempts to extract interoperability/mapping rows from validationResult
 * across multiple possible backend shapes.
 *
 * Supported heuristic sources (first match wins):
 * - validationResult.data.interoperability / interoperabilityMap / mappings / map / links / edges
 * - validationResult.data.result.<...same keys...>
 *
 * @returns {{ mappings: MappingRow[], source: 'backend'|'mock', diagnostics: {reason?: string, triedKeys?: string[]} }}
 */
function buildMappingsFromAppState(validationResult) {
  const d = validationResult?.data ?? validationResult ?? null;
  const candidateParents = [d, d?.result, d?.report, d?.interop, d?.interoperability];

  const keysToTry = [
    'interoperabilityMap',
    'interoperability_map',
    'interoperability',
    'interopMap',
    'interop_map',
    'mappings',
    'mapping',
    'map',
    'links',
    'edges',
    'alignment',
    'alignments'
  ];

  const tried = [];

  for (const parent of candidateParents) {
    if (!parent || typeof parent !== 'object') continue;

    for (const k of keysToTry) {
      tried.push(k);
      const raw = parent[k];
      const arr = safeArray(raw);
      if (!arr.length) continue;

      const rows = arr.map(toMappingRow).filter(Boolean);
      if (rows.length) return { mappings: rows, source: 'backend', diagnostics: { triedKeys: tried } };
    }

    // Sometimes the object is { nodes:[], edges:[] } - convert edges into rows.
    const edges = safeArray(parent?.edges);
    if (edges.length) {
      const rows = edges.map(toMappingRow).filter(Boolean);
      if (rows.length) return { mappings: rows, source: 'backend', diagnostics: { triedKeys: tried.concat(['edges']) } };
    }
  }

  // Derive a small mapping set from validation detail refs if possible.
  const details = safeArray(d?.details);
  const derived = [];
  for (const it of details) {
    const msg = String(it?.message || '');
    // very conservative: only use items that explicitly mention "map" or "mapping"
    if (!/map|mapping|align|interoperab/i.test(msg)) continue;

    const sourceRef = pick(it, ['source', 'from', 'src', 'producer', 'path', 'objectRef', 'object']);
    const targetRef = pick(it, ['target', 'to', 'dst', 'consumer']);
    if (sourceRef && targetRef) {
      derived.push({
        from: String(sourceRef),
        to: String(targetRef),
        confidence: normalizeConfidence(pick(it, ['confidence', 'score', 'similarity'])),
        kind: String(pick(it, ['kind', 'category', 'type']) || 'Derived')
      });
    }
  }
  if (derived.length) {
    return { mappings: derived.slice(0, 60), source: 'backend', diagnostics: { reason: 'Derived from validation details (heuristic)' } };
  }

  return {
    mappings: buildRobustMockMappings(validationResult),
    source: 'mock',
    diagnostics: { reason: 'No interoperability/mapping payload found in validation result; using robust mock.' }
  };
}

function uniqueBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const k = keyFn(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/**
 * Layout nodes into two columns (source/target) and connect them with curved edges.
 * This keeps the visualization simple, readable, and dependency-free.
 */
function buildTwoColumnGraph(mappings, { width = 980, height = 420, padX = 24, padY = 28 } = {}) {
  const sources = uniqueBy(mappings.map((m) => m.from), (s) => s);
  const targets = uniqueBy(mappings.map((m) => m.to), (s) => s);

  const leftX = padX + 110;
  const rightX = width - padX - 110;

  const usableH = Math.max(80, height - padY * 2);
  const srcStep = sources.length <= 1 ? 0 : usableH / (sources.length - 1);
  const tgtStep = targets.length <= 1 ? 0 : usableH / (targets.length - 1);

  /** @type {GraphNode[]} */
  const nodes = [];
  for (let i = 0; i < sources.length; i += 1) {
    nodes.push({
      id: `src:${sources[i]}`,
      label: sources[i],
      side: 'source',
      x: leftX,
      y: padY + i * srcStep,
      r: 10
    });
  }

  for (let i = 0; i < targets.length; i += 1) {
    nodes.push({
      id: `tgt:${targets[i]}`,
      label: targets[i],
      side: 'target',
      x: rightX,
      y: padY + i * tgtStep,
      r: 10
    });
  }

  const nodeIndex = new Map(nodes.map((n) => [n.id, n]));

  /** @type {GraphEdge[]} */
  const edges = mappings.map((m, idx) => ({
    id: `e:${idx}:${m.from}=>${m.to}`,
    fromNodeId: `src:${m.from}`,
    toNodeId: `tgt:${m.to}`,
    confidence: m.confidence,
    kind: m.kind
  })).filter((e) => nodeIndex.has(e.fromNodeId) && nodeIndex.has(e.toNodeId));

  return { width, height, nodes, edges };
}

function SvgGraph({ graph, selectedEdgeId, onSelectEdge, selectedNodeId, onSelectNode }) {
  const { width, height, nodes, edges } = graph;

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  function edgePath(from, to) {
    // Smooth-ish cubic curve; control points depend on direction.
    const dx = Math.max(120, Math.abs(to.x - from.x) * 0.45);
    const c1x = from.x + dx;
    const c2x = to.x - dx;
    return `M ${from.x} ${from.y} C ${c1x} ${from.y}, ${c2x} ${to.y}, ${to.x} ${to.y}`;
  }

  const leftTitleX = 24;
  const rightTitleX = width - 24;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Interoperability map graph"
      style={{
        display: 'block',
        borderRadius: 14,
        border: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.92)'
      }}
    >
      <defs>
        <linearGradient id="edgeGlow" x1="0" x2="1">
          <stop offset="0%" stopColor="rgba(37, 99, 235, 0.22)" />
          <stop offset="100%" stopColor="rgba(245, 158, 11, 0.22)" />
        </linearGradient>
        <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="rgba(17,24,39,0.18)" />
        </filter>
      </defs>

      {/* Column titles */}
      <text x={leftTitleX} y={22} fontSize="12" fill="rgba(107,114,128,1)" style={{ letterSpacing: '0.08em' }}>
        SOURCES
      </text>
      <text
        x={rightTitleX}
        y={22}
        fontSize="12"
        textAnchor="end"
        fill="rgba(107,114,128,1)"
        style={{ letterSpacing: '0.08em' }}
      >
        TARGETS
      </text>

      {/* Mid divider */}
      <line
        x1={width / 2}
        y1={34}
        x2={width / 2}
        y2={height - 16}
        stroke="rgba(229,231,235,0.95)"
        strokeDasharray="5 6"
      />

      {/* Edges */}
      <g aria-label="Mappings" role="group">
        {edges.map((e) => {
          const from = nodeById.get(e.fromNodeId);
          const to = nodeById.get(e.toNodeId);
          if (!from || !to) return null;

          const selected = selectedEdgeId === e.id;
          const nodeSelected = selectedNodeId && (e.fromNodeId === selectedNodeId || e.toNodeId === selectedNodeId);

          const stroke = confidenceColor(e.confidence);
          const opacity = selected ? 0.95 : nodeSelected ? 0.70 : 0.32;
          const strokeWidth = selected ? 3.2 : nodeSelected ? 2.2 : 1.6;

          return (
            <path
              key={e.id}
              d={edgePath(from, to)}
              fill="none"
              stroke={stroke}
              strokeOpacity={opacity}
              strokeWidth={strokeWidth}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectEdge(e.id)}
            />
          );
        })}
      </g>

      {/* Nodes */}
      <g aria-label="Nodes" role="group">
        {nodes.map((n) => {
          const selected = selectedNodeId === n.id;
          const fill = n.side === 'source' ? 'rgba(37, 99, 235, 0.10)' : 'rgba(245, 158, 11, 0.12)';
          const stroke = n.side === 'source' ? 'rgba(37, 99, 235, 0.42)' : 'rgba(245, 158, 11, 0.45)';

          return (
            <g key={n.id} transform={`translate(${n.x}, ${n.y})`} style={{ cursor: 'pointer' }} onClick={() => onSelectNode(n.id)}>
              <circle
                r={selected ? n.r + 2 : n.r}
                fill={fill}
                stroke={selected ? 'rgba(37, 99, 235, 0.75)' : stroke}
                strokeWidth={selected ? 2.5 : 1.6}
                filter={selected ? 'url(#softShadow)' : undefined}
              />
              <text
                x={n.side === 'source' ? -14 : 14}
                y={4}
                fontSize="12"
                textAnchor={n.side === 'source' ? 'end' : 'start'}
                fill="rgba(17,24,39,0.82)"
              >
                {clipText(n.label, 54)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// PUBLIC_INTERFACE
export default function InteroperabilityMapPage() {
  /** Interoperability Map page: graph + details, driven by app state with robust fallback. */
  const { validationResult } = useApp();

  const { mappings, source, diagnostics } = useMemo(
    () => buildMappingsFromAppState(validationResult),
    [validationResult]
  );

  const graph = useMemo(() => buildTwoColumnGraph(mappings, { width: 980, height: 440 }), [mappings]);

  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const selectedEdge = useMemo(
    () => graph.edges.find((e) => e.id === selectedEdgeId) || null,
    [graph.edges, selectedEdgeId]
  );

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return graph.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [graph.nodes, selectedNodeId]);

  const sourceLabel = source === 'backend' ? 'App State' : 'Fallback Mock';

  // Filter table rows based on selection (edge/node).
  const filteredMappings = useMemo(() => {
    if (selectedEdge) {
      const fromLabel = selectedEdge.fromNodeId.replace(/^src:/, '');
      const toLabel = selectedEdge.toNodeId.replace(/^tgt:/, '');
      return mappings.filter((m) => m.from === fromLabel && m.to === toLabel);
    }

    if (selectedNode) {
      const label = selectedNode.label;
      if (selectedNode.side === 'source') return mappings.filter((m) => m.from === label);
      return mappings.filter((m) => m.to === label);
    }

    return mappings;
  }, [mappings, selectedEdge, selectedNode]);

  const stats = useMemo(() => {
    const byConf = { High: 0, Medium: 0, Low: 0 };
    const byKind = new Map();
    for (const m of mappings) {
      byConf[m.confidence] += 1;
      const k = m.kind || 'Uncategorized';
      byKind.set(k, (byKind.get(k) || 0) + 1);
    }
    const kinds = Array.from(byKind.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { byConf, kinds };
  }, [mappings]);

  return (
    <PageShell
      title="Interoperability Map"
      subtitle="Visualize semantic alignment across vendors (LN/DO/DA and SCADA mapping)."
      actions={
        <div className="row">
          <span className="pill" title={diagnostics?.reason || ''}>
            Source: {sourceLabel}
          </span>
          <span className="pill" style={confidencePillStyle('High')}>
            High: {stats.byConf.High}
          </span>
          <span className="pill" style={confidencePillStyle('Medium')}>
            Medium: {stats.byConf.Medium}
          </span>
          <span className="pill" style={confidencePillStyle('Low')}>
            Low: {stats.byConf.Low}
          </span>
          <button
            className="btn"
            onClick={() => {
              setSelectedEdgeId(null);
              setSelectedNodeId(null);
            }}
            disabled={!selectedEdgeId && !selectedNodeId}
          >
            Clear selection
          </button>
        </div>
      }
    >
      <div className="subtle">
        {source === 'backend'
          ? 'Rendering from available validation/interoperability payload. Click an edge (mapping) or node to filter details.'
          : 'No backend interoperability payload detected; rendering robust mock data so you can explore the visualization.'}
      </div>

      {stats.kinds.length ? (
        <div style={{ marginTop: 10 }} className="subtle">
          Top categories:{' '}
          <span className="mono">
            {stats.kinds.map(([k, n]) => `${k}:${n}`).join(' · ')}
          </span>
        </div>
      ) : null}

      <div style={{ height: 14 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12, alignItems: 'start' }}>
        <div className="card" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div className="cardBody">
            <SvgGraph
              graph={graph}
              selectedEdgeId={selectedEdgeId}
              onSelectEdge={(id) => {
                setSelectedEdgeId(id);
                setSelectedNodeId(null);
              }}
              selectedNodeId={selectedNodeId}
              onSelectNode={(id) => {
                setSelectedNodeId(id);
                setSelectedEdgeId(null);
              }}
            />

            <div style={{ height: 10 }} />
            <div className="subtle">
              Tip: selecting a node filters the table to all mappings entering/leaving that endpoint. Selecting an edge shows that specific mapping.
            </div>
          </div>
        </div>

        <div className="card" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div className="cardBody">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 13 }}>Selection</strong>
              <span className="pill">{selectedEdge ? 'Edge' : selectedNode ? 'Node' : 'None'}</span>
            </div>

            <div style={{ height: 10 }} />

            {!selectedEdge && !selectedNode ? (
              <div className="subtle">
                Click a node/edge in the graph to inspect details and filter the mapping list.
              </div>
            ) : null}

            {selectedEdge ? (
              <div className="kv" style={{ marginTop: 10 }}>
                <div className="kvKey">From</div>
                <div className="kvVal"><span className="mono">{selectedEdge.fromNodeId.replace(/^src:/, '')}</span></div>

                <div className="kvKey">To</div>
                <div className="kvVal"><span className="mono">{selectedEdge.toNodeId.replace(/^tgt:/, '')}</span></div>

                <div className="kvKey">Confidence</div>
                <div className="kvVal">
                  <span className="pill" style={confidencePillStyle(selectedEdge.confidence)}>
                    {selectedEdge.confidence}
                  </span>
                </div>

                <div className="kvKey">Kind</div>
                <div className="kvVal">{selectedEdge.kind || <span className="subtle">—</span>}</div>
              </div>
            ) : null}

            {selectedNode ? (
              <div className="kv" style={{ marginTop: 10 }}>
                <div className="kvKey">Side</div>
                <div className="kvVal"><span className="pill">{selectedNode.side}</span></div>

                <div className="kvKey">Label</div>
                <div className="kvVal"><span className="mono">{selectedNode.label}</span></div>

                <div className="kvKey">Mappings</div>
                <div className="kvVal">{filteredMappings.length}</div>
              </div>
            ) : null}

            <div style={{ height: 14 }} />
            <div className="subtle">
              Next step (once backend schema is finalized): show per-mapping evidence, mismatched DO/DA paths, and recommended normalization rules.
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <table className="table" aria-label="Interoperability mapping table">
        <thead>
          <tr>
            <th style={{ width: '44%' }}>Source</th>
            <th style={{ width: '44%' }}>Target</th>
            <th style={{ width: '12%' }}>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {filteredMappings.map((m, idx) => (
            <tr key={`${m.from}=>${m.to}#${idx}`}>
              <td className="mono">{m.from}</td>
              <td className="mono">{m.to}</td>
              <td>
                <span className="pill" style={confidencePillStyle(m.confidence)}>
                  {m.confidence}
                </span>
              </td>
            </tr>
          ))}
          {!filteredMappings.length ? (
            <tr>
              <td colSpan={3} className="subtle">
                No mappings match the current selection.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div style={{ height: 14 }} />
      <div className="subtle">
        Diagnostic: <span className="mono">{diagnostics?.reason || 'OK'}</span>
      </div>
    </PageShell>
  );
}
