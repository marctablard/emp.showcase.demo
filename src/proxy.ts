import NextAuth from 'next-auth';
import type { NextAuthRequest } from 'next-auth';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ASSISTED_BUYING_SIGN_IN_PARAM, hasAssistedBuyingTokenParams } from '@/lib/common/assisted-buying';
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

/**
 * NextAuth middleware rewrites absolute redirect Location headers to NEXTAUTH_URL.
 * Path-only redirects keep the browser on the current deployment host.
 */
function asPathOnlyRedirect(req: NextRequest, response: NextResponse): NextResponse {
  const location = response.headers.get('location');
  if (!location) {
    return response;
  }

  const target = new URL(location, req.url);
  const pathOnlyLocation = `${target.pathname}${target.search}${target.hash}`;
  const redirect = NextResponse.redirect(pathOnlyLocation, response.status === 308 ? 308 : 307);

  response.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });

  return redirect;
}

/**
 * Redirect Management Dashboard assisted-buying links to the server processor before
 * the page renders. Client-side detection is unreliable in dev (React Strict Mode)
 * and may miss tokens after middleware locale/site redirects.
 */
function redirectAssistedBuyingToProcessor(req: NextRequest): NextResponse | undefined {
  const { pathname, searchParams } = req.nextUrl;

  if (pathname.startsWith('/api/auth/assisted-buying')) {
    return undefined;
  }

  if (searchParams.get(ASSISTED_BUYING_SIGN_IN_PARAM) === '1') {
    return undefined;
  }

  if (!hasAssistedBuyingTokenParams(searchParams)) {
    return undefined;
  }

  const processUrl = new URL('/api/auth/assisted-buying/process', req.url);
  searchParams.forEach((value, key) => {
    processUrl.searchParams.set(key, value);
  });
  processUrl.searchParams.set('returnPath', pathname);

  return NextResponse.redirect(processUrl);
}

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
    return asPathOnlyRedirect(req, NextResponse.redirect('/account'));
  }

  // Invoke site middleware to get actual pathes and handle potential redirects after authentication
  let response = siteMiddleware(req);
  const siteLocation = response.headers.get('location');
  if (siteLocation) {
    return asPathOnlyRedirect(req, response);
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
  const assistedBuyingRedirect = redirectAssistedBuyingToProcessor(req);
  if (assistedBuyingRedirect) {
    return assistedBuyingRedirect;
  }

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
