/**
 * LN Tree builder utilities.
 *
 * Goal: derive a structured Logical Node tree from whatever parsed SCL / validation
 * payload is present in app state, while remaining tolerant to unknown backend
 * contract changes.
 *
 * The LN Tree should be able to render something useful for:
 *  - full parsed SCL structures (preferred)
 *  - validation result objects that contain LN-path references
 *  - missing backend data (fallback mock tree)
 */

/**
 * @typedef {Object} LnTreeNode
 * @property {string} id Stable identifier for rendering/selection
 * @property {string} name Display label
 * @property {('root'|'substation'|'voltageLevel'|'bay'|'ied'|'ld'|'ln'|'unknown')} kind Node type (used for rendering badges/icons)
 * @property {string=} hint Optional short status hint ("OK", "Issues: 2", etc.)
 * @property {number=} issuesCount Number of issues associated with node
 * @property {Array<LnTreeNode>=} children
 */

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function stringifyMaybe(v) {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  try {
    return JSON.stringify(v);
  } catch (_e) {
    return String(v);
  }
}

function uniqKey(parts) {
  return parts.filter(Boolean).join('|');
}

function titleFromKind(kind) {
  if (kind === 'ied') return 'IED';
  if (kind === 'ld') return 'Logical Device';
  if (kind === 'ln') return 'Logical Node';
  return kind;
}

/**
 * Heuristic parser for an "IEC 61850-ish" object reference/path.
 * Supports common patterns:
 *   - "IED: X / LD: LD0 / LN: XCBR1"
 *   - "XCBR1.Pos.stVal"
 *   - "IED1/LD0/XCBR1.Pos.stVal"
 *   - "VendorA: XCBR1.Pos.stVal"
 *
 * Returns partial segments; missing pieces are allowed.
 */
function parseRef(ref) {
  const raw = String(ref || '').trim();
  if (!raw) return { raw };

  // Remove vendor prefix "VendorA: ..."
  const noVendor = raw.includes(':') ? raw.split(':').slice(1).join(':').trim() : raw;

  // Split by common separators first
  const slashParts = noVendor.split('/').map((p) => p.trim()).filter(Boolean);

  let ied = null;
  let ld = null;
  let ln = null;

  for (const p of slashParts) {
    const up = p.toUpperCase();
    if (up.startsWith('IED')) {
      // "IED1" or "IED: IED1"
      ied = p.replace(/^IED\s*[:-]?\s*/i, '').trim() || p;
      continue;
    }
    if (up.startsWith('LD')) {
      ld = p.replace(/^LD\s*[:-]?\s*/i, '').trim() || p;
      continue;
    }
    // For any unknown segment, keep scanning; LN might be in last segment
  }

  // LN might be in last segment and also contain dot path
  const last = slashParts[slashParts.length - 1] || noVendor;
  const dotParts = last.split('.').map((p) => p.trim()).filter(Boolean);

  // If last looks like "LN: XCBR1 (Circuit Breaker)" extract after "LN:"
  const mLn = last.match(/LN\s*[:-]\s*([A-Za-z0-9_]+)/i);
  if (mLn?.[1]) ln = mLn[1];

  // Otherwise if first dot segment resembles LN instance e.g., "XCBR1"
  if (!ln && dotParts.length) {
    const first = dotParts[0];
    // avoid taking "Pos" etc as LN by requiring at least one digit at end (XCBR1, MMXU1, CSWI1...)
    if (/[A-Za-z]{2,}\d+/.test(first)) ln = first;
  }

  // If only one slashPart and it's an IED-ish label, let it be ied
  if (!ied && slashParts.length === 1 && /^([A-Za-z0-9_-]+)$/.test(slashParts[0]) && !ln) {
    ied = slashParts[0];
  }

  return { raw, ied, ld, ln };
}

/**
 * Attempts to discover a parsed SCL/structure payload inside the validationResult.
 * Supports multiple likely shapes.
 */
function getParsedPayload(validationResult) {
  const d = validationResult?.data ?? validationResult;

  // Common names we might see
  return (
    d?.parsedScl ||
    d?.parsed_scl ||
    d?.scl ||
    d?.sclModel ||
    d?.model ||
    d?.result?.parsedScl ||
    d?.result?.scl ||
    d?.result ||
    null
  );
}

/**
 * Extract issue items from known validation result shapes.
 */
function getValidationDetails(validationResult) {
  const d = validationResult?.data ?? validationResult;
  const details = d?.details ?? d?.result?.details ?? d?.report?.details ?? d?.issues ?? d?.errors ?? null;
  return safeArray(details);
}

