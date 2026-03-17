import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Mock service factories used by AppProvider (AppContext.js).
// This keeps tests stable and avoids any real fetch/WebSocket/network behavior.
jest.mock('./services/apiClient', () => ({
  createApiClient: jest.fn()
}));

jest.mock('./services/wsClient', () => ({
  createWsClient: jest.fn()
}));

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

beforeEach(() => {
  jest.clearAllMocks();

  // Default mocks for most tests
  createApiClient.mockReturnValue(makeApiMock());
  createWsClient.mockReturnValue(makeWsMock());
});

describe('App shell + routing', () => {
  test('renders top brand and module navigation', async () => {
    render(<App />);

    expect(screen.getByLabelText(/application brand/i)).toBeInTheDocument();
    expect(screen.getByText(/IEC 61850 SIV-Tool/i)).toBeInTheDocument();

    const nav = screen.getByLabelText(/module navigation/i);
    expect(within(nav).getByRole('link', { name: /File Upload/i })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Validation Report/i })).toBeInTheDocument();

    // TopNav triggers ws.connect() on mount and also calls api.getHealth()
    await waitFor(() => expect(createWsClient).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(createApiClient).toHaveBeenCalledTimes(1));

    const ws = createWsClient.mock.results[0].value;
    const api = createApiClient.mock.results[0].value;

    expect(ws.connect).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.getHealth).toHaveBeenCalledTimes(1));
  });

  test('default route (/) redirects to File Upload', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);

    // FileUploadPage renders a PageShell labeled by its title
    expect(await screen.findByLabelText('File Upload')).toBeInTheDocument();
    expect(
      screen.getByText(/Upload IEC 61850 SCL files/i)
    ).toBeInTheDocument();
  });

  test('sidebar navigation changes route to Settings', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/upload');
    render(<App />);

    const nav = screen.getByLabelText(/module navigation/i);
    await user.click(within(nav).getByRole('link', { name: /Settings/i }));

    expect(await screen.findByLabelText('Settings')).toBeInTheDocument();
    expect(screen.getByText(/Runtime configuration and diagnostics/i)).toBeInTheDocument();
  });

  test('unknown route renders NotFound page', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/does-not-exist');
    render(<App />);

    expect(await screen.findByLabelText('Page not found')).toBeInTheDocument();

    // CTA should route back to /upload
    await user.click(screen.getByRole('link', { name: /Go to File Upload/i }));
    expect(await screen.findByLabelText('File Upload')).toBeInTheDocument();
  });
});

describe('File Upload flow (mocked API)', () => {
  test('selecting a file enables Upload/Validate and calls api.upload/api.request', async () => {
    const user = userEvent.setup();

    const api = makeApiMock();
    createApiClient.mockReturnValue(api);

    window.history.pushState({}, '', '/upload');
    render(<App />);

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

    // Upload triggers api.upload('/upload', file)
    await user.click(uploadBtn);
    await waitFor(() => expect(api.upload).toHaveBeenCalledTimes(1));
    expect(api.upload.mock.calls[0][0]).toBe('/upload');
    expect(api.upload.mock.calls[0][1]).toBe(file);

    // Validate triggers api.request('/validate', {method:'POST', body:{fileName}})
    await user.click(validateBtn);
    await waitFor(() => expect(api.request).toHaveBeenCalledTimes(1));
    expect(api.request.mock.calls[0][0]).toBe('/validate');
    expect(api.request.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: { fileName: 'sample.icd' }
    });
  });
});

describe('Validation Report rendering states', () => {
  test('when no validation result, shows informational placeholder item', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/report');
    render(<App />);

    expect(await screen.findByLabelText('Validation Report')).toBeInTheDocument();
    expect(
      screen.getByText(/Run validation from File Upload to see issues/i)
    ).toBeInTheDocument();

    // Ensure download link is not present when no validationResult exists
    expect(screen.queryByRole('link', { name: /download json/i })).not.toBeInTheDocument();

    // Navigate away and back just to ensure route is stable
    const nav = screen.getByLabelText(/module navigation/i);
    await user.click(within(nav).getByRole('link', { name: /File Upload/i }));
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

    window.history.pushState({}, '', '/upload');
    render(<App />);

    const fileInput = screen.getByLabelText(/select scl file/i);
    const file = new File(['dummy'], 'sample.icd', { type: 'text/xml' });
    await user.upload(fileInput, file);

    await user.click(screen.getByRole('button', { name: /validate/i }));
    await waitFor(() => expect(api.request).toHaveBeenCalledTimes(1));

    // Now navigate to report and assert details are rendered
    const nav = screen.getByLabelText(/module navigation/i);
    await user.click(within(nav).getByRole('link', { name: /validation report/i }));

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

      window.history.pushState({}, '', '/settings');
      render(<App />);

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
});
