import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// Mock service factories used by AppProvider (AppContext.js).
// This keeps tests stable and avoids any real fetch/WebSocket/network behavior.
jest.mock('./services/apiClient', () => ({
  createApiClient: jest.fn()
}));

jest.mock('./services/wsClient', () => ({
  createWsClient: jest.fn()
}));

/**
 * App uses <BrowserRouter>. For deterministic route tests, we replace BrowserRouter with MemoryRouter
 * and control the starting location using an injected `globalThis.__TEST_INITIAL_ENTRIES__`.
 */
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    BrowserRouter: ({ children }) => (
      <actual.MemoryRouter initialEntries={globalThis.__TEST_INITIAL_ENTRIES__ || ['/']}>
        {children}
      </actual.MemoryRouter>
    )
  };
});

// AnomalyDetectionPage auto-loads a bundled Excel via fetch() on mount.
// Mock that helper to prevent jsdom network errors (ECONNREFUSED) when tests land in health/anomaly.
jest.mock('./utils/excel', () => {
  const actual = jest.requireActual('./utils/excel');
  return {
    ...actual,
    fetchWorkbookFromPublicAsset: jest.fn().mockResolvedValue({
      sheetNames: ['Sheet1'],
      sheetName: 'Sheet1',
      rows: []
    })
  };
});

const { createApiClient } = require('./services/apiClient');
const { createWsClient } = require('./services/wsClient');

function makeApiMock(overrides = {}) {
  return {
    hasBackend: false,
    healthcheckPath: '/health',
    getHealth: jest.fn().mockResolvedValue({ ok: true, mocked: true, status: 200, data: { status: 'ok' } }),
    request: jest.fn().mockResolvedValue({ ok: true, mocked: true, data: { details: [] } }),
    upload: jest.fn().mockResolvedValue({
      ok: true,
      mocked: true,
      data: { uploadId: 'mock-1', fileName: 'test.icd', message: 'uploaded' }
    }),
    ...overrides
  };
}

function makeWsMock(overrides = {}) {
  return {
    getStatus: jest.fn(() => 'idle'),
    connect: jest.fn(),
    close: jest.fn(),
    send: jest.fn(() => false),
    on: jest.fn((_eventName, _fn) => () => {}),
    ...overrides
  };
}

function renderAt(route) {
  globalThis.__TEST_INITIAL_ENTRIES__ = [route];
  return render(<App />);
}

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.__TEST_INITIAL_ENTRIES__ = ['/'];

  // Default mocks for most tests
  createApiClient.mockReturnValue(makeApiMock());
  createWsClient.mockReturnValue(makeWsMock());
});

describe('App shell + routing', () => {
  test('renders top brand and module navigation (context-aware) and does not auto-connect ws', async () => {
    // Default route is now the global Home dashboard.
    renderAt('/');

    expect(screen.getByLabelText(/application brand/i)).toBeInTheDocument();
    expect(screen.getByText(/IEC 61850 SIV-Tool/i)).toBeInTheDocument();

    // Sidebar remains context-aware; in Home context it has no global modules.
    const nav = screen.getByLabelText(/module navigation/i);
    expect(within(nav).queryByRole('link', { name: /File Upload/i })).not.toBeInTheDocument();
    expect(within(nav).queryByText(/Validation Report/i)).not.toBeInTheDocument();

    // Services are created once by AppProvider.
    await waitFor(() => expect(createWsClient).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(createApiClient).toHaveBeenCalledTimes(1));

    // Current behavior: NO websocket auto-connect on mount.
    const ws = createWsClient.mock.results[0].value;
    expect(ws.connect).toHaveBeenCalledTimes(0);

    // App shell does not require an immediate healthcheck call on mount.
    const api = createApiClient.mock.results[0].value;
    expect(api.getHealth).toHaveBeenCalledTimes(0);
  });

  test('default route (/) renders Home dashboard', async () => {
    renderAt('/');

    // Home renders a PageShell labeled by its title
    expect(await screen.findByLabelText('Home')).toBeInTheDocument();
    expect(screen.getByText(/Global dashboard across upload and run history/i)).toBeInTheDocument();
  });

  test('sidebar navigation changes route to Settings', async () => {
    const user = userEvent.setup();
    renderAt('/backend/upload');

    const nav = screen.getByLabelText(/module navigation/i);
    await user.click(within(nav).getByRole('link', { name: /Settings/i }));

    expect(await screen.findByLabelText('Settings')).toBeInTheDocument();
    expect(screen.getByText(/Runtime configuration and diagnostics/i)).toBeInTheDocument();
  });

  test('unknown route renders NotFound page', async () => {
    const user = userEvent.setup();
    renderAt('/does-not-exist');

    expect(await screen.findByLabelText('Page not found')).toBeInTheDocument();

    // CTA should route back to backend upload (new canonical route)
    await user.click(screen.getByRole('link', { name: /Go to File Upload/i }));
    expect(await screen.findByLabelText('File Upload')).toBeInTheDocument();
  });
});

