# IEC 61850 SIV-Tool Web App Overview

## Concept

The IEC 61850 Semantic Interoperability Validation Tool (SIV-Tool) web application is an engineering-focused UI for checking whether IEC 61850 configuration artifacts (typically SCL files such as SCD/ICD/CID) are semantically consistent and interoperable across devices and vendors.

In practice, engineering teams often integrate IEDs, gateways, and SCADA systems from multiple sources. Even when configurations are syntactically valid XML, semantic mismatches can still cause failures such as missing mandatory objects, inconsistent dataset references, and inconsistent naming or mapping conventions. This app’s purpose is to provide a single place to upload engineering data, run validation, and then explore the results through multiple views such as a logical node tree, an interoperability/mapping visualization, and a SCADA mapping table.

The UI is designed to remain usable even when a backend is not configured by providing “offline mode” mock responses. That makes it possible to review the interaction patterns and screens without requiring a live API.

## What the app does (at a glance)

The app provides a top navigation bar plus a sidebar of modules. A typical workflow is:

1. Upload an SCL file and run validation.
2. Review the validation report (issues, warnings, and recommended fixes).
3. Explore the data model via the Logical Node (LN) Tree.
4. Inspect (or prototype) cross-vendor alignment in the Interoperability Map.
5. Review and edit SCADA point mappings in the SCADA Table.
6. Optionally run client-side anomaly detection on an Excel dataset (independent module).
7. Use Settings to confirm environment wiring (API base URL, WebSocket URL, feature flags).

## How it was created (high-level tech stack and architecture)

This container (`frontend_web_app/`) is a React single-page application built with Create React App (CRA) and React Router.

At a high level:

- The UI is written in React and composed of pages and shared layout components.
- Navigation is handled by `react-router-dom` with routes for each module.
- A lightweight state container (`AppContext`) provides:
  - An API client (`createApiClient`) that speaks HTTP to a backend if configured.
  - A WebSocket client (`createWsClient`) used for connection status and future real-time updates.
  - Shared state such as `lastUpload` and `validationResult`.
- The app reads runtime configuration through CRA environment variables (`REACT_APP_*`) via a single accessor (`getEnvConfig`).

A key design choice in this codebase is resilience to “unknown backend contracts.” Several pages and the API client intentionally use tolerant extraction/heuristics and mock fallbacks so the UI can still run if:
- the backend is unavailable,
- endpoints differ from expected defaults,
- or the response payload shape changes.

### Frontend runtime configuration (environment variables)

The app centralizes environment variable access in `src/config/env.js`. The most important values are:

- `REACT_APP_API_BASE` or `REACT_APP_BACKEND_URL`: Base URL for REST API calls. If empty, the app runs in offline mode and uses mock data.
- `REACT_APP_WS_URL`: WebSocket URL. If omitted, the app attempts to derive it from `apiBase` by replacing `http` with `ws`.
- `REACT_APP_HEALTHCHECK_PATH`: Health endpoint path (default `/health`).
- `REACT_APP_FEATURE_FLAGS` and `REACT_APP_EXPERIMENTS_ENABLED`: String values currently surfaced on the Settings page.

### High-level component architecture

The main composition is:

- `src/App.js`: Route table and overall layout.
- `src/components/TopNav.js`: Branding plus backend/health and WebSocket status indicators.
- `src/components/Sidebar.js`: Module navigation.
- `src/components/PageShell.js`: Consistent page layout wrapper (title, subtitle, actions).

Shared state and services are provided by:

- `src/state/AppContext.js`: React context holding `api`, `ws`, `lastUpload`, and `validationResult`.
- `src/services/apiClient.js`: HTTP wrapper with endpoint probing and mock fallback.
- `src/services/wsClient.js`: WebSocket client scaffold with graceful fallback when not configured.

## Primary use cases

This UI is intended for power system engineers, protection engineers, and SCADA/OT integrators who need to:

- Validate an IEC 61850 SCL configuration before commissioning or integration.
- Compare semantic alignment across configurations from different vendors.
- Identify missing mandatory objects or incorrect references in Logical Nodes and datasets.
- Review and correct SCADA naming conventions and point mappings.
- Produce a portable validation output (JSON download from the report page).
- Prototype workflows and UI interactions without a live backend (offline mode).

## Modules and what each one does

### File Upload

The File Upload page is the start of the validation workflow. It allows you to:

- Select an SCL file (`.scd`, `.icd`, `.cid`, `.xml`).
- Upload the file to a backend if configured.
- Start validation and poll for completion if the backend supports status endpoints.
- View raw “last upload,” “validation result,” and “last action” payloads in JSON form.

If the backend is not configured or endpoints are not reachable, the app falls back to mock upload/validation results so the UI remains explorable.

