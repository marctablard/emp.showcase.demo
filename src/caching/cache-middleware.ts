import type { NextRequest } from 'next/server';
import { edgeLog } from '@/lib/server/edge-stderr-log';
import { INTERNAL_APP_PATH_HEADER, NEXT_MIDDLEWARE_PREFIX } from '../site/types';
import { DEFAULT_CACHE_REVALIDATE, cacheRules } from './cache-config';

/**
 * Check if cache middleware is enabled via environment variable
 */
const isCacheMiddlewareEnabled = () => {
  const enabled = process.env.NEXT_CACHE_MIDDLEWARE_ENABLED;
  return enabled === undefined || enabled === 'true';
};

/**
 * Match URL against pattern and extract capture groups
 */
function matchPattern(url: string, pattern: string): { matches: boolean; groups: string[] } {
  try {
    const regex = new RegExp(`^${pattern}$`);
    const match = url.match(regex);

    if (!match) {
      return { matches: false, groups: [] };
    }

    // Extract capture groups (skip index 0 which is the full match)
    const groups = match.slice(1);
    return { matches: true, groups };
  } catch (error) {
    edgeLog('error', 'invalid_cache_rule_pattern', {
      pattern,
      error: error instanceof Error ? error.message : String(error),
    });
    return { matches: false, groups: [] };
  }
}

/**
 * Replace placeholders in tags with capture group values
 */
function replacePlaceholders(tags: string[], groups: string[]): string[] {
  return tags.map((tag) => {
    let result = tag;
    groups.forEach((group, index) => {
      result = result.replace(`$${index + 1}`, group);
    });
    return result;
  });
}

/**
 * Auth.js v5 default session cookie name. `src/auth/auth.config.ts` sets no
 * custom `cookies.sessionToken.name`, so the default applies. Matched with
 * `includes` to cover the `__Secure-` prefix and chunked `.0`/`.1` suffixes.
 */
const AUTHJS_SESSION_COOKIE_FRAGMENT = 'authjs.session-token';

/**
 * Detect an Auth.js session on the request (Edge runtime: `NextRequest.cookies` only).
 */
function hasAuthSession(req: NextRequest): boolean {
  return req.cookies.getAll().some((cookie) => cookie.name.includes(AUTHJS_SESSION_COOKIE_FRAGMENT));
}

/**
 * Build Cache-Control header value
 */
function buildCacheControlHeader(revalidate?: number): string {
  const maxAge = revalidate ?? DEFAULT_CACHE_REVALIDATE;
  if (maxAge <= 0) {
    return 'private, no-store';
  }
  return `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`;
}

/**
 * Apply cache directives to response based on URL patterns
 */
export function applyCacheDirectives(req: NextRequest, response: Response): Response {
  // Skip if cache middleware is disabled
  if (!isCacheMiddlewareEnabled()) {
    return response;
  }
  const siteAppPath = response.headers.get(NEXT_MIDDLEWARE_PREFIX + INTERNAL_APP_PATH_HEADER);
  const pathname = siteAppPath ? siteAppPath : req.nextUrl.pathname;
  // Personalised responses (customer-segment scoped catalog, PDP, suggestions)
  // must never be shared through a public cache. The rules below would
  // otherwise override any route-level headers for `/product/*` and
  // `/api/search/*`, so authenticated requests are forced to `private, no-store`
  // here and no `X-Cache-Tags` are emitted for them.
  const authenticated = hasAuthSession(req);
  // Find first matching cache rule
  for (const rule of cacheRules) {
    const { matches, groups } = matchPattern(pathname, rule.url);
    if (matches) {
      const { revalidate = DEFAULT_CACHE_REVALIDATE, tags = [] } = rule.cache || {};

      // Set Cache-Control header
      const cacheControl = authenticated ? buildCacheControlHeader(0) : buildCacheControlHeader(revalidate);
      response.headers.set('Cache-Control', cacheControl);
      // Set cache tags if provided (never for authenticated requests)
      if (!authenticated && tags.length > 0) {
        const processedTags = replacePlaceholders(tags, groups);
        response.headers.set('X-Cache-Tags', processedTags.join(','));
      }

      // First match wins, stop processing
      break;
    }
  }

  return response;
}
