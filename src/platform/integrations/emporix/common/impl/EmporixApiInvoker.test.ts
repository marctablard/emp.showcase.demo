import type { EmporixTokenManager } from '../../common/EmporixTokenManager';
import type { EmporixConfig } from '../../config';
import EmporixApiInvoker from './EmporixApiInvoker';

// Mock debug-utils to avoid side effects
jest.mock('@/platform/core/utils/debug-utils', () => ({
  buildAndLogCurl: jest.fn().mockReturnValue('[TEST]'),
  logRequestPayload: jest.fn(),
  logResponse: jest.fn(),
  getDebugLogger: jest.fn().mockReturnValue({ error: jest.fn() }),
}));

// Mock global fetch
global.fetch = jest.fn();

const mockConfig: EmporixConfig = {
  baseUrl: 'https://api.emporix.io',
  tenant: 'test-tenant',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  serverClientId: 'test-server-client-id',
  serverClientSecret: 'test-server-client-secret',
};

describe('EmporixApiInvoker', () => {
  let invoker: EmporixApiInvoker;
  let mockTokenManager: EmporixTokenManager;

  beforeEach(() => {
    (global.fetch as jest.Mock).mockResolvedValue({ status: 200, ok: true });

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
      clearTokens: jest.fn(),
      refreshCustomerTokenWithLegalEntity: jest.fn().mockResolvedValue(null),
    };

    invoker = new EmporixApiInvoker(mockConfig, mockTokenManager);
  });

  describe('authenticatedFetch cache behavior', () => {
    it('should apply force-cache by default for service token', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'service');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBe('force-cache');
      expect(options.next).toEqual({ revalidate: 3600 });
    });

    it('should apply force-cache by default for public token', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'public');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBe('force-cache');
      expect(options.next).toEqual({ revalidate: 3600 });
    });

    it('should respect pre-set cache: no-store for service token', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET', cache: 'no-store' }, 'service');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBe('no-store');
      expect(options.next).toBeUndefined();
    });

    it('should respect pre-set cache: no-store for public token', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET', cache: 'no-store' }, 'public');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBe('no-store');
      expect(options.next).toBeUndefined();
    });

    it('should not set cache option for session token', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'session');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBeUndefined();
      expect(options.next).toBeUndefined();
    });

    it('should respect pre-set next.revalidate for service token', async () => {
      await invoker.authenticatedFetch(
        '/test-url',
        { method: 'GET', next: { revalidate: 60 } } as RequestInit,
        'service',
      );

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.next).toEqual({ revalidate: 60 });
      expect(options.cache).toBeUndefined();
    });

    it('should add Authorization header with correct token for service calls', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'service');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.headers).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer service-token-123',
        }),
      );
    });

    it('should add session-id header for session token', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'GET' }, 'session');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.headers).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer session-token-123',
          'session-id': 'session-3',
        }),
      );
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('should force no-store for %s with service token', async (method) => {
      await invoker.authenticatedFetch('/test-url', { method }, 'service');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBe('no-store');
      expect(options.next).toBeUndefined();
    });

    it('should force no-store for POST with public token', async () => {
      await invoker.authenticatedFetch('/test-url', { method: 'POST' }, 'public');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBe('no-store');
      expect(options.next).toBeUndefined();
    });

    it('should not inject force-cache when only next is set explicitly', async () => {
      await invoker.authenticatedFetch(
        '/test-url',
        { method: 'GET', next: { revalidate: 60 } } as RequestInit,
        'public',
      );

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.cache).toBeUndefined();
      expect(options.next).toEqual({ revalidate: 60 });
    });
  });
});