### LN Tree

The LN Tree page renders a browsable hierarchy to help engineers understand what logical nodes and containers exist in the current model.

It attempts to build a tree from the current `validationResult` using tolerant extraction logic. If no backend-derived structure is present, it will derive an approximate tree from validation references or fall back to a mock tree so the UI still demonstrates the intended behavior (expand/collapse, selection, hints).

### Dataset Viewer

The Dataset Viewer page is a scaffold for inspecting GOOSE/SV datasets and their entries.

In the current implementation, it shows mock dataset rows and uses whether a validation result exists to slightly alter statuses. It is designed to be replaced or expanded once backend dataset data is available.

### Validation Report

The Validation Report page displays a list of normalized validation “details” from `validationResult.data.details`.

- Each item is rendered with severity coloring (error/warning/info).
- If a validation result exists, the page provides a “Download JSON” action that downloads the current validation payload as a file.

If no validation results are present, it shows an informational message guiding the user to run validation.

### Interoperability Map

The Interoperability Map page visualizes “source” to “target” mappings in a two-column graph (dependency-free SVG rendering).

Key behaviors:

- It tries to extract mapping rows from multiple possible locations in the validation payload (because the backend contract is not fixed).
- If no mapping payload is found, it renders a robust mock mapping list.
- Users can click nodes/edges to filter the table to specific mappings.
- Mappings are annotated with a confidence level (High/Medium/Low) with consistent coloring.

This view is intended for cross-vendor alignment and for spotting likely mismatches or low-confidence mappings.

### SCADA Table

The SCADA Table module provides an editable mapping table for SCADA points to IEC 61850 LN and DO/DA paths.

Key behaviors:

- It tries to extract SCADA mapping rows from the validation payload. If missing, it can derive rows heuristically from SCADA-related validation messages, or fall back to mock rows.
- Rows are editable inline (point name, LN instance, DO/DA path, vendor, quality).
- Recommendations are generated from both validation details and per-row heuristics (for example, non-standard point naming or suspicious LN/path formats).
- Edits are currently local to the browser session (not persisted).

This page is intended for SCADA naming normalization and mapping cleanup before integration.

### Recommendations

The Recommendations page is a dashboard-style view that summarizes “overall posture” and presents actionable cybersecurity guidance.

It will use available signals when present (for example, anomaly outlier rate or validation issue counts), but it also provides baseline recommendations when no backend results exist.

The intent is to provide operationally useful next steps rather than only listing raw validation items.

### Anomaly Detection

The Anomaly Detection module is a client-side Excel outlier detection workflow. It is explicitly independent of IEC 61850 SCL validation.

Capabilities include:

- Loading a default bundled workbook (`/assets/Attack_Dataset.csv.xlsx`) or uploading an Excel file.
- Auto-inferring numeric columns and allowing feature selection.
- Running anomaly scoring using robust statistical techniques (robust z-score with median/MAD or classic z-score).
- Displaying outliers with top contributing features and row previews.

This module supports broader engineering and cybersecurity analysis workflows where unusual telemetry patterns matter.

### Settings

The Settings page surfaces runtime configuration and feature flags so users can confirm which mode the app is running in (backend configured vs offline) and which URLs are being used.

## Offline mode vs backend-connected mode

When `REACT_APP_API_BASE` (or `REACT_APP_BACKEND_URL`) is not set, the API client returns mock responses. When it is set, the API client will attempt live HTTP calls, including probing common endpoint patterns for upload and validation flows.

This design keeps the UI stable and demo-friendly while allowing incremental backend integration.

## Where to look in the code

If you want to understand or extend the app, these files are good starting points:

- Routing and layout: `frontend_web_app/src/App.js`
- Navigation components: `frontend_web_app/src/components/TopNav.js`, `frontend_web_app/src/components/Sidebar.js`
- Shared state: `frontend_web_app/src/state/AppContext.js`
- Backend integration: `frontend_web_app/src/services/apiClient.js`
- WebSocket integration: `frontend_web_app/src/services/wsClient.js`
- Environment config: `frontend_web_app/src/config/env.js`
- Pages/modules:
  - `frontend_web_app/src/pages/FileUploadPage.js`
  - `frontend_web_app/src/pages/ValidationReportPage.js`
  - `frontend_web_app/src/pages/LnTreePage.js`
  - `frontend_web_app/src/pages/InteroperabilityMapPage.js`
  - `frontend_web_app/src/pages/ScadaTablePage.js`
  - `frontend_web_app/src/pages/RecommendationsPage.js`
  - `frontend_web_app/src/pages/AnomalyDetectionPage.js`

Task completed: Added user-facing documentation for the SIV-Tool web app (concept, creation/architecture, use cases, and functionality).
