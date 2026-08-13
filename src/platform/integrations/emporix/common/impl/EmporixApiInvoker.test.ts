import { shouldBypassExternalCacheForDebug } from '@/platform/core/utils/debug-utils';
import type { MetricsService } from '@/platform/services/metrics/MetricsService';
import type { RequestContextService } from '@/platform/services/request-context/RequestContextService';
import type { EmporixTokenManager } from '../../common/EmporixTokenManager';
import type { EmporixConfig } from '../../config';
import EmporixApiInvoker from './EmporixApiInvoker';

// Mock debug-utils to avoid side effects
jest.mock('@/platform/core/utils/debug-utils', () => ({
  buildAndLogCurl: jest.fn().mockReturnValue('[TEST]'),
  logRequestPayload: jest.fn(),
  logResponse: jest.fn(),
  // Plain function, not jest.fn: the shared setup calls jest.resetAllMocks() after every
  // test, which would strip a mockReturnValue and leave getDebugLogger() returning undefined.
  getDebugLogger: () => ({ error: jest.fn() }),
  shouldBypassExternalCacheForDebug: jest.fn().mockReturnValue(false),
}));

// Mock global fetch
globalThis.fetch = jest.fn();

const mockConfig: EmporixConfig = {
  baseUrl: 'https://api.emporix.io',
  tenant: 'test-tenant',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  serverClientId: 'test-server-client-id',
  serverClientSecret: 'test-server-client-secret',
};

/** Metrics disabled by default, so the instrumentation short-circuits in most tests. */
const disabledMetricsService = (): MetricsService =>
  ({
    isEnabled: () => false,
  }) as unknown as MetricsService;

/**
 * `getCallSource()` returns 'client' here to mirror the server container: API route
 * handlers run on the server but are browser-triggered. See RequestContextService.
 */
const stubRequestContext = (): RequestContextService =>
  ({
    getSite: jest.fn().mockResolvedValue('test-site'),
    getCurrency: jest.fn().mockResolvedValue(undefined),
    getLanguage: jest.fn().mockResolvedValue(undefined),
    getCallSource: jest.fn().mockReturnValue('client'),
  }) as unknown as RequestContextService;

