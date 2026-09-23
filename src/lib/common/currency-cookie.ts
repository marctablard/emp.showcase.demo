import type { NextResponse } from 'next/server';
import { CURRENCY_COOKIE_NAME } from '@/lib/common/cookie-names';

/** Same lifetime as the site and locale preference cookies. */
export const CURRENCY_PREFERENCE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export function normalizeCurrencyCode(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim().toUpperCase();
  return trimmed || undefined;
}

/**
 * Persist `next-currency` so the next anonymous token is seeded with the live
 * session currency. The session is the source of truth; this only rewrites the cookie.
 */
export function writeCurrencyCookie(response: NextResponse, currency: string): void {
  const canonical = normalizeCurrencyCode(currency);
  if (!canonical) {
    return;
  }
  response.cookies.set({
    name: CURRENCY_COOKIE_NAME,
    value: canonical,
    maxAge: CURRENCY_PREFERENCE_MAX_AGE_SECONDS,
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  });
}

/** Rewrite the cookie when it disagrees with the session. A matching cookie is left alone. */
export function syncCurrencyCookie(
  response: NextResponse,
  sessionCurrency: string | null | undefined,
  requestCookie: string | null | undefined,
): void {
  const canonical = normalizeCurrencyCode(sessionCurrency);
  if (!canonical || normalizeCurrencyCode(requestCookie) === canonical) {
    return;
  }
  writeCurrencyCookie(response, canonical);
}
