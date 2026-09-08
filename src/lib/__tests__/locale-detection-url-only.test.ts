import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';

const LOCALE_COOKIE_NAME = process.env.NEXT_PUBLIC_LOCALE_COOKIE?.trim() || 'NEXT_LOCALE';

function intlRequest(pathname: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://example.com${pathname}`, { headers });
}

function locationPath(response: Response): string | null {
  const location = response.headers.get('location');
  return location ? new URL(location).pathname : null;
}

/**
 * Site middleware strips `/{site}` before next-intl runs, so intl sees `/` for
 * `/us-branch`. Cookie / Accept-Language redirects on that path are the cookie-less freeze.
 */
describe('localeDetection is URL-only (cookie-less freeze)', () => {
  const middleware = createIntlMiddleware(routing);

  it('disables cookie and Accept-Language locale detection', () => {
    expect(routing.localeDetection).toBe(false);
  });

  it('does not redirect unprefixed / to /de from a de locale cookie', () => {
    const response = middleware(intlRequest('/', { cookie: `${LOCALE_COOKIE_NAME}=de` }));

    expect(locationPath(response)).toBeNull();
  });

  it('does not redirect unprefixed / to /de from Accept-Language: de', () => {
    const response = middleware(intlRequest('/', { 'accept-language': 'de-DE,de;q=0.9,en;q=0.8' }));

    expect(locationPath(response)).toBeNull();
  });

  it('does not redirect unprefixed / to /de when both cookie and Accept-Language are de', () => {
    const response = middleware(
      intlRequest('/', {
        cookie: `${LOCALE_COOKIE_NAME}=de`,
        'accept-language': 'de-DE,de;q=0.9',
      }),
    );

    expect(locationPath(response)).toBeNull();
  });

  it('still honors an explicit /de URL prefix', () => {
    const response = middleware(intlRequest('/de'));
    const locale = response.headers.get('x-middleware-request-x-next-intl-locale');

    expect(locale).toBe('de');
    expect(locationPath(response)).toBeNull();
  });
});
