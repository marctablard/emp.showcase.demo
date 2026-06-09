/**
 * Cookie names used by the storefront for preference persistence that needs to
 * survive auth transitions (login / logout / anonymous token refresh).
 *
 * These are intentionally plain constants — not env vars — per the project
 * rule in `general.mdc` ("Environment variables — when agents may add them").
 * The existing named-cookie precedent (`NEXT_PUBLIC_SITE_COOKIE`,
 * `NEXT_PUBLIC_LOCALE_COOKIE`) predates that rule; new preference cookies
 * introduced here use a hard-coded name.
 *
 * Currency is cookie-backed to keep symmetry with the site and locale cookies
 * so that `EmporixTokenManagerServer.resolveSessionParams` can re-seed the next
 * anonymous session context via the 2026-04-21 GA
 * `GET /customerlogin/auth/anonymous/login?currency=…` query parameter.
 */
export const CURRENCY_COOKIE_NAME = 'next-currency';
