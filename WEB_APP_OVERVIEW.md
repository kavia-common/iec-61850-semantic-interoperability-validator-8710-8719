# IEC 61850 SIV-Tool Web App Overview

## Concept

The IEC 61850 Semantic Interoperability Validation Tool (SIV-Tool) web application is an engineering UI for assessing whether IEC 61850 configuration artifacts (typically SCL files such as SCD/ICD/CID/XML) are semantically consistent and interoperable across devices and vendors.

In real engineering projects, teams integrate IEDs, gateways, and SCADA systems from multiple suppliers. Even when an SCL file is syntactically valid XML, semantic problems can still prevent successful commissioning. Common issues include missing mandatory objects, incorrect LN/DO/DA references, dataset inconsistencies (GOOSE/SV), and non-standard naming or SCADA point mapping conventions. The web app provides one place to upload engineering files, run validation, and explore findings through dedicated views such as the Validation Report, LN Tree, Interoperability Map, and SCADA Table.

The UI is designed to remain usable even when a backend API is not configured by providing an “offline mode” that returns mock responses. This supports demos and UI review without requiring a live service.

## What the app does (at a glance)

The app provides a top navigation bar and a sidebar of modules. A typical workflow is:

1. Upload an SCL file and run validation.
2. Review the Validation Report (issues, warnings, and recommended fixes).
3. Explore the model using the Logical Node (LN) Tree.
4. Review cross-vendor alignment in the Interoperability Map.
5. Inspect and adjust SCADA point mappings in the SCADA Table.
6. Optionally run Excel anomaly detection (a standalone, client-side module).
7. Use Settings to confirm environment wiring (API base URL, WebSocket URL, and feature flags).

## How it was created (high-level tech stack and architecture)

This container (`frontend_web_app/`) is a React single-page application built with Create React App (CRA) and React Router.

At a high level, the codebase is organized around pages (modules) plus a small set of shared services:

- The UI is written in React and composed of pages and shared layout components.
- Navigation is handled by `react-router-dom` with routes for each module.
- A lightweight state container (`AppContext`) provides:
  - An API client (`createApiClient`) for HTTP calls when a backend is configured.
  - A WebSocket client (`createWsClient`) for connection status and future real-time updates.
  - Shared state such as `lastUpload` and `validationResult` used across SCL validation modules.
- Runtime configuration is read via CRA environment variables (`REACT_APP_*`) using a single accessor (`getEnvConfig`).

A key design choice in this codebase is resilience to “unknown backend contracts.” Several pages and the API client use tolerant extraction heuristics plus mock fallbacks so the UI remains functional if the backend is unavailable, endpoints differ from defaults, or response payloads evolve.

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
- Identify semantic inconsistencies in LNs, datasets, and references that can cause runtime failures.
- Compare and reason about cross-vendor alignment and mapping assumptions.
- Review and improve SCADA naming conventions and point mappings.
- Export a portable validation output (JSON download from the report page).
- Explore workflows and screens without a live backend (offline mode).

## Modules and what each one does

### File Upload

The File Upload page is the entry point for the SCL validation workflow. It allows you to:

- Select an SCL file (`.scd`, `.icd`, `.cid`, `.xml`).
- Upload the file to a backend if configured.
- Start validation and poll for completion when the backend exposes status endpoints.
- Inspect “last upload,” “validation result,” and “last action” payloads as JSON (useful during integration).

If the backend is not configured or endpoints are not reachable, the app falls back to mock upload/validation results so the UI remains explorable.

### LN Tree

The LN Tree page renders a browsable hierarchy to help engineers understand which IEDs, logical devices, and logical nodes are present.

It attempts to build a tree from the current `validationResult` using tolerant extraction logic. If no backend-derived structure is present, it derives an approximate tree from validation references, and finally falls back to a mock tree so the page still demonstrates expand/collapse, selection, and “hint” behavior.

### Dataset Viewer

The Dataset Viewer page is a scaffold for inspecting GOOSE/SV datasets and their entries.

In the current implementation it shows mock dataset rows and uses whether a validation result exists to slightly vary statuses. It is designed to be expanded once backend dataset data is available.

### Validation Report

The Validation Report page displays normalized validation “details” from `validationResult.data.details`.

Each item is rendered with severity styling (error/warning/info). When a validation result exists, the page provides a “Download JSON” action that exports the current validation payload.

### Interoperability Map

The Interoperability Map page visualizes “source” to “target” mappings in a two-column graph (dependency-free SVG rendering).

It tries to extract mapping rows from multiple possible locations in the validation payload (because the backend contract is intentionally treated as flexible). If no mapping payload is found, it renders robust mock mappings. Users can click nodes/edges to filter the table to specific mappings, and mappings are annotated with a confidence level (High/Medium/Low) with consistent coloring.

This view is intended for cross-vendor alignment and for spotting likely mismatches or low-confidence mappings.

### SCADA Table

The SCADA Table provides an editable mapping table for SCADA point names to IEC 61850 LN and DO/DA paths.

It tries to extract SCADA mapping rows from the validation payload. If missing, it derives rows heuristically from SCADA-related validation messages or falls back to mock rows. Rows are editable inline, and the page generates recommendations from both validation details and per-row heuristics (for example, non-standard point naming or suspicious LN/path formats). Edits are currently local to the browser session (not persisted).

### Recommendations

The Recommendations page is a dashboard-style view that summarizes overall posture and presents actionable cybersecurity guidance.

It uses available signals when present, such as validation issue counts and any anomaly-related indicators that may be present in state. When no results exist, it still provides baseline recommendations. The goal is to present operational next steps rather than only listing raw validation items.

### Anomaly Detection

The Anomaly Detection module is a standalone, client-side Excel outlier detection workflow. It is intentionally independent of IEC 61850 SCL validation.

It can load a default bundled workbook (`/assets/Attack_Dataset.csv.xlsx`) or accept an uploaded Excel file, infer numeric columns, and run anomaly scoring using robust statistical techniques such as robust z-score (median/MAD) or classic z-score. Results are presented as ranked outliers with top contributing features and row previews.

### Settings

The Settings page surfaces runtime configuration and feature flags so users can confirm whether the app is running in backend-connected mode or offline mode, and which URLs are being used.

## Offline mode vs backend-connected mode

When `REACT_APP_API_BASE` (or `REACT_APP_BACKEND_URL`) is not set, the API client returns mock responses. When it is set, the API client attempts live HTTP calls, including probing common endpoint patterns for upload and validation flows.

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
  - `frontend_web_app/src/pages/DatasetViewerPage.js`
  - `frontend_web_app/src/pages/InteroperabilityMapPage.js`
  - `frontend_web_app/src/pages/ScadaTablePage.js`
  - `frontend_web_app/src/pages/RecommendationsPage.js`
  - `frontend_web_app/src/pages/AnomalyDetectionPage.js`
