import { webcrypto } from 'crypto';
import { isEncryptedFormat } from '../util/token-encryption-client';
import EmporixTokenManagerClient from './EmporixTokenManagerClient';

// Polyfill Web Crypto API and browser globals for Node.js test environment
beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, writable: true });
  Object.defineProperty(globalThis, 'location', { value: { origin: 'https://shop.example.com' }, writable: true });
});

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
    it('should write encrypted tokens to localStorage and read them back', async () => {
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

      // Verify stored value is encrypted
      const storedValue = mockLocalStorage['emporix-token_test-tenant'];
      expect(isEncryptedFormat(storedValue)).toBe(true);
      expect(storedValue).not.toContain('anon-123');
      expect(storedValue).not.toContain('access_token');

      // Read back
      const result = await (tokenManager as any).readTokens('test-tenant');
      expect(result).toEqual(tokens);
    });

    it('should return empty object when no tokens stored', async () => {
      const result = await (tokenManager as any).readTokens('missing-tenant');
      expect(result).toEqual({});
    });

    it('should read legacy plain JSON values (backward compat)', async () => {
      const tokens = {
        anonymousToken: {
          token: { access_token: 'legacy-tok', session_id: 'sid-2' },
          expiryAt: 9999999,
        },
      };
      mockLocalStorage['emporix-token_test-tenant'] = JSON.stringify(tokens);

      const result = await (tokenManager as any).readTokens('test-tenant');
      expect(result).toEqual(tokens);
    });

    it('should return empty object for corrupted encrypted data', async () => {
      mockLocalStorage['emporix-token_test-tenant'] = 'enc.v1:corrupted-garbage';

      const result = await (tokenManager as any).readTokens('test-tenant');
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
