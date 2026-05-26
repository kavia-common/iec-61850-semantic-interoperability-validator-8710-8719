# Cybersecurity Workflow Coverage (Frontend UI): Implemented vs Gaps

## Purpose and scope

This document answers whether the current React frontend implements (or considers) key cybersecurity workflow questions, specifically:

How cyber threats are detected, how they are notified, where threats are witnessed, who the personas are, what information is shown at detection time, and what the resolution process is.

The assessment is based on the current frontend code and navigation model. Where the app does not implement a cybersecurity-specific workflow, this document describes the closest implemented analogs (for example, “validation issues” and “anomaly outliers”) and then enumerates concrete, navigation-consistent UI additions to close gaps.

## Current navigation model (what the UI supports today)

The app uses a top-tab (“context”) navigation model with a context-aware left sidebar and namespaced routes.

The route table in `frontend_web_app/src/App.js` shows these contexts and modules:

- Backend Configuration context under `/backend/*` includes file upload and validation initiation.
- Health context under `/health/*` includes anomaly detection, recommendations, and validation report views.
- WS context under `/ws/*` includes WebSocket status/log views.

This is driven by `frontend_web_app/src/navigation/navConfig.js` and rendered by `frontend_web_app/src/components/TopNav.js` and `frontend_web_app/src/components/Sidebar.js`.

In practice, any cybersecurity workflow additions should be implemented as additional modules within an existing context (most likely Health), rather than as “global” pages, because `navConfig.js` explicitly models that modules are not global across all tabs.

## Mapping the cybersecurity workflow questions to current implementation

### How are cyber threats detected?

The frontend currently has two “detection” mechanisms, but they are not cybersecurity detections in the strict sense. They are engineering validations and statistical anomaly detection.

First, the SCL validation flow is initiated from the File Upload page. `frontend_web_app/src/pages/FileUploadPage.js` calls the API client to upload an SCL file and start validation, then optionally polls until a terminal state. The polling uses `api.pollValidationUntilDone(...)` and stores the final payload into shared app state as `validationResult` via `setValidationResult(normalized)`.

Second, the Health context provides a client-side “Anomaly Detection” module that detects outliers in an Excel dataset. `frontend_web_app/src/pages/AnomalyDetectionPage.js` runs `detectAnomalies(...)` on a numeric matrix derived from the dataset. The algorithm is implemented in `frontend_web_app/src/utils/anomalyDetection.js`, where per-feature robust z-scores (median and MAD) or classic z-scores are computed, then a per-row anomaly score is computed as the mean absolute feature z-score. Outliers are flagged via a percentile cutoff, top-K selection, or a numeric threshold.

What is not implemented is an explicit cyber-threat model (for example, “alerts,” “detections,” “incidents,” “attack techniques,” or a correlation rule engine). The UI currently detects:

- “Semantic issues” in IEC 61850 configuration artifacts (validation details in `validationResult.data.details`).
- “Statistical outliers” in a dataset that can be security-relevant (especially given the bundled “Attack_Dataset.csv.xlsx”), but is not interpreted as an “attack detection” with a consistent schema.

In other words, the app has implemented detection-like modules, but they are not described or structured as cyber threat detections.

### How are threats notified?

The current frontend does not implement a notification system in the cybersecurity sense.

What is implemented today is in-app visibility of results and diagnostic information:

- The File Upload page shows validation progress via an inline “pill” constructed from `pollState`, and shows a JSON dump of the latest `validationResult` in-page (`<pre>`). This is a “pull-based” UI pattern, not an explicit notification flow.
- The Home dashboard reads run history from localStorage and shows KPI cards, including “Anomalies flagged,” derived from `listRunHistory(...)` in `frontend_web_app/src/state/runHistory.js` (used by `frontend_web_app/src/pages/HomePage.js`). This again is a “review later” workflow, not a notification.
- WebSocket diagnostics exist (`frontend_web_app/src/services/wsClient.js` plus `/ws/status` and `/ws/logs` pages), but the WS client is currently a generic scaffold: it records status transitions and incoming messages into an in-memory ring buffer and exposes them through `getLogs()`. There is no UI behavior that interprets incoming messages as security alerts, nor any “toast,” “badge,” or “inbox” concept.

Therefore, “notification” exists only as “the user can navigate to pages and view results and logs,” not as proactive alerting.

### Where are threats witnessed? (device, digital application)

The current frontend does not implement a first-class concept of “where a threat was witnessed,” such as:

- Asset identifiers (IED, relay, gateway, workstation)
- Logical grouping (substation, bay, zone)
- Digital application identifiers (SCADA server, historian, engineering workstation application)
- Network viewpoint (VLAN, station bus/process bus, IP addresses)

What does exist is indirect, and depends on what a backend provides:

- Validation Report items are rendered from `validationResult.data.details` and display only `severity`, `code`, and `message` (`frontend_web_app/src/pages/ValidationReportPage.js`). There is no extraction of device/application context from those messages, and no structured “location witnessed” fields.
- The Anomaly Detection page’s outlier table shows the row index, an anomaly score, and “top contributing features,” plus a partial row preview. It does not attach device/application metadata unless such columns exist in the uploaded dataset and are selected/shown.

