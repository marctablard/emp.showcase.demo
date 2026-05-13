import EmporixTokenManagerClient from './EmporixTokenManagerClient';

// Mock inversify decorators
jest.mock('inversify', () => ({
  inject: () => () => undefined,
  injectable: () => (target: unknown) => target,
}));

jest.mock('@/platform/core/di/injectable', () => ({
  injectable: () => (target: unknown) => target,
}));

// Mock the OAuthApi dependency
const mockOAuthApi = {
  getPublicToken: jest.fn(),
  getAnonymousToken: jest.fn(),
  refreshAnonymousToken: jest.fn(),
  getCustomerToken: jest.fn(),
  refreshCustomerToken: jest.fn(),
  getServiceAccessToken: jest.fn(),
};

describe('EmporixTokenManagerClient', () => {
  let tokenManager: EmporixTokenManagerClient;
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    mockLocalStorage = {};
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn((key: string) => mockLocalStorage[key] ?? null),
        setItem: jest.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
      },
      writable: true,
    });

    // Create instance with mocked OAuthApi
    tokenManager = new (EmporixTokenManagerClient as any)(mockOAuthApi);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('readTokens / writeTokens round-trip', () => {
    it('should write tokens to localStorage and read them back', async () => {
      const tokens = {
        anonymousToken: {
          token: {
            access_token: 'anon-123',
            token_type: 'bearer',
            expires_in: 3600,
            scope: 'read',
            session_id: 'sid-1',
          },
          expiryAt: Date.now() + 3600000,
        },
      };

      // Write
      await (tokenManager as any).writeTokens(tokens, 'test-tenant');
      expect(localStorage.setItem).toHaveBeenCalledWith('emporix-token_test-tenant', JSON.stringify(tokens));

      // Read
      const result = await (tokenManager as any).readTokens('test-tenant');
      expect(localStorage.getItem).toHaveBeenCalledWith('emporix-token_test-tenant');
      expect(result).toEqual(tokens);
    });

    it('should return empty object when no tokens stored', async () => {
      const result = await (tokenManager as any).readTokens('missing-tenant');
      expect(result).toEqual({});
    });
  });

  describe('clearTokens', () => {
    it('should remove tokens from localStorage', () => {
      mockLocalStorage['emporix-token_test-tenant'] = JSON.stringify({ anonymousToken: {} });

      tokenManager.clearTokens('test-tenant');

      expect(localStorage.removeItem).toHaveBeenCalledWith('emporix-token_test-tenant');
    });
  });

  describe('buildStorageKey', () => {
    it('should build correct storage key', () => {
      const key = tokenManager.buildStorageKey('my-tenant');
      expect(key).toBe('emporix-token_my-tenant');
    });
  });
});