/**
 * Builds a tree from a parsed SCL model if present.
 * Because backend contract is unknown, we only support a tolerant subset:
 * - parsedScl.ieds[] with { name, logicalDevices[] } etc.
 * - or parsedScl.IED[] (XML-to-JSON style)
 *
 * Returns null if shape not recognized.
 * @returns {LnTreeNode|null}
 */
function buildFromParsedScl(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;

  // Candidate arrays
  const ieds =
    safeArray(parsed.ieds) ||
    safeArray(parsed.IED) ||
    safeArray(parsed.ied) ||
    safeArray(parsed?.substation?.ieds);

  if (!ieds.length) return null;

  /** @type {LnTreeNode} */
  const root = {
    id: 'root',
    name: 'SCL',
    kind: 'root',
    children: []
  };

  root.children.push({
    id: 'substation',
    name: parsed.substation?.name ? `Substation: ${parsed.substation.name}` : 'Substation',
    kind: 'substation',
    children: []
  });

  const sub = root.children[0];

  for (const iedObj of ieds) {
    // XML->JSON conversions often use "@name" style keys; these must be accessed via bracket notation.
    const iedName =
      iedObj?.name ||
      iedObj?.['@name'] ||
      iedObj?.id ||
      iedObj?.iedName ||
      'Unknown-IED';

    const iedNode = {
      id: uniqKey(['ied', iedName]),
      name: `IED: ${iedName}`,
      kind: 'ied',
      children: []
    };

    const lds =
      safeArray(iedObj.logicalDevices) ||
      safeArray(iedObj.LDevice) ||
      safeArray(iedObj.ld) ||
      safeArray(iedObj.logicalDevice);

    for (const ldObj of lds) {
      const ldInst =
        ldObj?.inst ||
        ldObj?.['@inst'] ||
        ldObj?.name ||
        ldObj?.['@name'] ||
        'LD?';

      const ldNode = {
        id: uniqKey(['ld', iedName, ldInst]),
        name: `LD: ${ldInst}`,
        kind: 'ld',
        children: []
      };

      const lns =
        safeArray(ldObj.lns) ||
        safeArray(ldObj.LN) ||
        safeArray(ldObj.ln) ||
        safeArray(ldObj.LN0);

      for (const lnObj of lns) {
        // LN fields are commonly { lnClass, inst } or { "@lnClass", "@inst" }
        const lnClass =
          lnObj?.lnClass ||
          lnObj?.['@lnClass'] ||
          lnObj?.class ||
          lnObj?.['@class'] ||
          '';

        const inst = lnObj?.inst || lnObj?.['@inst'] || '';
        const prefix = lnObj?.prefix || lnObj?.['@prefix'] || '';

        const lnName = (prefix ? `${prefix}` : '') + (lnClass || '') + (inst || '');
        if (!lnName) continue;

        ldNode.children.push({
          id: uniqKey(['ln', iedName, ldInst, lnName]),
          name: `LN: ${lnName}`,
          kind: 'ln'
        });
      }

      if (ldNode.children.length) iedNode.children.push(ldNode);
    }

    sub.children.push(iedNode);
  }

  return root;
}

/**
 * Builds a tree from validation detail items by grouping issue references under IED/LD/LN.
 * This works even when only issue messages exist (we'll attempt to infer LN names).
 * @returns {LnTreeNode|null}
 */
function buildFromValidationDetails(validationResult) {
  const details = getValidationDetails(validationResult);
  if (!details.length) return null;

  // Grouping maps
  const iedMap = new Map(); // ied -> Map(ld -> Map(ln -> {count, items}))
  let anyParsed = false;

  for (const it of details) {
    // Try multiple likely fields for "where this issue belongs"
    const ref =
      it?.path ||
      it?.objectRef ||
      it?.object ||
      it?.target ||
      it?.lnRef ||
      it?.ln ||
      it?.source ||
      it?.location ||
      it?.message;

    const parsed = parseRef(ref);
    if (parsed.ied || parsed.ld || parsed.ln) anyParsed = true;

    const ied = parsed.ied || 'Unknown IED';
    const ld = parsed.ld || 'Unknown LD';
    const ln = parsed.ln || 'Unknown LN';

    if (!iedMap.has(ied)) iedMap.set(ied, new Map());
    const ldMap = iedMap.get(ied);
    if (!ldMap.has(ld)) ldMap.set(ld, new Map());
    const lnMap = ldMap.get(ld);
    if (!lnMap.has(ln)) lnMap.set(ln, { count: 0, severities: new Set() });

    const bucket = lnMap.get(ln);
    bucket.count += 1;
    if (it?.severity) bucket.severities.add(String(it.severity).toLowerCase());
  }

  if (!anyParsed) return null;

  /** @type {LnTreeNode} */
  const root = {
    id: 'root',
    name: 'Substation',
    kind: 'root',
    children: []
  };

  for (const [ied, ldMap] of iedMap.entries()) {
    /** @type {LnTreeNode} */
    const iedNode = {
      id: uniqKey(['ied', ied]),
      name: `IED: ${ied}`,
      kind: 'ied',
      children: []
    };

    for (const [ld, lnMap] of ldMap.entries()) {
      /** @type {LnTreeNode} */
      const ldNode = {
        id: uniqKey(['ld', ied, ld]),
        name: `LD: ${ld}`,
        kind: 'ld',
        children: []
      };

      for (const [ln, bucket] of lnMap.entries()) {
        const sevLabel =
          bucket.severities.has('error') ? 'Errors' : bucket.severities.has('warning') ? 'Warnings' : 'Items';
        ldNode.children.push({
          id: uniqKey(['ln', ied, ld, ln]),
          name: `LN: ${ln}`,
          kind: 'ln',
          issuesCount: bucket.count,
          hint: `${sevLabel}: ${bucket.count}`
        });
      }

      iedNode.children.push(ldNode);
    }

    root.children.push(iedNode);
  }

  return root;
}