So, “where witnessed” is not a modeled entity in the UI. It may be implicitly contained inside free-text messages or dataset columns, but it is not captured as structured UX fields.

### Who are the personas involved when a cyber threat is notified?

The frontend has no persona, role, or user/account model. There is no login, no RBAC, and no workflow ownership (assignee, on-call, analyst vs engineer vs operator).

The closest implemented concept is “module purpose,” where certain modules are clearly intended for engineering audiences:

- Backend Configuration pages (upload, LN tree, datasets) are oriented to configuration engineering.
- Health pages (validation report, interoperability map, SCADA table) are oriented to diagnostics and remediation.

However, there is no implemented persona modeling, and no UI decisions conditioned on persona.

### What information is seen when a threat is detected?

For the two current detection-like mechanisms, the information shown is as follows.

For SCL validation results:

- The File Upload page shows the full JSON payload for `validationResult` (`frontend_web_app/src/pages/FileUploadPage.js`), which may include a `summary` and `details` depending on backend response shape.
- The Validation Report page normalizes to `validationResult.data.details`, and for each item shows `severity`, `code`, and `message` (`frontend_web_app/src/pages/ValidationReportPage.js`). It also includes a “Download JSON” action that exports the whole payload.

For Excel anomaly results:

- The Anomaly Detection page shows a result summary (“Rows,” “Features,” “Outliers,” “Cutoff score,” and “Method”), plus a table of outliers including “Score,” “Top contributing features,” and a partial row preview as JSON (`frontend_web_app/src/pages/AnomalyDetectionPage.js`).
- The anomaly algorithm provides an explainability hook via `topFeatures` for each outlier (`frontend_web_app/src/utils/anomalyDetection.js`).

For WebSocket messages:

- The WS Logs page shows formatted log lines for status changes, messages, and errors captured in-memory (`frontend_web_app/src/pages/ws/WsLogsPage.js`), but these messages are not interpreted into a “threat details” UI.

What is missing for a cyber threat detection screen is a consistent, structured “alert details” view, which typically includes:

- Severity and confidence
- Timestamp and duration
- Affected asset/application identifiers
- Evidence and raw events
- Related detections (correlations)
- Recommended triage actions and workflow state (new, acknowledged, in progress, resolved)

None of those are implemented as first-class UI objects today.

### What is the resolution process?

A cybersecurity-style resolution process (triage, acknowledge, assign, remediate, verify, close) is not implemented in the frontend.

What the UI currently supports is a “manual resolution by navigation” model:

- Users can review the Validation Report, Interoperability Map, and SCADA Table to identify issues and potential fixes.
- The Recommendations page provides a set of guidance cards with “Suggested steps” and “Expected impact,” but these are static guidance and do not track workflow state (no acknowledgement, no tasks, no closure, no verification steps stored in state).

In addition, run history is persisted locally and can be exported, which supports post-hoc review but not incident workflow management.

## Summary table: implemented vs gaps

| Question | What is implemented now (frontend) | Key gaps |
|---|---|---|
| How are threats detected? | SCL validation via upload + backend polling; Excel outlier detection client-side. | No cyber alert/detection model; detection outputs not normalized into a shared “alert” schema; no correlation rules. |
| How are they notified? | User manually checks pages; progress pill on validation; WS logs exist but are diagnostic. | No proactive notifications (toasts, badges, inbox); no subscription preferences; no routing from detection to investigation view. |
| Where witnessed? | Not modeled; may be embedded in messages or dataset columns. | No structured asset/application/location fields; no “device vs application” witness classification. |
| Personas involved? | No users/RBAC; modules imply engineering audiences only. | No persona modeling (operator/analyst/engineer), no ownership or escalation. |
| What info is shown at detection? | Validation items: severity, code, message; Anomaly outliers: score, top features, row preview; raw JSON dumps. | No structured alert details, evidence timeline, impacted assets, or investigative context. |
| Resolution process? | Manual: navigate to SCADA table / interop map; static recommendations. | No workflow states, acknowledgement, assignment, remediation tracking, or verification and closure records. |

## Proposed UI/flow additions consistent with the navigation model

This section proposes concrete UI additions that fit the existing model of top tabs + per-context sidebar modules, without introducing global pages.

The goal is to add a cybersecurity-style workflow layer on top of existing “detections” (validation issues and anomalies), even if the underlying sources remain validation/anomaly outputs initially.

### Add an “Alerts” module under the Health context

The most navigation-consistent place for a cyber workflow is the Health tab, because it already aggregates “Recommendations,” “Validation Report,” and “Results.”

A new page such as `/health/alerts` would act as a unified “threat/issue inbox” that normalizes:

- Validation issues from `validationResult.data.details`
- Anomaly outliers from the last anomaly run (currently only stored inside `AnomalyDetectionPage` state; this would require persisting anomaly results to a shared store or run-history record in a richer format)

The Alerts list view should include a consistent row model with:

