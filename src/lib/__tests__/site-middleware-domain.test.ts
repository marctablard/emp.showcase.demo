import type { NextRequest } from 'next/server';
import { createSiteMiddleware, resolveSite } from '@/site/middleware';
import { INTERNAL_SITE_INVALID_HEADER, type SiteRoutingConfig } from '@/site/types';
import { resolveApplicableRouting, shouldPrefix } from '@/site/utils';

jest.mock('next-intl/middleware', () => {
  const { NextResponse } = require('next/server');
  return {
    __esModule: true,
    default: () => (req: { headers: Headers; url: string }) => {
      const mode = req.headers.get('x-intl-mode');
      const localeHeader = 'x-middleware-request-x-next-intl-locale';

      if (mode === 'redirect') {
        const res = NextResponse.redirect(new URL('/en', req.url));
        res.headers.set(localeHeader, 'en');
        return res;
      }

      if (mode === 'rewrite') {
        const res = NextResponse.rewrite(new URL('/en', req.url));
        res.headers.set(localeHeader, 'en');
        return res;
      }

      const res = NextResponse.next();
      res.headers.set(localeHeader, 'en');
      return res;
    },
  };
});

jest.mock('@/i18n/routing', () => ({
  routing: {
    locales: ['en'],
    defaultLocale: 'en',
    localePrefix: 'as-needed',
    localeCookie: { name: 'NEXT_LOCALE' },
  },
}));

const createCookies = (values: Record<string, string>) =>
  ({
    get: (name: string) => (values[name] ? { value: values[name] } : undefined),
  }) as unknown as { get: (name: string) => { value: string } | undefined };

const createRequest = (
  url: string,
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {},
  method: string = 'GET',
) => {
  const nextUrl = new URL(url);
  return {
    url: nextUrl.toString(),
    nextUrl,
    headers: new Headers(headers),
    cookies: createCookies(cookies),
    method,
  } as unknown as NextRequest;
};

let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;

beforeEach(() => {
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleWarnSpy.mockRestore();
});

describe('site middleware - domain and prefix handling', () => {
  const baseRouting: SiteRoutingConfig = {
    defaultSite: 'main',
    availableSites: ['main', 'tenant1', 'tenant2'],
    prefix: 'as-needed',
    cookie: { name: 'NEXT_SITE' },
    cookieOverridesDefault: true,
    header: 'x-emp-site',
    domains: [
      {
        domain: 'shop.pl',
        defaultSite: 'tenant2',
        availableSites: ['tenant2', 'main'],
        prefix: 'as-needed',
      },
    ],
  };

  test('resolves routing by hostname and preserves cookie config', () => {
    const routing = resolveApplicableRouting('shop.pl', baseRouting);

    expect(routing.defaultSite).toBe('tenant2');
    expect(routing.availableSites).toEqual(['tenant2', 'main']);
    expect(routing.cookie?.name).toBe('NEXT_SITE');
    expect(routing.cookieOverridesDefault).toBe(true);
    expect(routing.header).toBe('x-emp-site');
  });

  test('falls back to base routing when hostname does not match', () => {
    const routing = resolveApplicableRouting('unknown.example', baseRouting);

    expect(routing.defaultSite).toBe('main');
    expect(routing.availableSites).toEqual(['main', 'tenant1', 'tenant2']);
  });

  test('resolves site from path segment before cookie/header', () => {
    const headers = new Headers();
    const cookies = createCookies({ NEXT_SITE: 'tenant2' }) as unknown as NextRequest['cookies'];
    const result = resolveSite('/tenant1/en/products', cookies, headers, baseRouting);

    expect(result.site).toBe('tenant1');
    expect(result.appPath).toBe('en/products');
  });

  test('resolves site from cookie when no path segment is present and cookieOverridesDefault is enabled', () => {
    const headers = new Headers();
    const cookies = createCookies({ NEXT_SITE: 'tenant2' }) as unknown as NextRequest['cookies'];
    const result = resolveSite('/en/products', cookies, headers, baseRouting);

    expect(result.site).toBe('tenant2');
    expect(result.appPath).toBe('en/products');
  });

  test('resolves site from header when cookie is missing', () => {
    const headers = new Headers({ 'x-emp-site': 'tenant1' });
    const cookies = createCookies({}) as unknown as NextRequest['cookies'];
    const result = resolveSite('/en/products', cookies, headers, baseRouting);

    expect(result.site).toBe('tenant1');
    expect(result.appPath).toBe('en/products');
  });

  test('falls back to default site when no hints are present', () => {
    const headers = new Headers();
    const cookies = createCookies({}) as unknown as NextRequest['cookies'];
    const result = resolveSite('/en/products', cookies, headers, baseRouting);

    expect(result.site).toBe('main');
    expect(result.appPath).toBe('en/products');
  });

  test('shouldPrefix respects prefix modes', () => {
    expect(shouldPrefix('main', baseRouting)).toBe(false);
    expect(shouldPrefix('tenant1', baseRouting)).toBe(true);

    expect(shouldPrefix('main', { ...baseRouting, prefix: 'always' })).toBe(true);
    expect(shouldPrefix('tenant1', { ...baseRouting, prefix: 'never' })).toBe(false);
  });
});

