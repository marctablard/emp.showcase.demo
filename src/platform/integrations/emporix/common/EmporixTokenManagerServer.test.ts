import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { RequestContextService } from '@/platform/services/request-context/RequestContextService';
import type { AnonymousTokenSessionParams, EmporixAnonymousTokenResponse } from '../model/oauth';
import type { EmporixOAuthApi } from '../oauth/EmporixOAuthApi';
// Imported after the jest.mock calls above so the module-level `next/headers`
// and `@/platform/server` imports resolve to the stubs.
import EmporixTokenManagerServer from './impl/EmporixTokenManagerServer';

// Prevent the real `next/headers` import (only available at Next runtime)
// from executing when this module is pulled in — `resolveSessionParams` itself
// does not call `cookies()` (it delegates to `RequestContextService`), but the
// module imports `next/headers` at the top level for `readTokens`/`writeTokens`.
jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}));

// Avoid pulling the generated DI container — `RequestPreferences.ts` imports
// `@/platform/server` for its logger, and we don't need any of that here.
jest.mock('@/platform/server', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
    })),
  },
}));

/**
 * Test subclass that exposes `fetchAnonymousToken` publicly. The real class
 * keeps it `protected`, and `resolveSessionParams` is `private` — the cleanest
 * way to cover the cookie-seeding logic without reaching into internals is to
 * exercise the public-from-subclass entry point and assert the `sessionParams`
 * observed by `oauthApi.getAnonymousToken`, which is the only place those
 * params are consumed.
 */
class TestableTokenManager extends EmporixTokenManagerServer {
  public async exposeFetchAnonymousToken(
    tenant: string,
    clientId: string,
    sessionParams?: AnonymousTokenSessionParams,
  ) {
    // Cast is only needed because `fetchAnonymousToken` is protected on the
    // parent; runtime behavior is identical.
    return (
      this as unknown as {
        fetchAnonymousToken: (
          anonymousToken: undefined,
          tenant: string,
          clientId: string,
          sessionParams?: AnonymousTokenSessionParams,
        ) => Promise<unknown>;
      }
    ).fetchAnonymousToken(undefined, tenant, clientId, sessionParams);
  }
}

type MockRequestContext = jest.Mocked<RequestContextService>;