- Title (derived from code/message or feature/outlier)
- Severity (error/warning/info or derived from score)
- Witness type (“Configuration artifact”, “Dataset telemetry”) and witness location (if extractable)
- Timestamp (run startedAt/completedAt from run history)
- Status (New, Acknowledged, In Progress, Resolved) stored locally at first

### Add “Alert Details” (drill-in) as a second Health module or as a nested route

The existing routing model uses explicit page routes, but nested routes would still be consistent if scoped under Health.

An Alert Details view should show:

- The original evidence (validation detail item or outlier row + top features)
- A “context” section that attempts to extract or request witness location. For validation items, this could begin as parsing hints from message strings and later evolve to structured backend fields.
- Links into existing remediation views:
  - “Open Validation Report filtered to this code” (future enhancement)
  - “Open SCADA Table” and “Open Interoperability Map” (already exist under `/health/scada` and `/health/interop-map`)

### Add notification affordances without changing the architecture

Without implementing external notifications, the frontend can add lightweight “in-app notification” affordances:

- A badge count on the Health tab indicating “unreviewed alerts,” derived from the run history plus locally tracked acknowledgement state.
- A toast on completion of a validation poll (File Upload) if issues are detected, which navigates the user to `/health/alerts` or `/health/report`.

This can be implemented entirely client-side, and it aligns with the current offline-friendly design.

### Add persona-aware display as a non-blocking, offline-friendly feature flag

Because there is no login system, persona support can begin as a Settings-level selector (for example, “Persona: Operator / Engineer / Security Analyst”), stored in localStorage.

The main benefit is to adapt wording and default views:

- Operator persona: emphasizes impact and high-level status, fewer raw JSON dumps.
- Engineer persona: emphasizes mapping paths, LN/DO references, and config suggestions.
- Security analyst persona: emphasizes “alerts,” evidence, and workflow status.

This is consistent with the existing Settings page surfacing feature flags and environment configuration.

### Define a resolution workflow state machine in the UI (local-first)

Even without backend support, the UI can define a simple resolution lifecycle and persist it in localStorage:

- New → Acknowledged → In Progress → Resolved (with optional “False Positive”)
- Fields: assignee (free-text), notes, remediation steps taken, verification timestamp

This would answer “what is the resolution process” at least in the UI’s operational model, even if the actual remediation occurs outside the tool.

### Model “where witnessed” as structured fields derived from existing sources

For a first iteration, the UI can attempt to populate witness fields heuristically:

- For validation issues, parse IEC 61850-like paths from messages where available (for example, strings containing “LN”, “DO”, “DA”, “IED”, “FCDA”). The LN Tree utilities already deal with parsing references for building trees (though that logic is outside this document’s scope).
- For anomaly outliers, allow the user to designate “asset identifier columns” (for example, “DeviceId”, “Host”, “Application”) so the outlier table can display them as witness fields even if they are non-numeric columns.

This would make “where witnessed (device, digital application)” answerable in the UI.

## What the current tool answers today (direct answers)

## How are cyber threats detected?

The tool does not currently detect cyber threats explicitly. It detects IEC 61850 semantic validation issues via backend validation polling and detects statistical outliers in uploaded/bundled Excel datasets via client-side anomaly scoring.

## How are they notified?

There is no explicit notification mechanism. The user is informed by navigating to relevant pages (Validation Report, Anomaly Detection, Recommendations), viewing run history on Home/Results pages, and optionally viewing WebSocket logs/status.

## Where are the threats witnessed (device, digital application)?

The tool does not model witness location as structured fields. Any “where” information would have to be inferred from free-text validation messages or dataset columns.

## Who are the personas involved when a cyber threat is notified?

No personas are implemented (no login, roles, RBAC, assignees, or escalation). The UI is implicitly oriented toward engineers and integrators.

## What information is seen when a threat is detected?

For validation, the UI shows severity/code/message items and allows downloading raw JSON. For anomaly detection, the UI shows outlier scores, contributing features, and row previews. WebSocket messages are shown as raw logs, not as structured detections.

## What is the resolution process?

There is no implemented resolution workflow (acknowledge/assign/remediate/verify/close). The current process is manual: review findings, use mapping/report pages to interpret them, and apply fixes outside the tool. The Recommendations page provides guidance but does not track completion.

## Sources (files reviewed)

The findings above were derived from the following frontend sources:

- `frontend_web_app/src/App.js`
- `frontend_web_app/src/navigation/navConfig.js`
- `frontend_web_app/src/components/TopNav.js`
- `frontend_web_app/src/components/Sidebar.js`
- `frontend_web_app/src/state/AppContext.js`
- `frontend_web_app/src/services/apiClient.js`
- `frontend_web_app/src/services/wsClient.js`
- `frontend_web_app/src/pages/FileUploadPage.js`
- `frontend_web_app/src/pages/ValidationReportPage.js`
- `frontend_web_app/src/pages/AnomalyDetectionPage.js`
- `frontend_web_app/src/utils/anomalyDetection.js`
- `frontend_web_app/src/pages/RecommendationsPage.js`
- `frontend_web_app/src/pages/ws/WsStatusPage.js`
- `frontend_web_app/src/pages/ws/WsLogsPage.js`
- `frontend_web_app/src/pages/HomePage.js`
