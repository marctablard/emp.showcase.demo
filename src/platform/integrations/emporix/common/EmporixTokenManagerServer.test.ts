import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { RequestContextService } from '@/platform/services/request-context/RequestContextService';
import type { AnonymousTokenSessionParams, EmporixAnonymousTokenResponse } from '../model/oauth';
import type { EmporixOAuthApi } from '../oauth/EmporixOAuthApi';
// Imported after the jest.mock calls above so the module-level `next/headers`
// and `@/platform/server` imports resolve to the stubs.
import EmporixTokenManagerServer from './impl/EmporixTokenManagerServer';
import { decryptTokenPayload, encryptTokenPayload, isEncryptedFormat } from './util/token-encryption';

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

describe('EmporixTokenManagerServer.readTokens / writeTokens encryption', () => {
  const tenant = 'enc-tenant';
  const testSecret = 'test-secret-for-encryption-tests-long-enough';
  let cookieStore: { get: jest.Mock; set: jest.Mock };
  let logger: jest.Mocked<LoggerService>;
  let manager: InstanceType<typeof EmporixTokenManagerServer>;

  const mockOAuthApi = {
    getPublicToken: jest.fn(),
    getAnonymousToken: jest.fn(),
    refreshAnonymousToken: jest.fn(),
    getCustomerToken: jest.fn(),
    refreshCustomerToken: jest.fn(),
    getServiceAccessToken: jest.fn(),
  };

  const mockRequestContext = {
    getSite: jest.fn(),
    getCurrency: jest.fn(),
    getLanguage: jest.fn(),
  };

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = testSecret;
    cookieStore = { get: jest.fn(), set: jest.fn() };
    const { cookies } = jest.requireMock('next/headers') as { cookies: jest.Mock };
    cookies.mockResolvedValue(cookieStore);

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    manager = new EmporixTokenManagerServer(
      mockOAuthApi as unknown as EmporixOAuthApi,
      mockRequestContext as unknown as RequestContextService,
      logger as LoggerService,
    );
  });

  afterEach(() => {
    delete process.env.NEXTAUTH_SECRET;
  });

  it('writeTokens stores an encrypted value with enc.v1: prefix', async () => {
    const tokens = { anonymousToken: { token: { access_token: 'tok-123', session_id: 'sid' }, expiryAt: 99999 } };
    await (manager as unknown as { writeTokens: (t: unknown, tenant: string) => Promise<void> }).writeTokens(
      tokens,
      tenant,
    );

    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    const [, cookieValue] = cookieStore.set.mock.calls[0];
    expect(isEncryptedFormat(cookieValue)).toBe(true);
    expect(cookieValue).not.toContain('tok-123');
    expect(cookieValue).not.toContain('access_token');
  });

  it('writeTokens preserves cookie options', async () => {
    await (manager as unknown as { writeTokens: (t: unknown, tenant: string) => Promise<void> }).writeTokens(
      {},
      tenant,
    );
    const [, , options] = cookieStore.set.mock.calls[0];
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  });

  it('readTokens decrypts an encrypted cookie and returns TokenStore', async () => {
    const tokens = { anonymousToken: { token: { access_token: 'abc', session_id: 's1' }, expiryAt: 1000 } };
    const encrypted = encryptTokenPayload(JSON.stringify(tokens), testSecret);
    cookieStore.get.mockReturnValue({ value: encrypted });

    const result = await (
      manager as unknown as { readTokens: (tenant: string) => Promise<Record<string, unknown>> }
    ).readTokens(tenant);
    expect(result).toMatchObject(tokens);
  });

  it('readTokens handles legacy base64 cookies (backward compat)', async () => {
    const tokens = { anonymousToken: { token: { access_token: 'legacy', session_id: 'ls1' }, expiryAt: 2000 } };
    const b64 = Buffer.from(JSON.stringify(tokens)).toString('base64');
    cookieStore.get.mockReturnValue({ value: b64 });

    const result = await (
      manager as unknown as { readTokens: (tenant: string) => Promise<Record<string, unknown>> }
    ).readTokens(tenant);
    expect(result).toMatchObject(tokens);
  });

  it('readTokens returns {} and logs warning for corrupted cookie', async () => {
    cookieStore.get.mockReturnValue({ value: 'enc.v1:corrupted-garbage-data' });

    const result = await (
      manager as unknown as { readTokens: (tenant: string) => Promise<Record<string, unknown>> }
    ).readTokens(tenant);
    expect(result).toEqual({});
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ tenant }),
      expect.stringContaining('Failed to decrypt'),
    );
  });

  it('readTokens returns {} when cookie is missing', async () => {
    cookieStore.get.mockReturnValue(undefined);

    const result = await (
      manager as unknown as { readTokens: (tenant: string) => Promise<Record<string, unknown>> }
    ).readTokens(tenant);
    expect(result).toEqual({});
  });

  it('writeTokens omits serviceToken from cookie payload', async () => {
    const tokens = {
      anonymousToken: { token: { access_token: 'a1' }, expiryAt: 1 },
      serviceToken: { token: { access_token: 'service-secret' }, expiryAt: 2 },
    };
    await (manager as unknown as { writeTokens: (t: unknown, tenant: string) => Promise<void> }).writeTokens(
      tokens,
      tenant,
    );
    const [, cookieValue] = cookieStore.set.mock.calls[0];
    const decrypted = decryptTokenPayload(cookieValue, testSecret);
    const parsed = JSON.parse(decrypted);
    expect(parsed.serviceToken).toBeUndefined();
    expect(parsed.anonymousToken).toBeDefined();
  });
});
