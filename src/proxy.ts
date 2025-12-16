import NextAuth, { NextAuthRequest } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { config as authConfig } from './auth/auth.config';
import { createSiteMiddleware } from './site/middleware';
import { routing as siteRouting } from './site/routing';

const securedPages = ['/account/.*?'];
//const securedPathnameRegex = RegExp(`^(/(${intlRouting.locales.join('|')}))?(${securedPages.join('|')})(/.*)?/?$`, 'i');
const securedApiPrefixes = securedPages.filter((p) => p.startsWith('/api/shipping'));
const apiBypassPrefixes = ['/api/auth', '/api/csrf', '/api/notifications'];

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

const authMiddleware = auth(async (req: NextAuthRequest) => {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/')) {
    // 1) Bypass certain API prefixes (e.g., NextAuth and CSRF endpoint)
    if (startsWithAny(pathname, apiBypassPrefixes)) {
      return NextResponse.next();
    }

    // 2) Require auth for secured API prefixes (return 401 for unauthenticated)
    if (!req.auth?.user && startsWithAny(pathname, securedApiPrefixes)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3) Apply CSRF validation for remaining API requests
    const csrfResult = validateCsrf(req);
    if (csrfResult) return csrfResult;
  }
  const response = siteMiddleware(req);
  return response;
});

export default async function middleware(req: NextRequest) {
  const response = await (authMiddleware as (req: NextRequest) => Promise<NextResponse>)(req);
  return response;
}

export const config = {
  matcher: ['/((?!_next|api|.well-known\\.*|.*\\..*).*)'],
};
