# Recommendations: Extending SIV-Tool to AI Analytics and Digital Twin

## Purpose and scope

This document provides practical recommendations for evolving the current React-based IEC 61850 SIV-Tool (SCL validation plus client-side anomaly detection) into a platform that supports richer AI analytics and digital twin capabilities. The recommendations are grounded in how the current UI is structured today: a top-tab “context” navigation model, a context-aware left sidebar, a small shared app state (`AppContext`), and lightweight HTTP/WS service clients with offline fallbacks.

This document intentionally focuses on platform extension points and UX/navigation alignment rather than prescribing a specific backend implementation, because the current frontend is designed to tolerate “unknown backend contracts” and to remain usable in offline mode.

## Current architecture and navigation model (as extension constraints)

The app has three top-level contexts (top tabs) and a context-specific module menu in the left sidebar.

The current contexts and route namespaces are:

- Backend Configuration (`/backend/*`): upload and validation initiation plus settings and run history.
- Health (`/health/*`): reporting and analysis pages (validation report, interoperability map, SCADA table, recommendations, anomaly detection, and health run history).
- WS (`/ws/*`): WebSocket diagnostics (status, reconnect, logs).

Routing is defined in `frontend_web_app/src/App.js`. Tab/menu configuration is centralized in `frontend_web_app/src/navigation/navConfig.js`, and the UI shell uses `TopNav` and `Sidebar`.

Shared state is minimal and currently contains:

- `lastUpload`
- `validationResult`
- `api` client (`createApiClient`)
- `ws` client (`createWsClient`)

This structure is a good base for AI/digital twin because it already separates “configuration/ingestion” from “analysis/reporting” and includes a WebSocket surface suitable for streaming telemetry later.

## Recommendations overview

The extension work is best approached as three parallel tracks:

1. Strengthen the frontend’s “platform primitives” (domain state model, job/run model, plugin-like analytics surfaces) without breaking existing pages.
2. Introduce AI analytics as a first-class set of modules inside the existing navigation model, reusing Health as the analysis home while adding an optional dedicated “Analytics” top context if needed later.
3. Introduce digital twin concepts incrementally, starting from a “static twin” derived from SCL/validation results, then evolving to a “live twin” with telemetry streaming via WebSocket.

## Platform primitives to add (frontend-first, architecture-aligned)

### Establish a stable domain model boundary in state

Today, pages read `validationResult` and use tolerant extraction heuristics. That is valuable for early integration, but digital twin and richer analytics benefit from a normalized internal representation.

Recommendation: introduce a domain normalization layer that converts raw backend payloads into stable internal models, while preserving raw payloads for diagnostics.

A pragmatic approach that matches the current style is:

- Keep storing `validationResultRaw` (current `validationResult`) for debugging/export.
- Add `domain` state that is produced by a small set of pure “normalizers”, for example:
  - `normalizeSclValidation(raw): { issues, lnTree, datasets, scadaMappings, interoperabilityMappings, metadata }`
  - `normalizeTelemetry(raw): { points, timestamps, quality, source }` (for later)
  - `normalizeTwin(raw): { assets, connectivity, measurements, inferredRelationships }`

This can be introduced without changing the navigation model. Existing pages can gradually switch from heuristics to the normalized models.

### Add a unified “runs/jobs” concept that spans modules

The app already persists run history for both backend validation and client-side anomaly detection (`state/runHistory.js` as used by `BackendResultsPage` and `HealthResultsPage`). AI analytics and digital twin operations typically create longer-running jobs, need reproducibility, and often produce artifacts.

Recommendation: define a common run record schema that can represent:

- validation runs (existing)
- analytics runs (new)
- twin simulation runs (new)
- telemetry replay sessions (new)

At minimum, add fields that support analytics/twin:

- `inputs` (SCL version ID, dataset IDs, time window, selected points/features)
- `artifacts` (model version, feature importance, embedding IDs, generated rules)
- `provenance` (who/when/with what configuration)

Even if the backend is not implemented yet, storing these fields in local history aligns with the existing offline-friendly strategy.

### Create a “capabilities” flagging approach that maps to existing Settings

The Settings page already surfaces environment variables and flags. AI/digital twin will likely be introduced incrementally (for example, “telemetry streaming enabled”, “twin mode enabled”, “LLM explanations enabled”).

Recommendation: standardize feature flags as parseable configuration rather than opaque strings. For example, treat `REACT_APP_FEATURE_FLAGS` as a comma-separated list or JSON and expose a helper like `hasFlag("twin")`. This keeps the UX consistent with the current Settings diagnostics approach and helps ship partially enabled features safely.

## AI analytics: how to extend within the current navigation model

### Where AI analytics should live in the UX

The current Health context already contains “analysis” and “actionability” modules:

- Anomaly Detection (client-side numeric outliers)
- Validation Report (issue list)
- Interoperability Map (graph)
- SCADA Table (editable mapping)
- Recommendations (actionable guidance)

Recommendation: treat AI analytics as an evolution of the Health context first, by adding new modules under `/health/*` such as:

- `/health/analytics` (overview dashboard)
- `/health/analytics/models` (model registry, versions, training status)
- `/health/analytics/explanations` (explainability views for anomalies/mappings)
- `/health/analytics/rules` (AI-suggested normalization rules, mapping rules, naming conventions)

This keeps the “analysis” mental model intact and avoids introducing a new top-level context until it becomes necessary.

If analytics becomes broad enough to deserve its own top tab, the current nav architecture supports adding a new context (a new `TOP_TABS` entry and a new key in `CONTEXT_MODULES`) without affecting other contexts.

### Recommended AI analytics capabilities (incremental, aligned with existing pages)

Recommendation: build AI features that directly enhance existing modules first. These provide immediate value and minimize navigation churn.

1. Semantic issue clustering and prioritization for Validation Report.
   - Today: the report shows a list of details with severity.
   - Extension: add clustering (by LN/DO/DA path, by vendor, by root-cause hypothesis), and a “top recurring causes” summary.
   - UX fit: remains inside `/health/report` or links from it.

2. AI-assisted mapping confidence and evidence for Interoperability Map.
   - Today: mappings have a High/Medium/Low confidence and a mock fallback.
   - Extension: include “why” evidence, e.g., string similarity signals, IEC 61850 schema alignment, naming convention matches, historical match success.
   - UX fit: show evidence in the selection panel on the right side of `/health/interop-map`.

3. AI-assisted SCADA naming and mapping suggestions.
   - Today: SCADA Table supports inline edits and heuristic recommendations.
   - Extension: propose normalized point names, detect inconsistent prefixes, suggest LN/DO/DA targets, and show confidence and provenance.
   - UX fit: remains within `/health/scada` as “suggested fix” actions.

4. Replace (or complement) the current anomaly method with pluggable detectors.
   - Today: anomaly detection is robust z-score / z-score on Excel numeric columns.
   - Extension: add a “detector registry” concept so additional detectors can be added without rewriting the page, such as isolation forest, seasonal decomposition, multivariate change-point detection, or embedding-based outliers.
   - UX fit: keep `/health/anomaly` but make “Method” extensible.

### Backend/API considerations that match the existing apiClient design

The existing `createApiClient` probes common endpoint patterns and normalizes status to a `{state, progress, message, result}` shape. AI analytics operations commonly need:

- asynchronous jobs
- progress updates
- retrieval of results and artifacts

Recommendation: keep the current polling-friendly model and extend it with “job-type aware” endpoints. The frontend can be designed to work with any of these patterns:

- `POST /analytics/start` -> returns `{jobId}`
- `GET /analytics/status/:jobId` -> returns `{state, progress, message}`
- `GET /analytics/result/:jobId` -> returns `{result}`

This matches how `pollValidationUntilDone` works today and reduces frontend complexity. When WS becomes available, the same job updates can also be streamed through `/ws/*` without removing polling.

## Digital twin: recommended capability model and how it maps to the UI

### Define “digital twin” for this app in a way that reuses SCL artifacts

For IEC 61850 engineering, the most natural “twin” starting point is a semantic twin of the substation automation system definition:

- assets: IEDs, logical devices, logical nodes
- connectivity: datasets, control blocks, reporting relationships, SCADA mappings
- measurements and states: data attributes (DA) that can later be linked to telemetry

Recommendation: implement digital twin in two phases:

1. Static twin (configuration twin).
   - Source: SCL + validation results.
   - Outputs: a graph of assets/relationships, consistency checks, completeness metrics, “what-if” analyses on configuration.
   - Value: immediate, even without live telemetry.

2. Live twin (operational twin).
   - Source: telemetry streams and event logs (future), linked to the configuration twin.
   - Outputs: state estimation, drift detection (configuration vs. observed), replay, and predictive analytics.

### Where twin modules should live in navigation

Given current navigation:

- Backend Configuration is about ingesting and setting up inputs.
- Health is where analysis and operational views exist.
- WS is a diagnostic/connection context.

Recommendation: start by adding twin modules under Health, because twin views are primarily analytical/visual. For example:

- `/health/twin` (Twin Overview)
- `/health/twin/graph` (Asset/relationship graph)
- `/health/twin/points` (Point catalog: DA/FCDA/SCADA mappings)
- `/health/twin/drift` (Configuration drift and integrity checks)
- `/health/twin/simulation` (What-if checks, scenario runs)

If the twin becomes central, introduce a new top tab context “Twin” later. The existing `TOP_TABS`/`CONTEXT_MODULES` model cleanly supports it.

