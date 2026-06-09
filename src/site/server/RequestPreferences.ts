import { cache } from 'react';
import { cookies } from 'next/headers';
import { CURRENCY_COOKIE_NAME } from '@/lib/common/cookie-names';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * Benign-dynamic-context reader: reads a cookie via `cookies()` without
 * noisy logging when the caller is outside a request scope (e.g. static
 * generation). Mirrors the guard pattern used by
 * `src/site/server/RequestSite.ts::getSiteFromHeaderImpl`.
 */
async function readCookieValue(name: string): Promise<string | undefined> {
  try {
    const store = await cookies();
    const value = store.get(name)?.value;
    return value && value.length > 0 ? value : undefined;
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const digest =
      typeof error === 'object' && error !== null && 'digest' in error
        ? String((error as { digest?: unknown }).digest)
        : '';
    const message = error instanceof Error ? error.message : String(error);
    const isBenignDynamicContext =
      digest.includes('DYNAMIC') ||
      /dynamic server usage|outside a request scope|static generation|cookies\(\)/i.test(message);

    if (isBenignDynamicContext) {
      logger.debug(
        { event: 'request_cookies_unavailable', cookie: name, digest: digest || undefined },
        'cookies() unavailable in this context — returning undefined',
      );
    } else {
      logger.error({ err: error, cookie: name }, 'Error reading cookie');
    }
    return undefined;
  }
}

async function getCurrencyFromCookieImpl(): Promise<string | undefined> {
  return readCookieValue(CURRENCY_COOKIE_NAME);
}
const getCurrencyFromCookie = cache(getCurrencyFromCookieImpl);

async function getLanguageFromCookieImpl(): Promise<string | undefined> {
  const cookieName = process.env.NEXT_PUBLIC_LOCALE_COOKIE || 'NEXT_LOCALE';
  return readCookieValue(cookieName);
}
const getLanguageFromCookie = cache(getLanguageFromCookieImpl);

/**
 * Returns the shopper's preferred currency from the {@link CURRENCY_COOKIE_NAME}
 * cookie, or `undefined` when not set. The caller decides whether to fall back
 * to an env default; this helper intentionally does **not** — so anonymous
 * token seeding can distinguish "shopper has expressed a preference" from
 * "fall back to tenant default".
 */
export async function getRequestCurrency(): Promise<string | undefined> {
  return getCurrencyFromCookie();
}

/**
 * Returns the shopper's preferred language from the locale cookie
 * (`NEXT_PUBLIC_LOCALE_COOKIE`, default `NEXT_LOCALE`), or `undefined` when not
 * set. Mirrors {@link getRequestCurrency}.
 */
export async function getRequestLanguage(): Promise<string | undefined> {
  return getLanguageFromCookie();
}