describe('domain-only entry mapping', () => {
  const routingConfig: SiteRoutingConfig = {
    defaultSite: 'de',
    availableSites: ['de', 'en'],
    prefix: 'as-needed',
    cookie: { name: 'NEXT_SITE' },
    domains: [
      {
        domain: 'example.de',
        defaultSite: 'de',
        availableSites: ['de', 'en'],
        prefix: 'as-needed',
      },
      {
        domain: 'example.en',
        defaultSite: 'en',
        availableSites: ['de', 'en'],
        prefix: 'as-needed',
      },
      {
        domain: 'example.com',
        defaultSite: 'de',
        availableSites: ['de', 'en'],
        prefix: 'as-needed',
      },
    ],
  };

  test('https://example.de maps to site de', () => {
    const routing = resolveApplicableRouting('example.de', routingConfig);
    const result = resolveSite('/', createCookies({}) as unknown as NextRequest['cookies'], new Headers(), routing);

    expect(result.site).toBe('de');
  });

  test('https://example.en maps to site en', () => {
    const routing = resolveApplicableRouting('example.en', routingConfig);
    const result = resolveSite('/', createCookies({}) as unknown as NextRequest['cookies'], new Headers(), routing);

    expect(result.site).toBe('en');
  });

  test('https://example.com maps to site de (default)', () => {
    const routing = resolveApplicableRouting('example.com', routingConfig);
    const result = resolveSite('/', createCookies({}) as unknown as NextRequest['cookies'], new Headers(), routing);

    expect(result.site).toBe('de');
  });
});

