'use client';

import { CURRENCY_COOKIE_NAME } from '@/lib/common/cookie-names';
import { getPublicDefaultSite } from '@/lib/common/public-default-env';
import { injectable } from '@/platform/core/di/injectable';
import type { RequestContextService } from '../RequestContextService';

/**
 * Client-side `RequestContextService` implementation.
 *
 * On the server the request site comes from an internal header and the
 * preference cookies are read via `next/headers`. In the browser neither
 * source is available, so this implementation reads the same three values
 * straight from `document.cookie`:
 *
 * - site:     `NEXT_PUBLIC_SITE_COOKIE`  (default `NEXT_SITE`)
 * - language: `NEXT_PUBLIC_LOCALE_COOKIE` (default `NEXT_LOCALE`)
 * - currency: {@link CURRENCY_COOKIE_NAME}
 *
 * The cookie names mirror what the server-side setters (the `/api/session/*`
 * routes) write, so the values stay consistent across the SSR/CSR boundary.
 *
 * Falls back to {@link getPublicDefaultSite} for `getSite()` to preserve the
 * non-undefined contract; `getCurrency` and `getLanguage` return `undefined`
 * when their cookie is missing, matching the server variant.
 */
@injectable('RequestContextService', 'Singleton')
class NextRequestContextServiceClient implements RequestContextService {
  async getSite(): Promise<string> {
    return readCookie(siteCookieName()) ?? getPublicDefaultSite();
  }

  async getCurrency(): Promise<string | undefined> {
    return readCookie(CURRENCY_COOKIE_NAME);
  }

  async getLanguage(): Promise<string | undefined> {
    return readCookie(localeCookieName());
  }
}

function siteCookieName(): string {
  return process.env.NEXT_PUBLIC_SITE_COOKIE || 'NEXT_SITE';
}

function localeCookieName(): string {
  return process.env.NEXT_PUBLIC_LOCALE_COOKIE || 'NEXT_LOCALE';
}

/**
 * Read a single cookie by name from `document.cookie`. Returns `undefined`
 * when the cookie is missing, empty, or when invoked outside a browser
 * context (e.g. during the SSR pass for a "use client" module).
 */
function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const target = `${name}=`;
  const segments = document.cookie ? document.cookie.split(';') : [];
  for (const segment of segments) {
    const trimmed = segment.trimStart();
    if (trimmed.startsWith(target)) {
      const raw = trimmed.slice(target.length);
      if (raw.length === 0) return undefined;
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return undefined;
}

export default NextRequestContextServiceClient;
