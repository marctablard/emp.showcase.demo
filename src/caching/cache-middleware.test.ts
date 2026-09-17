import { NextRequest } from 'next/server';
import { applyCacheDirectives, isAuthJsSessionCookieName } from './cache-middleware';

const ENABLED_ENV = 'NEXT_CACHE_MIDDLEWARE_ENABLED';
const PRODUCT_PATH = '/product/abc';
const SUGGESTIONS_PATH = '/api/search/suggestions';
const PRIVATE_NO_STORE = 'private, no-store';

function makeRequest(pathname: string, cookieHeader?: string): NextRequest {
  const headers = new Headers();
  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }
  return new NextRequest(`https://example.com${pathname}`, { headers });
}

function apply(pathname: string, cookieHeader?: string): Response {
  return applyCacheDirectives(makeRequest(pathname, cookieHeader), new Response(null));
}

describe('isAuthJsSessionCookieName', () => {
  it.each([
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'authjs.session-token.0',
    '__Secure-authjs.session-token.12',
  ])('accepts %s', (name) => {
    expect(isAuthJsSessionCookieName(name)).toBe(true);
  });

  it.each([
    'xauthjs.session-token',
    'authjs.session-token-old',
    'authjs.session-token.',
    'authjs_session-token',
    'Authjs.session-token',
  ])('rejects %s', (name) => {
    expect(isAuthJsSessionCookieName(name)).toBe(false);
  });
});

describe('applyCacheDirectives', () => {
  const originalEnabled = process.env[ENABLED_ENV];

  beforeEach(() => {
    process.env[ENABLED_ENV] = 'true';
  });

  afterAll(() => {
    if (originalEnabled === undefined) {
      delete process.env[ENABLED_ENV];
    } else {
      process.env[ENABLED_ENV] = originalEnabled;
    }
  });

  it('sets the public directive and cache tags for an anonymous product request', () => {
    const response = apply(PRODUCT_PATH);

    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200',
    );
    expect(response.headers.get('X-Cache-Tags')).toBe('product-abc');
  });

  describe.each([
    ['authjs.session-token', 'authjs.session-token=abc'],
    ['__Secure-authjs.session-token', '__Secure-authjs.session-token=abc'],
    ['chunked authjs.session-token.0', 'authjs.session-token.0=abc; authjs.session-token.1=def'],
  ])('with %s cookie', (_label, cookieHeader) => {
    it.each([PRODUCT_PATH, SUGGESTIONS_PATH])('sets private, no-store and no tags for %s', (pathname) => {
      const response = apply(pathname, cookieHeader);

      expect(response.headers.get('Cache-Control')).toBe(PRIVATE_NO_STORE);
      expect(response.headers.get('X-Cache-Tags')).toBeNull();
    });
  });

  it.each([
    'my-authjs.session-token-copy=abc',
    'authjs.session-token-old=abc',
    'xauthjs.session-token=abc',
    'authjs.session-token.abc=1',
  ])('keeps the public directive for a look-alike cookie name (%s)', (cookieHeader) => {
    const response = apply(SUGGESTIONS_PATH, cookieHeader);

    expect(response.headers.get('Cache-Control')).toMatch(/^public, /);
  });

  it('keeps the public directive when only unrelated cookies are present', () => {
    const response = apply(SUGGESTIONS_PATH, 'currency=EUR; other=1');

    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600',
    );
    expect(response.headers.get('X-Cache-Tags')).toBe('search');
  });

  it('leaves headers untouched when the middleware is disabled', () => {
    process.env[ENABLED_ENV] = 'false';

    const response = apply(PRODUCT_PATH);

    expect(response.headers.get('Cache-Control')).toBeNull();
    expect(response.headers.get('X-Cache-Tags')).toBeNull();
  });

  it('leaves headers untouched when no rule matches', () => {
    const response = apply('/unmatched/path');

    expect(response.headers.get('Cache-Control')).toBeNull();
    expect(response.headers.get('X-Cache-Tags')).toBeNull();
  });
});
