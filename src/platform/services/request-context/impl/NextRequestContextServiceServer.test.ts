import { CURRENCY_COOKIE_NAME } from '@/lib/common/cookie-names';
import NextRequestContextServiceServer from './NextRequestContextServiceServer';

// Intercept the low-level cookie/headers sources so we can exercise the
// server-side `RequestContextService` without a live Next request scope.
jest.mock('next/headers', () => {
  const mockGet = jest.fn();
  return {
    cookies: jest.fn(async () => ({
      get: mockGet,
    })),
    __mockCookieGet: mockGet,
  };
});

// `RequestPreferences.ts` imports `@/platform/server` for its LoggerService
// fallback — stub it so we don't pull the real DI graph.
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

// `RequestSite` reads `headers()` and delegates through `getCachedRequestSite`
// + `getPublicDefaultSite`. We bypass all of that to keep this test focused on
// the cookie-backed currency/language delegates.
jest.mock('@/site/server/RequestSite', () => ({
  getRequestSite: jest.fn(async () => 'main'),
}));

// React's per-request `cache()` memoizes between calls in the same module
// instance, which defeats "cookie present -> cookie missing" assertions in
// the same Jest file. Bypass the memoization with an identity wrapper.
jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
  };
});

const { __mockCookieGet: mockCookieGet } = jest.requireMock('next/headers') as {
  __mockCookieGet: jest.Mock;
};

describe('NextRequestContextServiceServer', () => {
  let service: NextRequestContextServiceServer;
  const originalLocaleCookieEnv = process.env.NEXT_PUBLIC_LOCALE_COOKIE;

  beforeEach(() => {
    // The shared platform setup runs `jest.resetAllMocks()` in `afterEach`, which
    // clears BOTH calls and implementations — including the module-factory mocks
    // above. Re-prime the default implementations here so each test starts from
    // a known baseline and can override with `mockReturnValue` / `mockImplementation`.
    const serverModule = jest.requireMock('@/platform/server') as {
      default: { get: jest.Mock };
    };
    serverModule.default.get.mockImplementation(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
    }));

    const requestSiteModule = jest.requireMock('@/site/server/RequestSite') as {
      getRequestSite: jest.Mock;
    };
    requestSiteModule.getRequestSite.mockImplementation(async () => 'main');

    const nextHeaders = jest.requireMock('next/headers') as {
      cookies: jest.Mock;
      __mockCookieGet: jest.Mock;
    };
    nextHeaders.cookies.mockImplementation(async () => ({
      get: nextHeaders.__mockCookieGet,
    }));

    process.env.NEXT_PUBLIC_LOCALE_COOKIE = 'NEXT_LOCALE';
    service = new NextRequestContextServiceServer();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_LOCALE_COOKIE = originalLocaleCookieEnv;
  });

  describe('getCurrency()', () => {
    it('returns the currency cookie value when present', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === CURRENCY_COOKIE_NAME ? { value: 'USD' } : undefined,
      );
      await expect(service.getCurrency()).resolves.toBe('USD');
      expect(mockCookieGet).toHaveBeenCalledWith(CURRENCY_COOKIE_NAME);
    });

    it('returns undefined when the currency cookie is missing', async () => {
      mockCookieGet.mockReturnValue(undefined);
      await expect(service.getCurrency()).resolves.toBeUndefined();
    });

    it('returns undefined when the currency cookie is present but empty', async () => {
      mockCookieGet.mockImplementation((name: string) => (name === CURRENCY_COOKIE_NAME ? { value: '' } : undefined));
      await expect(service.getCurrency()).resolves.toBeUndefined();
    });

    it('returns undefined when cookies() rejects (dynamic-context path)', async () => {
      const { cookies } = jest.requireMock('next/headers') as {
        cookies: jest.Mock;
      };
      cookies.mockRejectedValueOnce(
        Object.assign(new Error('Dynamic server usage: cookies()'), { digest: 'DYNAMIC_SERVER_USAGE' }),
      );
      await expect(service.getCurrency()).resolves.toBeUndefined();
    });
  });

  describe('getLanguage()', () => {
    it('returns the locale cookie value when present (NEXT_LOCALE by default)', async () => {
      mockCookieGet.mockImplementation((name: string) => (name === 'NEXT_LOCALE' ? { value: 'de' } : undefined));
      await expect(service.getLanguage()).resolves.toBe('de');
      expect(mockCookieGet).toHaveBeenCalledWith('NEXT_LOCALE');
    });

    it('respects NEXT_PUBLIC_LOCALE_COOKIE override', async () => {
      process.env.NEXT_PUBLIC_LOCALE_COOKIE = 'EMP_LOCALE';
      mockCookieGet.mockImplementation((name: string) => (name === 'EMP_LOCALE' ? { value: 'en' } : undefined));
      await expect(service.getLanguage()).resolves.toBe('en');
      expect(mockCookieGet).toHaveBeenCalledWith('EMP_LOCALE');
    });

    it('returns undefined when the locale cookie is missing', async () => {
      mockCookieGet.mockReturnValue(undefined);
      await expect(service.getLanguage()).resolves.toBeUndefined();
    });

    it('returns undefined when cookies() rejects (dynamic-context path)', async () => {
      const { cookies } = jest.requireMock('next/headers') as {
        cookies: jest.Mock;
      };
      cookies.mockRejectedValueOnce(
        Object.assign(new Error('Dynamic server usage: cookies()'), { digest: 'DYNAMIC_SERVER_USAGE' }),
      );
      await expect(service.getLanguage()).resolves.toBeUndefined();
    });
  });

  describe('getSite()', () => {
    it('delegates to getRequestSite', async () => {
      await expect(service.getSite()).resolves.toBe('main');
    });
  });
});
