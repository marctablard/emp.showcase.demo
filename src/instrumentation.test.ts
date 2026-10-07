/**
 * Boot-wiring test for the Next.js `register()` instrumentation hook
 * (EMP-16 Phase G, AC #2).
 *
 * AC #2 — "`NEXT_CMS_FALLBACK_PROVIDER` empty ⇒ composite gone, primary
 * binds directly. Test via an `instrumentation.ts` sub-stub." — is covered in
 * TWO layers:
 *  - The env-driven alias-vs-composite DECISION (empty env → plain alias, no
 *    composite) is pinned in `bind-active-cms-adapter.test.ts`.
 *  - This test pins the other half: that `register()` actually delegates that
 *    decision to `bindActiveCmsAdapter` on BOTH the server and the ssr
 *    container at boot — otherwise the empty-env decision would reach one
 *    module graph but not the other (the Turbopack split, see ADR 0001), and
 *    the composite could silently survive on the render graph.
 *
 * All of `register()`'s dynamic imports are stubbed; we assert the wiring
 * sequence, not Inversify or the metrics server.
 *
 * Tier: Library Tests (node env) — routed by an explicit `testMatch` entry in
 * jest.config.js, since this file sits at the src/ root and matches none of
 * the directory-scoped patterns.
 */

const bindActiveCmsAdapterMock = jest.fn();
const startMetricsServerMock = jest.fn((..._args: unknown[]) => ({ started: false, port: 0, host: '' }));
const runStartupHealthcheckMock = jest.fn(async (..._args: unknown[]) => {});

const loggerStub = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
const metricsStub = {};

const serverContainer = {
  get: jest.fn((id: string) => {
    if (id === 'LoggerService') return loggerStub;
    if (id === 'MetricsService') return metricsStub;
    return undefined;
  }),
};
const ssrContainer = {
  get: jest.fn(() => undefined),
};

jest.mock('@/platform/server', () => ({ __esModule: true, default: serverContainer }));
jest.mock('@/platform/ssr', () => ({ __esModule: true, default: ssrContainer }));
jest.mock('./metrics-server', () => ({
  __esModule: true,
  startMetricsServer: (...args: unknown[]) => startMetricsServerMock(...args),
}));
jest.mock('@/platform/services/cms/bind-active-cms-adapter', () => ({
  __esModule: true,
  bindActiveCmsAdapter: (...args: unknown[]) => bindActiveCmsAdapterMock(...args),
}));
jest.mock('@/platform/healthcheck/startup-healthcheck', () => ({
  __esModule: true,
  runStartupHealthcheck: (...args: unknown[]) => runStartupHealthcheckMock(...args),
}));

const ORIGINAL_RUNTIME = process.env.NEXT_RUNTIME;

afterEach(() => {
  jest.clearAllMocks();
  if (ORIGINAL_RUNTIME === undefined) {
    delete process.env.NEXT_RUNTIME;
  } else {
    process.env.NEXT_RUNTIME = ORIGINAL_RUNTIME;
  }
});

describe('register() — CMS adapter boot wiring', () => {
  it('binds the active CMS adapter on BOTH the server and ssr container in the nodejs runtime', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    const { register } = await import('./instrumentation');

    await register();

    expect(bindActiveCmsAdapterMock).toHaveBeenCalledTimes(2);
    const containersBound = bindActiveCmsAdapterMock.mock.calls.map((call) => call[0]);
    expect(containersBound).toContain(serverContainer);
    expect(containersBound).toContain(ssrContainer);
  });

  it('does not wire the CMS adapter (or any nodejs-only boot step) in the edge runtime', async () => {
    process.env.NEXT_RUNTIME = 'edge';
    const { register } = await import('./instrumentation');

    await register();

    expect(bindActiveCmsAdapterMock).not.toHaveBeenCalled();
    expect(runStartupHealthcheckMock).not.toHaveBeenCalled();
  });
});
