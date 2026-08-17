const DEFAULT_LOCALE_COOKIE_NAME = 'NEXT_LOCALE';
const LOCALE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** One-shot query param used by unsupported-locale layout bounces so middleware can Set-Cookie. */
export const LOCALE_ALIGN_QUERY_PARAM = 'emp_locale';

/**
 * Cookie name next-intl and the storefront share for the shopper locale.
 * `NEXT_PUBLIC_LOCALE_COOKIE` trimmed, else {@link DEFAULT_LOCALE_COOKIE_NAME}.
 */
export function getLocaleCookieName(): string {
  const configuredCookieName = process.env.NEXT_PUBLIC_LOCALE_COOKIE?.trim();
  return configuredCookieName && configuredCookieName.length > 0 ? configuredCookieName : DEFAULT_LOCALE_COOKIE_NAME;
}

/**
 * Persist the resolved locale on `document.cookie` so the next navigation is
 * read by next-intl. No-ops when `document` is unavailable (SSR / Edge / Node).
 */
export function writeLocaleCookie(locale: string): void {
  if (globalThis.document === undefined) {
    return;
  }
  const cookieName = getLocaleCookieName();
  globalThis.document.cookie = `${cookieName}=${encodeURIComponent(locale)}; Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

/**
 * Append {@link LOCALE_ALIGN_QUERY_PARAM} to a site-aware path (after `getPathname`).
 * Existing query and hash are preserved.
 */
export function appendLocaleAlignParam(path: string, locale: string): string {
  const hashIndex = path.indexOf('#');
  const pathnameAndQuery = hashIndex === -1 ? path : path.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : path.slice(hashIndex);
  const separator = pathnameAndQuery.includes('?') ? '&' : '?';
  return `${pathnameAndQuery}${separator}${LOCALE_ALIGN_QUERY_PARAM}=${encodeURIComponent(locale)}${hash}`;
}

/**
 * Return `value` when it is in `allowedLocales`; otherwise `undefined`.
 * The caller supplies the allow-list (middleware: `intlRouting.locales`).
 */
export function parseLocaleAlignParam(
  value: string | null | undefined,
  allowedLocales: readonly string[],
): string | undefined {
  if (!value) {
    return undefined;
  }
  return allowedLocales.includes(value) ? value : undefined;
}
