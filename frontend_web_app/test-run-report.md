# Frontend Web App — CI Test Run Report

- Component: `frontend_web_app`
- Command: `CI=true npm test -- --watchAll=false`
- Framework: React / Jest (via `react-scripts test`)
- Result: **PASS**

## Summary
- Test Suites: **1 passed**, 1 total
- Tests: **9 passed**, 9 total
- Skipped: **0**
- Execution time: **4.493 s**

## Passing suite details
- `src/App.test.js` — PASS

## Warnings (non-fatal)
React Router deprecation/future-flag warnings were emitted:
- `v7_startTransition`
- `v7_relativeSplatPath`

These warnings did not impact test pass/fail status.

## Raw Jest summary (from stdout)
```
PASS src/App.test.js
Test Suites: 1 passed, 1 total
Tests:   9 passed, 9 total
Snapshots:   0 total
Time:   4.493 s
Ran all test suites.
```