### Use the existing Interoperability Map as a bridge to twin graph visualization

The current Interoperability Map already renders a dependency-free SVG graph and supports selection-driven filtering.

Recommendation: reuse this graph rendering approach for the twin graph early on, because it:

- avoids new heavy graph dependencies
- matches the current “works offline” principle
- is already understood in the codebase

A twin graph can start with the same two-column layout (for example, “Assets” vs. “Signals”) and later evolve to multi-layer layouts once requirements stabilize.

## Real-time telemetry: how to evolve the WS surface

The app already has a WebSocket client scaffold and pages for status, reconnect, and logs.

Recommendation: plan telemetry streaming and job progress streaming as extensions of the existing WS client, not a parallel mechanism.

Suggested message categories:

- `job_progress` events for validation/analytics/twin simulations
- `telemetry` events for point updates
- `alerts` events for anomalies/drift detections

Even before backend implementation, the frontend can define the event envelope it prefers (for example `{type, ts, payload}`) and log unknown events gracefully, matching the current `wsClient` behavior.

## Data and lifecycle recommendations (to support AI and twin rigor)

### Treat SCL and derived artifacts as versioned inputs

AI analytics and digital twin both require traceability.

Recommendation: represent inputs as immutable versions (even if stored only client-side for now):

- `SclArtifactVersion`: hash, uploadId, fileName, createdAt
- `DerivedArtifact`: validation report, extracted point catalog, mapping tables, twin graph snapshot

This directly complements the existing “run history” pages and allows comparisons (“before/after”) later.

### Add an “explainability” standard for AI outputs

To keep outputs actionable for engineers, AI results should always include:

- confidence
- evidence (which fields, which rules, which similarity metrics)
- suggested action
- fallback deterministic checks (when possible)

This aligns with how the Interoperability Map uses confidence levels and how Recommendations emphasizes “next steps”.

## Suggested phased delivery plan (minimal disruption)

### Phase 1: Foundation (no new top tabs)

- Add normalized domain models in state alongside raw payloads.
- Extend run history schema to support analytics and twin jobs.
- Add a Health module “Analytics Overview” that only summarizes what is already available (validation issues, anomaly outputs, mapping confidence distributions).

### Phase 2: Static twin

- Add “Twin Overview” and “Twin Graph” pages under `/health/twin/*`.
- Build twin graph from existing `validationResult` (and later from normalized domain models).
- Provide completeness and consistency metrics (for example, coverage of SCADA mappings, dataset coverage of critical LNs).

### Phase 3: AI-assisted enhancements

- Add AI-assisted clustering and prioritization for validation details.
- Add evidence-based mapping suggestions in Interoperability Map and SCADA Table.
- Introduce “Suggested fixes” workflows that generate change proposals rather than directly editing operational artifacts.

### Phase 4: Live twin and streaming

- Use `wsClient` to stream telemetry updates and job progress updates.
- Add drift detection and replay modules.
- Introduce long-running simulation jobs with streaming progress and artifact capture.

## Risks and guardrails

This app’s current strength is resilience to missing/unknown backend contracts via heuristics and mock fallback. That should remain true, but AI/twin features can create a false sense of precision if the UI does not clearly indicate data provenance.

Recommendation: for every AI/twin view, explicitly display:

- data source (backend vs. derived vs. mock)
- model version (if applicable)
- timestamp/window
- confidence and evidence

This is consistent with how the Interoperability Map currently labels “Source: App State” vs “Fallback Mock”.

## Mapping to concrete code touchpoints (for future implementation)

These are the frontend files where extension work naturally hooks in:

- Navigation and contexts:
  - `frontend_web_app/src/navigation/navConfig.js`
  - `frontend_web_app/src/App.js`
  - `frontend_web_app/src/components/TopNav.js`
  - `frontend_web_app/src/components/Sidebar.js`

- State and services:
  - `frontend_web_app/src/state/AppContext.js`
  - `frontend_web_app/src/services/apiClient.js`
  - `frontend_web_app/src/services/wsClient.js`
  - `frontend_web_app/src/config/env.js`

- Pages that can be incrementally enhanced:
  - `frontend_web_app/src/pages/ValidationReportPage.js` (AI clustering and prioritization)
  - `frontend_web_app/src/pages/InteroperabilityMapPage.js` (evidence and twin graph reuse)
  - `frontend_web_app/src/pages/ScadaTablePage.js` (AI suggestions, rule proposals)
  - `frontend_web_app/src/pages/AnomalyDetectionPage.js` and `frontend_web_app/src/utils/anomalyDetection.js` (detector registry)
  - `frontend_web_app/src/pages/RecommendationsPage.js` (AI-backed recommendations with provenance)

These touchpoints align with the current architecture and avoid introducing new cross-cutting mechanisms prematurely.
