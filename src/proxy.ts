import NextAuth, { NextAuthRequest } from 'next-auth';
import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';
import { config as authConfig } from './auth/auth.config';
import { applyCacheDirectives } from './caching/cache-middleware';
import { createSiteMiddleware } from './site/middleware';
import { routing as siteRouting } from './site/routing';
import { NEXT_REWRITE_HEADER } from './site/types';

const apiBypassPrefixes = ['/api/auth', '/api/csrf', '/api/notifications', '/api/debug'];
const accountRegex = /^(.*)\/account\/([^/]+)$/;
const authSubpageRegex = /^(.*)\/(category|browse|product)\/([^/]+)$/;
const securedPatterns = [accountRegex, authSubpageRegex];

const startsWithAny = (path: string, prefixes: string[]) => prefixes.some((p) => path.startsWith(p));

// Simplified Instance of NextAuth for Edge Middleware (cannot use server context)
const { auth } = NextAuth(authConfig);

const siteMiddleware = createSiteMiddleware(siteRouting);

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
const authMiddleware = auth(async (req: NextAuthRequest, _event: NextFetchEvent) => {
  const { pathname } = req.nextUrl;
  // Account routes are protected by default
  if (!req.auth?.user && accountRegex.test(pathname)) {
    // to protect all account routes without requiring explicit protection
    return NextResponse.redirect(new URL('/account', req.nextUrl));
  }

  // Invoke site middleware to get actual pathes and handle potential redirects after authentication
  let response = siteMiddleware(req);
  const siteLocation = response.headers.get('location');
  if (siteLocation) {
    // leave redirect untouched
    return response;
  }
  const siteRewriteHeader = response.headers.get(NEXT_REWRITE_HEADER);
  const url = siteRewriteHeader ? new URL(siteRewriteHeader) : req.nextUrl.clone();
  // Handle URLs that may require customer specific content
  const authSubpageMatch = url.pathname.match(authSubpageRegex);
  if (authSubpageMatch) {
    const [, pathPrefix, pageType, entityId] = authSubpageMatch;
    if (!!req.auth?.user) {
      url.pathname = `${pathPrefix}/${pageType}/${entityId}/authenticated`;
      response = NextResponse.rewrite(url, { request: { headers: req.headers } });
    } else {
      // Remove Set-Cookie header (required for caching)
      response.headers.delete('Set-Cookie');
    }
  }

  return applyCacheDirectives(req, response);
});

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;
  // 1) Bypass certain API prefixes (e.g., NextAuth and CSRF endpoint)
  if (startsWithAny(pathname, apiBypassPrefixes)) {
    return NextResponse.next();
  }

  // 2) Handle API requests with CSRF validation
  let response;
  if (pathname.startsWith('/api/')) {
    const csrfResult = validateCsrf(req);
    if (csrfResult) {
      response = csrfResult;
    } else {
      response = applyCacheDirectives(req, NextResponse.next());
    }
    return response;
  }

  // 3) Handle secured Routes
  if (securedPatterns.some((regex) => regex.test(pathname))) {
    return authMiddleware(req, event);
  }

  // 4) Handle all remaining routes
  response = siteMiddleware(req);
  const siteLocation = response.headers.get('location');
  if (siteLocation) {
    // leave redirect untouched
    return response;
  }
  return applyCacheDirectives(req, response);
}

export const config = {
  matcher: ['/((?!_next|.well-known\\.*|.*\\..*).*)'],
};