/**
 * Existing fallback mock tree (preserved behavior).
 * @returns {LnTreeNode}
 */
function buildMockTree(validationResult) {
  const issues = validationResult?.data?.details || [];
  const hasIssues = Array.isArray(issues) && issues.length > 0;

  return {
    id: 'root',
    name: 'Substation',
    kind: 'root',
    children: [
      {
        id: 'vl-1',
        name: 'VoltageLevel',
        kind: 'voltageLevel',
        children: [
          {
            id: 'bay-1',
            name: 'Bay',
            kind: 'bay',
            children: [
              {
                id: 'ied-a',
                name: 'IED: VendorA-IED1',
                kind: 'ied',
                children: [
                  {
                    id: 'ln-xcbr1',
                    name: 'LN: XCBR1 (Circuit Breaker)',
                    kind: 'ln',
                    hint: hasIssues ? 'Issues present' : 'OK'
                  },
                  { id: 'ln-mmxu1', name: 'LN: MMXU1 (Measurements)', kind: 'ln', hint: 'OK' }
                ]
              },
              {
                id: 'ied-b',
                name: 'IED: VendorB-IED9',
                kind: 'ied',
                children: [
                  { id: 'ln-cswi1', name: 'LN: CSWI1 (Switch Controller)', kind: 'ln', hint: hasIssues ? 'Warnings present' : 'OK' }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * PUBLIC_INTERFACE
 * Builds the LN Tree from app state.
 *
 * Preference order:
 *   1) Parsed SCL structures (if present)
 *   2) Validation details with references (if present)
 *   3) Fallback mock tree (always available)
 *
 * @param {any} validationResult App state's validation result object (often {ok, data:{details:[]...}})
 * @returns {{ tree: LnTreeNode, source: 'parsedScl'|'validationDetails'|'mock', diagnostics: { reason?: string, parsedKeys?: string[] } }}
 */
export function buildLnTree(validationResult) {
  const parsed = getParsedPayload(validationResult);

  const fromParsed = buildFromParsedScl(parsed);
  if (fromParsed) {
    return {
      tree: fromParsed,
      source: 'parsedScl',
      diagnostics: { parsedKeys: Object.keys(parsed || {}) }
    };
  }

  const fromDetails = buildFromValidationDetails(validationResult);
  if (fromDetails) {
    return { tree: fromDetails, source: 'validationDetails', diagnostics: {} };
  }

  return {
    tree: buildMockTree(validationResult),
    source: 'mock',
    diagnostics: { reason: parsed ? `Unrecognized parsed payload shape: ${stringifyMaybe(Object.keys(parsed))}` : 'No parsed payload found' }
  };
}

/**
 * PUBLIC_INTERFACE
 * Human-friendly label for LN-tree source.
 */
export function formatTreeSourceLabel(source) {
  /** Returns a label for the tree source used in UI. */
  if (source === 'parsedScl') return 'Parsed SCL';
  if (source === 'validationDetails') return 'Validation References';
  return 'Fallback Mock';
}

/**
 * PUBLIC_INTERFACE
 * Returns a short hint label for the node to show in the UI.
 */
export function getNodeHint(node) {
  /** Returns a normalized hint string for a node. */
  if (!node) return '';
  if (node.hint) return String(node.hint);
  if (typeof node.issuesCount === 'number' && node.issuesCount > 0) return `Issues: ${node.issuesCount}`;
  if (node.kind === 'ln') return 'OK';
  return '';
}

/**
 * PUBLIC_INTERFACE
 * Returns accessible label for node kind.
 */
export function getNodeKindLabel(kind) {
  /** Returns a display label for a node kind. */
  return titleFromKind(kind || 'unknown');
}