describe('EmporixTokenManagerServer.resolveSessionParams', () => {
  const tenant = 'test-tenant';
  const clientId = 'test-client-id';

  let oauthApi: jest.Mocked<Pick<EmporixOAuthApi, 'getAnonymousToken' | 'refreshAnonymousToken'>>;
  let requestContext: MockRequestContext;
  let logger: jest.Mocked<LoggerService>;
  let manager: TestableTokenManager;
  const originalEnv = {
    NEXT_PUBLIC_DEFAULT_SITE: process.env.NEXT_PUBLIC_DEFAULT_SITE,
    NEXT_PUBLIC_DEFAULT_CURRENCY: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY,
    NEXT_PUBLIC_DEFAULT_LANGUAGE: process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE,
    NEXT_PUBLIC_DEFAULT_COUNTRY: process.env.NEXT_PUBLIC_DEFAULT_COUNTRY,
    NEXT_PUBLIC_DEFAULT_REGION: process.env.NEXT_PUBLIC_DEFAULT_REGION,
  };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEFAULT_SITE = 'main';
    process.env.NEXT_PUBLIC_DEFAULT_CURRENCY = 'EUR';
    process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE = 'en';
    process.env.NEXT_PUBLIC_DEFAULT_COUNTRY = 'DE';
    process.env.NEXT_PUBLIC_DEFAULT_REGION = 'DACH';

    const tokenResponse: EmporixAnonymousTokenResponse = {
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600,
      refresh_token_expires_in: 86400,
      session_id: 'sid',
    } as EmporixAnonymousTokenResponse;

    oauthApi = {
      getAnonymousToken: jest.fn().mockResolvedValue(tokenResponse),
      refreshAnonymousToken: jest.fn().mockResolvedValue(tokenResponse),
    };
    requestContext = {
      getSite: jest.fn(),
      getCurrency: jest.fn(),
      getLanguage: jest.fn(),
    } as unknown as MockRequestContext;
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    manager = new TestableTokenManager(
      oauthApi as unknown as EmporixOAuthApi,
      requestContext as RequestContextService,
      logger as LoggerService,
    );
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_DEFAULT_SITE = originalEnv.NEXT_PUBLIC_DEFAULT_SITE;
    process.env.NEXT_PUBLIC_DEFAULT_CURRENCY = originalEnv.NEXT_PUBLIC_DEFAULT_CURRENCY;
    process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE = originalEnv.NEXT_PUBLIC_DEFAULT_LANGUAGE;
    process.env.NEXT_PUBLIC_DEFAULT_COUNTRY = originalEnv.NEXT_PUBLIC_DEFAULT_COUNTRY;
    process.env.NEXT_PUBLIC_DEFAULT_REGION = originalEnv.NEXT_PUBLIC_DEFAULT_REGION;
  });

  function capturedSessionParams(): AnonymousTokenSessionParams {
    expect(oauthApi.getAnonymousToken).toHaveBeenCalledTimes(1);
    const [, , sessionParams] = oauthApi.getAnonymousToken.mock.calls[0];
    return sessionParams as AnonymousTokenSessionParams;
  }

  function capturedDebugPayload(): Record<string, unknown> {
    const debugCall = logger.debug.mock.calls.find(
      (call) => typeof call[1] === 'string' && call[1] === 'resolveSessionParams',
    );
    expect(debugCall).toBeDefined();
    return debugCall![0] as Record<string, unknown>;
  }

  it('seeds sessionParams with all three cookie values when present (Scenario 1)', async () => {
    requestContext.getSite.mockResolvedValue('us');
    requestContext.getCurrency.mockResolvedValue('USD');
    requestContext.getLanguage.mockResolvedValue('de');

    await manager.exposeFetchAnonymousToken(tenant, clientId);

    expect(capturedSessionParams()).toEqual({
      siteCode: 'us',
      currency: 'USD',
      language: 'de',
      // targetLocation/region still come from env defaults — the 2026-04-21
      // Customer Service changelog does not expose a country/region cookie and
      // the plan intentionally keeps those on the env path.
      targetLocation: 'DE',
      region: 'DACH',
    });
    expect(capturedDebugPayload().fallback).toMatchObject({
      siteCode: 'request-context',
      currency: 'cookie',
      language: 'cookie',
      targetLocation: 'env-default',
      region: 'env-default',
    });
  });

  it('falls back to NEXT_PUBLIC_DEFAULT_CURRENCY when the currency cookie is missing (Scenario 2)', async () => {
    requestContext.getSite.mockResolvedValue('us');
    requestContext.getCurrency.mockResolvedValue(undefined);
    requestContext.getLanguage.mockResolvedValue('de');

    await manager.exposeFetchAnonymousToken(tenant, clientId);

    expect(capturedSessionParams().currency).toBe('EUR');
    expect(capturedDebugPayload().fallback).toMatchObject({ currency: 'env-default' });
  });

  it('falls back to NEXT_PUBLIC_DEFAULT_LANGUAGE when the language cookie is missing (Scenario 3)', async () => {
    requestContext.getSite.mockResolvedValue('us');
    requestContext.getCurrency.mockResolvedValue('USD');
    requestContext.getLanguage.mockResolvedValue(undefined);

    await manager.exposeFetchAnonymousToken(tenant, clientId);

    expect(capturedSessionParams().language).toBe('en');
    expect(capturedDebugPayload().fallback).toMatchObject({ language: 'env-default' });
  });

  it('falls back to env defaults when RequestContextService throws (dynamic context) (Scenario 4)', async () => {
    // Simulate cookies()/headers() being unavailable (e.g. static generation).
    requestContext.getSite.mockRejectedValue(new Error('dynamic server usage'));
    requestContext.getCurrency.mockRejectedValue(new Error('dynamic server usage'));
    requestContext.getLanguage.mockRejectedValue(new Error('dynamic server usage'));

    await manager.exposeFetchAnonymousToken(tenant, clientId);

    expect(capturedSessionParams()).toEqual({
      siteCode: 'main',
      currency: 'EUR',
      language: 'en',
      targetLocation: 'DE',
      region: 'DACH',
    });
    expect(capturedDebugPayload().fallback).toMatchObject({
      siteCode: 'env-default',
      currency: 'env-default',
      language: 'env-default',
    });
  });

  it('emits a per-field fallback debug log matching the source of each field (Scenario 5)', async () => {
    requestContext.getSite.mockResolvedValue('us');
    requestContext.getCurrency.mockResolvedValue('USD');
    requestContext.getLanguage.mockResolvedValue(undefined);

    await manager.exposeFetchAnonymousToken(tenant, clientId);

    // Assert the full debug payload shape: params flattened in + nested `fallback` object.
    const payload = capturedDebugPayload();
    expect(payload).toMatchObject({
      siteCode: 'us',
      currency: 'USD',
      language: 'en',
      targetLocation: 'DE',
      region: 'DACH',
      fallback: {
        siteCode: 'request-context',
        currency: 'cookie',
        language: 'env-default',
        targetLocation: 'env-default',
        region: 'env-default',
      },
    });
  });

  it('does not call resolveSessionParams when an explicit sessionParams argument is provided', async () => {
    const explicit: AnonymousTokenSessionParams = {
      siteCode: 'explicit-site',
      currency: 'JPY',
    };

    await manager.exposeFetchAnonymousToken(tenant, clientId, explicit);

    expect(requestContext.getSite).not.toHaveBeenCalled();
    expect(requestContext.getCurrency).not.toHaveBeenCalled();
    expect(requestContext.getLanguage).not.toHaveBeenCalled();
    expect(capturedSessionParams()).toBe(explicit);
  });
});