describe('EmporixApiInvoker', () => {
  let invoker: EmporixApiInvoker;
  let mockTokenManager: EmporixTokenManager;
  let mockMetricsService: MetricsService;
  let mockRequestContext: RequestContextService;
  const originalEnv = {
    NEXT_PUBLIC_DEBUG_API_CURL: process.env.NEXT_PUBLIC_DEBUG_API_CURL,
    NEXT_PUBLIC_DEBUG_API_OUTPUT: process.env.NEXT_PUBLIC_DEBUG_API_OUTPUT,
    NEXT_PUBLIC_DEBUG_API_RESPONSE: process.env.NEXT_PUBLIC_DEBUG_API_RESPONSE,
    NEXT_PUBLIC_DEBUG_API_ENDPOINTS: process.env.NEXT_PUBLIC_DEBUG_API_ENDPOINTS,
  };

  beforeEach(() => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ status: 200, ok: true });
    (shouldBypassExternalCacheForDebug as jest.Mock).mockReturnValue(false);

    mockTokenManager = {
      getPublicToken: jest.fn().mockResolvedValue({ accessToken: 'public-token-123' }),
      getAnonymousToken: jest.fn().mockResolvedValue({ accessToken: 'anon-token-123', sessionId: 'session-1' }),
      clearAnonymousToken: jest.fn(),
      getCustomerToken: jest.fn().mockResolvedValue({ accessToken: 'customer-token-123', sessionId: 'session-2' }),
      clearCustomerToken: jest.fn(),
      getSessionToken: jest
        .fn()
        .mockResolvedValue({ accessToken: 'session-token-123', saasToken: undefined, sessionId: 'session-3' }),
      getServiceAccessToken: jest.fn().mockResolvedValue('service-token-123'),
      clearPublicTokenCache: jest.fn(),
      clearServiceTokenCache: jest.fn(),
      forceRefreshSessionToken: jest.fn().mockResolvedValue({
        accessToken: 'fresh-session-token',
        saasToken: undefined,
        sessionId: 'session-3',
      }),
      clearTokens: jest.fn(),
      refreshCustomerTokenWithLegalEntity: jest.fn().mockResolvedValue(null),
    };

    mockMetricsService = disabledMetricsService();
    mockRequestContext = stubRequestContext();

    invoker = new EmporixApiInvoker(mockConfig, mockTokenManager, mockMetricsService, mockRequestContext);

    delete process.env.NEXT_PUBLIC_DEBUG_API_CURL;
    delete process.env.NEXT_PUBLIC_DEBUG_API_OUTPUT;
    delete process.env.NEXT_PUBLIC_DEBUG_API_RESPONSE;
    delete process.env.NEXT_PUBLIC_DEBUG_API_ENDPOINTS;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_DEBUG_API_CURL = originalEnv.NEXT_PUBLIC_DEBUG_API_CURL;
    process.env.NEXT_PUBLIC_DEBUG_API_OUTPUT = originalEnv.NEXT_PUBLIC_DEBUG_API_OUTPUT;
    process.env.NEXT_PUBLIC_DEBUG_API_RESPONSE = originalEnv.NEXT_PUBLIC_DEBUG_API_RESPONSE;
    process.env.NEXT_PUBLIC_DEBUG_API_ENDPOINTS = originalEnv.NEXT_PUBLIC_DEBUG_API_ENDPOINTS;
  });

  describe('authenticatedFetch cache behavior', () => {
    it('should not cache by default for service token (opt-in required)', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'service');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBeUndefined();
      expect(options.next).toBeUndefined();
    });

    it('should not cache by default for public token (opt-in required)', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'public');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBeUndefined();
      expect(options.next).toBeUndefined();
    });

    it('should opt in to caching via cacheSeconds for service token', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'service', undefined, undefined, 3600);

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBe('force-cache');
      expect(options.next).toEqual({ revalidate: 3600 });
    });

    it('should opt in to caching via cacheSeconds for public token', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'public', undefined, undefined, 60);

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBe('force-cache');
      expect(options.next).toEqual({ revalidate: 60 });
    });

    it('should not cache when cacheSeconds is 0 via explicit next option', async () => {
      await invoker.authenticatedFetch(
        '/test-url',
        { method: 'GET', next: { revalidate: 0 } } as RequestInit,
        'public',
      );

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.next).toEqual({ revalidate: 0 });
    });

    it('should respect pre-set cache: no-store for service token', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET', cache: 'no-store' }, 'service');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBe('no-store');
      expect(options.next).toBeUndefined();
    });

    it('should respect pre-set cache: no-store for public token', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET', cache: 'no-store' }, 'public');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBe('no-store');
      expect(options.next).toBeUndefined();
    });

    it('should not set cache option for session token', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'session');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBeUndefined();
      expect(options.next).toBeUndefined();
    });

    it('should respect pre-set next.revalidate for service token', async () => {
      await invoker.authenticatedFetch(
        '/test-url',
        { method: 'GET', next: { revalidate: 60 } } as RequestInit,
        'service',
      );

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.next).toEqual({ revalidate: 60 });
      expect(options.cache).toBeUndefined();
    });

    it('should add Authorization header with correct token for service calls', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'service');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.headers).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer service-token-123',
        }),
      );
    });

    it('should add session-id header for session token', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'session');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.headers).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer session-token-123',
          'session-id': 'session-3',
        }),
      );
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('should force no-store for %s with service token', async (method) => {
      await invoker.authenticatedFetch('/test-url', { method }, 'service');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBe('no-store');
      expect(options.next).toBeUndefined();
    });

    it('should force no-store for POST with public token', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'POST' }, 'public');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBe('no-store');
      expect(options.next).toBeUndefined();
    });

    it('should not inject force-cache when only next is set explicitly', async () => {
      await invoker.authenticatedFetch(
        '/test-url',
        { method: 'GET', next: { revalidate: 60 } } as RequestInit,
        'public',
      );

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBeUndefined();
      expect(options.next).toEqual({ revalidate: 60 });
    });

    it('should let explicit options.next override cacheSeconds opt-in', async () => {
      await invoker.authenticatedFetch(
        '/test-url',
        { method: 'GET', next: { revalidate: 60 } } as RequestInit,
        'public',
        undefined,
        undefined,
        3600,
      );

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.next).toEqual({ revalidate: 60 });
    });

    it('should force no-store for matching endpoint when debug curl logging is enabled', async () => {
      process.env.NEXT_PUBLIC_DEBUG_API_CURL = 'true';
      process.env.NEXT_PUBLIC_DEBUG_API_OUTPUT = 'BOTH';
      process.env.NEXT_PUBLIC_DEBUG_API_ENDPOINTS = 'quote';
      (shouldBypassExternalCacheForDebug as jest.Mock).mockReturnValue(true);

      await invoker.authenticatedFetch('/quote/test-tenant/quotes?page=1', { method: 'GET' }, 'service');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBe('no-store');
      expect(options.next).toBeUndefined();
    });

    it('should preserve cacheSeconds for non-matching endpoint when debug is enabled', async () => {
      process.env.NEXT_PUBLIC_DEBUG_API_CURL = 'true';
      process.env.NEXT_PUBLIC_DEBUG_API_OUTPUT = 'BOTH';
      process.env.NEXT_PUBLIC_DEBUG_API_ENDPOINTS = 'quote';
      (shouldBypassExternalCacheForDebug as jest.Mock).mockReturnValue(false);

      await invoker.authenticatedFetch(
        '/catalog/test-tenant/catalogs',
        { method: 'GET' },
        'service',
        undefined,
        undefined,
        60,
      );

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBe('force-cache');
      expect(options.next).toEqual({ revalidate: 60 });
    });

    it('should force no-store for matching endpoint when debug response logging is enabled', async () => {
      process.env.NEXT_PUBLIC_DEBUG_API_OUTPUT = 'BOTH';
      process.env.NEXT_PUBLIC_DEBUG_API_RESPONSE = 'STATUS-BODY';
      process.env.NEXT_PUBLIC_DEBUG_API_ENDPOINTS = 'approval';
      (shouldBypassExternalCacheForDebug as jest.Mock).mockReturnValue(true);

      await invoker.authenticatedFetch(
        '/approval/test-tenant/approvals?pageNumber=1',
        { method: 'GET' },
        'service',
        undefined,
        undefined,
        120,
      );

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBe('no-store');
      expect(options.next).toBeUndefined();
    });
  });

  describe('401 retry for cached tokens', () => {
    it('should clear the cached public token and replay the request once', async () => {
      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({ status: 401, ok: false })
        .mockResolvedValueOnce({ status: 200, ok: true });
      (mockTokenManager.getPublicToken as jest.Mock)
        .mockResolvedValueOnce({ accessToken: 'stale-public-token' })
        .mockResolvedValueOnce({ accessToken: 'fresh-public-token' });

      const response = await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'public');

      expect(mockTokenManager.clearPublicTokenCache).toHaveBeenCalledWith('test-tenant', 'test-client-id');
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);

      const [, firstOptions] = (globalThis.fetch as jest.Mock).mock.calls[0];
      const [, retryOptions] = (globalThis.fetch as jest.Mock).mock.calls[1];
      expect(firstOptions.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer stale-public-token' }));
      expect(retryOptions.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer fresh-public-token' }));
      expect(response.status).toBe(200);
    });

    it('should preserve caller headers on the retry when they arrive as a Headers instance', async () => {
      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({ status: 401, ok: false })
        .mockResolvedValueOnce({ status: 200, ok: true });

      await invoker.authenticatedFetch(
        '/test-url',
        { method: 'GET', headers: new Headers({ 'x-caller': 'keep-me' }) },
        'public',
      );

      const [, retryOptions] = (globalThis.fetch as jest.Mock).mock.calls[1];
      expect(retryOptions.headers).toEqual(expect.objectContaining({ 'x-caller': 'keep-me' }));
    });

    it('should clear the cached service token and replay the request once on 401', async () => {
      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({ status: 401, ok: false })
        .mockResolvedValueOnce({ status: 200, ok: true });
      (mockTokenManager.getServiceAccessToken as jest.Mock)
        .mockResolvedValueOnce('stale-service-token')
        .mockResolvedValueOnce('fresh-service-token');

      const response = await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'service');

      expect(mockTokenManager.clearServiceTokenCache).toHaveBeenCalledWith(
        'test-tenant',
        'test-server-client-id',
        'test-server-client-secret',
        undefined,
      );
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      const [, retryOptions] = (globalThis.fetch as jest.Mock).mock.calls[1];
      expect(retryOptions.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer fresh-service-token' }));
      expect(response.status).toBe(200);
    });

    it('should force-refresh session token and replay the request once on 401', async () => {
      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({ status: 401, ok: false })
        .mockResolvedValueOnce({ status: 200, ok: true });
      (mockTokenManager.getSessionToken as jest.Mock).mockResolvedValueOnce({
        accessToken: 'stale-session-token',
        saasToken: undefined,
        sessionId: 'session-3',
      });

      const response = await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'session');

      expect(mockTokenManager.forceRefreshSessionToken).toHaveBeenCalledWith('test-tenant', 'test-client-id');
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      const [, retryOptions] = (globalThis.fetch as jest.Mock).mock.calls[1];
      expect(retryOptions.headers).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer fresh-session-token',
          'session-id': 'session-3',
        }),
      );
      expect(response.status).toBe(200);
    });

    it('should not retry a successful public call', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'public');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(mockTokenManager.clearPublicTokenCache).not.toHaveBeenCalled();
    });
  });

  describe('metrics instrumentation', () => {
    const buildEnabledMetrics = () => {
      const totalCounter = { inc: jest.fn() };
      const errorCounter = { inc: jest.fn() };
      const histogram = { observe: jest.fn() };
      const service = {
        isEnabled: () => true,
        getOrCreateCounter: jest.fn((name: string) => (name.endsWith('_errors_total') ? errorCounter : totalCounter)),
        getOrCreateHistogram: jest.fn(() => histogram),
      } as unknown as MetricsService;
      return { service, totalCounter, errorCounter, histogram };
    };

    it('should record the fetch total and duration for a successful call', async () => {
      const { service, totalCounter, errorCounter, histogram } = buildEnabledMetrics();
      const instrumented = new EmporixApiInvoker(mockConfig, mockTokenManager, service, mockRequestContext);

      await instrumented.authenticatedFetch('/cart/test-tenant/carts', { method: 'GET' }, 'service', undefined, {
        source: 'cart',
        routePattern: '/cart/:tenant/carts',
      });

      expect(totalCounter.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          site: 'test-site',
          method: 'GET',
          status_code: '200',
          source: 'cart',
          token_type: 'service',
          route: '/cart/:tenant/carts',
        }),
      );
      expect(errorCounter.inc).not.toHaveBeenCalled();
      expect(histogram.observe).toHaveBeenCalledTimes(1);
    });

    it('should record an error with status_code 0 and rethrow when the fetch rejects', async () => {
      const { service, totalCounter, errorCounter } = buildEnabledMetrics();
      const instrumented = new EmporixApiInvoker(mockConfig, mockTokenManager, service, mockRequestContext);
      (globalThis.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));

      await expect(
        instrumented.authenticatedFetch('/cart/test-tenant/carts', { method: 'GET' }, 'service', undefined, {
          source: 'cart',
          routePattern: '/cart/:tenant/carts',
        }),
      ).rejects.toThrow('network down');

      expect(totalCounter.inc).toHaveBeenCalledWith(expect.objectContaining({ status_code: '0' }));
      expect(errorCounter.inc).toHaveBeenCalledWith(expect.objectContaining({ status_code: '0' }));
    });

    it('should count a non-ok response as an error', async () => {
      const { service, errorCounter } = buildEnabledMetrics();
      const instrumented = new EmporixApiInvoker(mockConfig, mockTokenManager, service, mockRequestContext);
      (globalThis.fetch as jest.Mock).mockResolvedValue({ status: 500, ok: false });

      await instrumented.authenticatedFetch('/cart/test-tenant/carts', { method: 'GET' }, 'service', undefined, {
        source: 'cart',
        routePattern: '/cart/:tenant/carts',
      });

      expect(errorCounter.inc).toHaveBeenCalledWith(expect.objectContaining({ status_code: '500' }));
    });

    it('should not touch the metrics service when no metrics params are passed', async () => {
      const { service, totalCounter, histogram } = buildEnabledMetrics();
      const instrumented = new EmporixApiInvoker(mockConfig, mockTokenManager, service, mockRequestContext);

      await instrumented.authenticatedFetch('/test-url', { method: 'GET' }, 'service');

      expect(totalCounter.inc).not.toHaveBeenCalled();
      expect(histogram.observe).not.toHaveBeenCalled();
    });
  });

  describe('debug call source', () => {
    it('should tag upstream calls with the environment call source from RequestContextService', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'service');

      expect(mockRequestContext.getCallSource).toHaveBeenCalled();
      expect(shouldBypassExternalCacheForDebug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ callType: 'external', source: 'client' }),
      );
    });
  });
});
