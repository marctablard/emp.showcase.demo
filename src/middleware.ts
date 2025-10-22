import { NextAuthRequest } from 'next-auth';
import NextAuth from 'next-auth';
import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import authConfig from './auth/auth.config';

const locales = ['en', 'de'];
const defaultLocale = 'en';
const securedPages = ['/account'];
const securedPathnameRegex = RegExp(`^(/(${locales.join('|')}))?(${securedPages.join('|')})(/.*)?/?$`, 'i');
const securedApiPrefixes = securedPages.filter((p) => p.startsWith('/api/shipping'));

const apiBypassPrefixes = ['/api/auth', '/api/csrf', '/api/notifications'];

const startsWithAny = (path: string, prefixes: string[]) => prefixes.some((p) => path.startsWith(p));

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

// Simplified Instance of NextAuth for Edge Middleware (cannot use server context)
const { auth } = NextAuth(authConfig);

/**
 * Validates CSRF token for protected routes
 * @param req NextRequest object
 * @returns Response if CSRF validation fails, undefined otherwise
 */
function validateCsrf(req: NextRequest): Response | NextResponse | undefined {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return undefined;
  }

  const csrfToken = req.headers.get('x-csrf-token');
  const storedToken = req.cookies.get('csrf-token')?.value;

  if (!csrfToken || !storedToken || csrfToken !== storedToken) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
}

/**
 * Apply security headers to the response
 * @param response The response to apply headers to
 * @returns Response with security headers
 */
function applySecurityHeaders(response: Response | NextResponse): Response | NextResponse {
  // Set security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Cross-Origin-Resource-Policy', process.env.CROSS_ORIGIN_RESOURCE_POLICY || 'same-site');
  response.headers.set('Cross-Origin-Opener-Policy', process.env.CROSS_ORIGIN_OPENER_POLICY || 'same-origin');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  return response;
}

export default auth(async (req: NextAuthRequest) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    // 1) Bypass certain API prefixes (e.g., NextAuth and CSRF endpoint)
    if (startsWithAny(pathname, apiBypassPrefixes)) {
      return applySecurityHeaders(NextResponse.next());
    }

    // 2) Require auth for secured API prefixes (return 401 for unauthenticated)
    if (!req.auth?.user && startsWithAny(pathname, securedApiPrefixes)) {
      return applySecurityHeaders(NextResponse.redirect(new URL('/login', req.url)));
    }

    // 3) Apply CSRF validation for remaining API requests
    const csrfResult = validateCsrf(req);
    if (csrfResult) return applySecurityHeaders(csrfResult);
  }

  if (!req.auth?.user) {
    const isSecuredPage = securedPathnameRegex.test(pathname);
    if (isSecuredPage) {
      return applySecurityHeaders(NextResponse.redirect(new URL('/login', req.url)));
    }
  }

  //Successfully process the api request
  if (pathname.startsWith('/api/')) {
    return applySecurityHeaders(NextResponse.next());
  }

  return applySecurityHeaders(intlMiddleware(req) ?? NextResponse.next());
});

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/api/:path*'],
};
