/**
 * Cache-mode tests for the OAuth invokers.
 *
 * OAuth token responses must bypass Next.js Data Cache — that cache persists
 * across Vercel deploys and would serve revoked tokens after credential
 * rotation. These tests assert that the server and SSR OAuth implementations
 * always send `cache: 'no-store'` on `/oauth/token` and on the anonymous
 * public-login endpoint, and never pass `next.revalidate`.
 */
import type { MetricsService } from '@/platform/services/metrics/MetricsService';
import type { RequestContextService } from '@/platform/services/request-context/RequestContextService';
import EmporixOAuthApiSSR from './impl/EmporixOAuthApiSSR';
import EmporixOAuthApiServer from './impl/EmporixOAuthApiServer';

type FetchInitCapture = {
  url: string;
  init: RequestInit;
};

const disabledMetricsService = (): MetricsService =>
  ({
    isEnabled: () => false,
  }) as unknown as MetricsService;

const stubRequestContext = (): RequestContextService =>
  ({
    getSite: async () => 'test-site',
  }) as unknown as RequestContextService;

function buildTokenResponse(): Response {
  return new Response(
    JSON.stringify({
      access_token: 'fake-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'test',
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function buildAnonymousResponse(): Response {
  return new Response(
    JSON.stringify({
      access_token: 'anon-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'test',
      session_id: 'sid-1',
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('OAuth invokers — cache mode', () => {
  const captured: FetchInitCapture[] = [];
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    captured.length = 0;
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function installFetchSpy(response: () => Response): void {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      captured.push({
        url: typeof input === 'string' ? input : input instanceof URL ? input.toString() : String(input),
        init: init ?? {},
      });
      return response();
    }) as unknown as typeof globalThis.fetch;
  }

  it('server getServiceAccessToken uses cache: "no-store" and no next.revalidate', async () => {
    installFetchSpy(buildTokenResponse);
    const api = new EmporixOAuthApiServer(disabledMetricsService(), stubRequestContext());

    await api.getServiceAccessToken('tenant', 'cid', 'secret');

    expect(captured).toHaveLength(1);
    const { init } = captured[0];
    expect(init.cache).toBe('no-store');
    expect((init as Record<string, unknown>).next).toBeUndefined();
  });

  it('SSR getServiceAccessToken uses cache: "no-store" and no next.revalidate', async () => {
    installFetchSpy(buildTokenResponse);
    const api = new EmporixOAuthApiSSR(disabledMetricsService(), stubRequestContext());

    await api.getServiceAccessToken('tenant', 'cid', 'secret');

    expect(captured).toHaveLength(1);
    const { init } = captured[0];
    expect(init.cache).toBe('no-store');
    expect((init as Record<string, unknown>).next).toBeUndefined();
  });

  it('server getPublicToken uses cache: "no-store" and no next.revalidate', async () => {
    installFetchSpy(buildAnonymousResponse);
    const api = new EmporixOAuthApiServer(disabledMetricsService(), stubRequestContext());

    await api.getPublicToken('tenant', 'cid');

    expect(captured).toHaveLength(1);
    const { init } = captured[0];
    expect(init.cache).toBe('no-store');
    expect((init as Record<string, unknown>).next).toBeUndefined();
  });

  it('SSR getPublicToken uses cache: "no-store" and no next.revalidate', async () => {
    installFetchSpy(buildAnonymousResponse);
    const api = new EmporixOAuthApiSSR(disabledMetricsService(), stubRequestContext());

    await api.getPublicToken('tenant', 'cid');

    expect(captured).toHaveLength(1);
    const { init } = captured[0];
    expect(init.cache).toBe('no-store');
    expect((init as Record<string, unknown>).next).toBeUndefined();
  });
});