describe('File Upload flow (mocked API)', () => {
  test('selecting a file enables Upload/Validate and calls upload + validation start (polling-capable)', async () => {
    const user = userEvent.setup();

    const api = makeApiMock({
      // New higher-level helpers used by FileUploadPage. Keep them mocked for deterministic tests.
      uploadSclFile: jest.fn().mockResolvedValue({
        ok: true,
        mocked: true,
        data: { uploadId: 'mock-1', fileName: 'sample.icd', message: 'uploaded' }
      }),
      startValidation: jest.fn().mockResolvedValue({
        ok: true,
        mocked: true,
        data: { validationId: 'val-1' }
      }),
      pollValidationUntilDone: jest.fn().mockResolvedValue({
        ok: true,
        mocked: true,
        data: { details: [] }
      })
    });
    createApiClient.mockReturnValue(api);

    renderAt('/backend/upload');

    // Initially disabled because no file selected
    const uploadBtn = screen.getByRole('button', { name: /upload/i });
    const validateBtn = screen.getByRole('button', { name: /validate/i });
    expect(uploadBtn).toBeDisabled();
    expect(validateBtn).toBeDisabled();

    const fileInput = screen.getByLabelText(/select scl file/i);
    const file = new File(['dummy'], 'sample.icd', { type: 'text/xml' });
    await user.upload(fileInput, file);

    // Buttons become enabled
    expect(uploadBtn).toBeEnabled();
    expect(validateBtn).toBeEnabled();

    // Upload triggers api.uploadSclFile(file) when available (new behavior)
    await user.click(uploadBtn);
    await waitFor(() => expect(api.uploadSclFile).toHaveBeenCalledTimes(1));
    expect(api.uploadSclFile.mock.calls[0][0]).toBe(file);

    // Validate triggers startValidation + poll (new behavior)
    await user.click(validateBtn);
    await waitFor(() => expect(api.startValidation).toHaveBeenCalledTimes(1));
    expect(api.startValidation.mock.calls[0][0]).toMatchObject({ fileName: 'sample.icd' });

    await waitFor(() => expect(api.pollValidationUntilDone).toHaveBeenCalledTimes(1));
  });
});