describe('createSiteMiddleware redirect/rewrite behavior', () => {
  const routingConfig: SiteRoutingConfig = {
    defaultSite: 'main',
    availableSites: ['main', 'tenant1'],
    prefix: 'as-needed',
    cookie: { name: 'NEXT_SITE' },
    cookieOverridesDefault: true,
  };

  test('redirects to include site when prefix is required', () => {
    const middleware = createSiteMiddleware(routingConfig);
    const req = createRequest(
      'https://example.com/en/products',
      { NEXT_SITE: 'tenant1' },
      { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    );
    const response = middleware(req);

    expect(response?.headers.get('location')).toBe('https://example.com/tenant1/en/products');
  });

  test('redirects to remove site when prefix is not needed', () => {
    const middleware = createSiteMiddleware(routingConfig);
    const req = createRequest(
      'https://example.com/main/en/products',
      { NEXT_SITE: 'main' },
      { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    );
    const response = middleware(req);

    expect(response?.headers.get('location')).toBe('https://example.com/en/products');
  });

  test('rewrites to include default site when prefix is not needed', () => {
    const middleware = createSiteMiddleware(routingConfig);
    const req = createRequest(
      'https://example.com/en/products',
      { NEXT_SITE: 'main' },
      { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    );
    const response = middleware(req);

    expect(response?.headers.get('x-middleware-rewrite')).toBe('https://example.com/main/en/products');
  });

  test('prepends site to intl redirect when prefix is required', () => {
    const middleware = createSiteMiddleware(routingConfig);
    const req = createRequest(
      'https://example.com/en',
      { NEXT_SITE: 'tenant1' },
      { 'x-intl-mode': 'redirect', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    );
    const response = middleware(req);

    expect(response?.headers.get('location')).toBe('https://example.com/tenant1/en');
  });
});

describe('createSiteMiddleware probe detection behavior', () => {
  const routingConfig: SiteRoutingConfig = {
    defaultSite: 'main',
    availableSites: ['main', 'tenant1'],
    prefix: 'as-needed',
    cookie: { name: 'NEXT_SITE' },
    cookieOverridesDefault: true,
  };

  test('intercepts empty user-agent requests to main routes', () => {
    const middleware = createSiteMiddleware(routingConfig);
    const req = createRequest('https://example.com/', {}, { 'User-Agent': '' });
    const response = middleware(req);

    expect(response?.status).toBe(200);
    expect(response?.headers.get('x-misrouted-healthcheck')).toBe('1');
    expect(response?.headers.get('x-recommended-endpoint')).toBe('/api/health');
    expect(response?.headers.get('x-alternative-endpoint')).toBe('/api/ready');
  });

  test('intercepts known probe user-agent requests to site routes', () => {
    const middleware = createSiteMiddleware(routingConfig);
    const req = createRequest('https://example.com/tenant1/en', {}, { 'User-Agent': 'kube-probe/1.0' });
    const response = middleware(req);

    expect(response?.status).toBe(200);
    expect(response?.headers.get('x-misrouted-healthcheck')).toBe('1');
    expect(response?.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  });

  test('intercepts HEAD requests to main routes', () => {
    const middleware = createSiteMiddleware(routingConfig);
    const req = createRequest('https://example.com/', {}, { 'User-Agent': 'curl/7.68.0' }, 'HEAD');
    const response = middleware(req);

    expect(response?.status).toBe(200);
    expect(response?.headers.get('x-misrouted-healthcheck')).toBe('1');
  });

  test('allows normal browser requests to proceed normally', () => {
    const middleware = createSiteMiddleware(routingConfig);
    const req = createRequest(
      'https://example.com/tenant1/en',
      {},
      {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
      },
    );
    const response = middleware(req);

    // Should not be intercepted by probe detection
    expect(response?.headers.get('x-misrouted-healthcheck')).toBeNull();
    // Should proceed to normal middleware processing
    expect(response).toBeDefined();
  });

  test('does not intercept requests to API routes', () => {
    const middleware = createSiteMiddleware(routingConfig);
    const req = createRequest('https://example.com/api/health/status', {}, { 'User-Agent': '' });
    const response = middleware(req);

    // API routes should not be intercepted by probe detection
    expect(response?.headers.get('x-misrouted-healthcheck')).toBeNull();
    // Should proceed to normal middleware processing (with site prefix)
    expect(response?.headers.get('x-middleware-rewrite')).toBe('https://example.com/main/api/health/status');
  });

  test('does not intercept requests to non-main routes', () => {
    const middleware = createSiteMiddleware(routingConfig);
    const req = createRequest('https://example.com/some/other/path', {}, { 'User-Agent': '' });
    const response = middleware(req);

    expect(response?.headers.get('x-misrouted-healthcheck')).toBeNull();
  });
});

describe('fallback-OFF behavior (no defaultSite)', () => {
  const noFallbackRouting: SiteRoutingConfig = {
    defaultSite: undefined,
    availableSites: ['site-a', 'site-b'],
    prefix: 'as-needed',
    cookie: { name: 'NEXT_SITE' },
    cookieOverridesDefault: true,
    header: 'x-emp-site',
  };

  const browserUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  describe('resolveSite with no defaultSite', () => {
    test('resolves valid site from path segment normally', () => {
      const result = resolveSite(
        '/site-a/en/products',
        createCookies({}) as unknown as NextRequest['cookies'],
        new Headers(),
        noFallbackRouting,
      );

      expect(result.site).toBe('site-a');
      expect(result.appPath).toBe('en/products');
    });

    test('returns undefined when no hints are present', () => {
      const result = resolveSite(
        '/en/products',
        createCookies({}) as unknown as NextRequest['cookies'],
        new Headers(),
        noFallbackRouting,
      );

      expect(result.site).toBeUndefined();
      expect(result.appPath).toBe('en/products');
    });

    test('returns header value even if invalid (pre-validation)', () => {
      const result = resolveSite(
        '/en/products',
        createCookies({}) as unknown as NextRequest['cookies'],
        new Headers({ 'x-emp-site': 'bad-site' }),
        noFallbackRouting,
      );

      expect(result.site).toBe('bad-site');
    });
  });

  describe('shouldPrefix with no defaultSite', () => {
    test('always returns true for as-needed mode', () => {
      expect(shouldPrefix('site-a', noFallbackRouting)).toBe(true);
      expect(shouldPrefix('site-b', noFallbackRouting)).toBe(true);
    });
  });

  describe('createSiteMiddleware with no defaultSite', () => {
    test('proceeds normally with valid site in path', () => {
      const middleware = createSiteMiddleware(noFallbackRouting);
      const req = createRequest('https://example.com/site-a/en/products', {}, { 'User-Agent': browserUA });
      const response = middleware(req);

      expect(response?.headers.get(INTERNAL_SITE_INVALID_HEADER)).toBeNull();
      expect(response?.headers.get('x-misrouted-healthcheck')).toBeNull();
    });

    test('uses 1st available site when no site specified (no 404 flag)', () => {
      const middleware = createSiteMiddleware(noFallbackRouting);
      const req = createRequest('https://example.com/en/products', {}, { 'User-Agent': browserUA });
      const response = middleware(req);

      expect(response?.headers.get(INTERNAL_SITE_INVALID_HEADER)).toBeNull();
      // No defaultSite → shouldPrefix returns true → redirect to include site prefix
      const location = response?.headers.get('location');
      expect(location).toBe('https://example.com/site-a/en/products');
    });

    test('sets x-site-invalid header for cookie with invalid site', () => {
      const middleware = createSiteMiddleware(noFallbackRouting);
      const req = createRequest(
        'https://example.com/en/products',
        { NEXT_SITE: 'bad-site' },
        { 'User-Agent': browserUA },
      );
      const response = middleware(req);

      expect(response?.headers.get('x-middleware-rewrite')).toBeDefined();
      const rewriteUrl = new URL(response!.headers.get('x-middleware-rewrite')!);
      expect(rewriteUrl.pathname).toContain('/site-a');
      // Header is forwarded as x-middleware-request-<header-name> by NextResponse.rewrite
      expect(response?.headers.get(`x-middleware-request-${INTERNAL_SITE_INVALID_HEADER}`)).toBe('true');
    });

    test('sets x-site-invalid header for header with invalid site', () => {
      const middleware = createSiteMiddleware(noFallbackRouting);
      const req = createRequest(
        'https://example.com/en/products',
        {},
        { 'x-emp-site': 'bad-site', 'User-Agent': browserUA },
      );
      const response = middleware(req);

      const rewrite = response?.headers.get('x-middleware-rewrite');
      expect(rewrite).toBeDefined();
      expect(new URL(rewrite!).pathname).toContain('/site-a');
      expect(response?.headers.get(`x-middleware-request-${INTERNAL_SITE_INVALID_HEADER}`)).toBe('true');
    });

    test('fallback ON: cookie with invalid site falls back to defaultSite', () => {
      const withFallback: SiteRoutingConfig = {
        ...noFallbackRouting,
        defaultSite: 'site-a',
      };
      const middleware = createSiteMiddleware(withFallback);
      const req = createRequest(
        'https://example.com/en/products',
        { NEXT_SITE: 'bad-site' },
        { 'User-Agent': browserUA },
      );
      const response = middleware(req);

      expect(response?.headers.get(INTERNAL_SITE_INVALID_HEADER)).toBeNull();
      const rewrite = response?.headers.get('x-middleware-rewrite');
      expect(rewrite).toBeDefined();
      expect(new URL(rewrite!).pathname).toContain('/site-a');
    });
  });
});