describe('Validation Report rendering states', () => {
  test('when no validation result, shows informational placeholder item', async () => {
    const user = userEvent.setup();

    // Validation Report lives in the Health context namespace.
    renderAt('/health/report');

    expect(await screen.findByLabelText('Validation Report')).toBeInTheDocument();
    expect(screen.getByText(/Run validation from File Upload to see issues/i)).toBeInTheDocument();

    // Ensure download link is not present when no validationResult exists
    expect(screen.queryByRole('link', { name: /download json/i })).not.toBeInTheDocument();

    // Navigate within Health context without triggering real network calls
    const nav = screen.getByLabelText(/module navigation/i);
    await user.click(within(nav).getByRole('link', { name: /Anomaly Detection/i }));
    expect(await screen.findByLabelText('Anomaly Detection')).toBeInTheDocument();

    // Switch context using the top tabs, then click File Upload in backend context.
    const topNav = screen.getByLabelText(/top navigation/i);
    await user.click(within(topNav).getByRole('link', { name: /Backend Configuration/i }));

    const backendNav = screen.getByLabelText(/module navigation/i);
    await user.click(within(backendNav).getByRole('link', { name: /File Upload/i }));
    expect(await screen.findByLabelText('File Upload')).toBeInTheDocument();
  });

  test('after validation, report shows items and Download JSON link', async () => {
    const user = userEvent.setup();

    // Have validate return some detail items.
    const api = makeApiMock({
      request: jest.fn().mockResolvedValue({
        ok: true,
        mocked: true,
        data: {
          details: [
            { severity: 'error', code: 'LN-001', message: 'Missing mandatory DO in LN XCBR.' },
            { severity: 'warning', code: 'SCADA-002', message: 'SCADA point name non-standard mapping.' }
          ]
        }
      })
    });
    createApiClient.mockReturnValue(api);

    // Start from backend upload (new namespace)
    renderAt('/backend/upload');

    const fileInput = screen.getByLabelText(/select scl file/i);
    const file = new File(['dummy'], 'sample.icd', { type: 'text/xml' });
    await user.upload(fileInput, file);

    await user.click(screen.getByRole('button', { name: /validate/i }));
    await waitFor(() => expect(api.request).toHaveBeenCalledTimes(1));

    // Switch to Health context via top tabs, then select Validation Report from the Health sidebar.
    const topNav = screen.getByLabelText(/top navigation/i);
    await user.click(within(topNav).getByRole('link', { name: /Health/i }));

    const moduleNav = screen.getByLabelText(/module navigation/i);
    const reportLink = within(moduleNav).getByRole('link', { name: /Validation Report/i });
    expect(reportLink).toHaveAttribute('href', '/health/report');
    await user.click(reportLink);

    expect(await screen.findByLabelText('Validation Report')).toBeInTheDocument();
    expect(screen.getByText('LN-001')).toBeInTheDocument();
    expect(screen.getByText('SCADA-002')).toBeInTheDocument();
    expect(screen.getByText(/Missing mandatory DO/i)).toBeInTheDocument();

    // Download link should appear once validationResult exists
    expect(screen.getByRole('link', { name: /download json/i })).toBeInTheDocument();
  });
});

describe('Settings env/config display', () => {
  test('renders Node environment, API base and WS status/url from env', async () => {
    // Set explicit env vars for this test (CRA exposes REACT_APP_*).
    // We restore after test to avoid cross-test pollution.
    const oldEnv = { ...process.env };
    process.env.REACT_APP_NODE_ENV = 'test';
    process.env.REACT_APP_API_BASE = 'http://example.test/api';
    process.env.REACT_APP_WS_URL = 'ws://example.test/ws';
    process.env.REACT_APP_HEALTHCHECK_PATH = '/healthz';
    process.env.REACT_APP_FEATURE_FLAGS = 'flagA,flagB';
    process.env.REACT_APP_EXPERIMENTS_ENABLED = 'true';

    try {
      const api = makeApiMock({ hasBackend: true });
      const ws = makeWsMock({ getStatus: jest.fn(() => 'open') });
      createApiClient.mockReturnValue(api);
      createWsClient.mockReturnValue(ws);

      renderAt('/backend/settings');

      const settingsPage = await screen.findByLabelText('Settings');
      const settings = within(settingsPage);

      // Node env
      expect(settings.getByText('test')).toBeInTheDocument();

      // API base and configured indicator (scope to Settings to avoid TopNav "Backend configured")
      expect(settings.getByText(/^Configured$/i)).toBeInTheDocument();
      expect(settings.getByText('http://example.test/api')).toBeInTheDocument();

      // WS URL and status (from ws client)
      expect(screen.getByText(/Status: open/i)).toBeInTheDocument();
      expect(screen.getByText('ws://example.test/ws')).toBeInTheDocument();

      // Healthcheck path/flags raw presence
      expect(screen.getByText('/healthz')).toBeInTheDocument();
      expect(screen.getByText(/flagA,flagB/i)).toBeInTheDocument();
      expect(screen.getByText('true')).toBeInTheDocument();
    } finally {
      process.env = oldEnv;
    }
  });

  test('can render via MemoryRouter (sanity)', async () => {
    renderAt('/backend/upload');
    expect(await screen.findByLabelText('File Upload')).toBeInTheDocument();
  });
});
