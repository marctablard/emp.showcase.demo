import type { LocalePrefixMode } from 'next-intl/routing';
import { defineRouting } from 'next-intl/routing';

const localeCookieName = process.env.NEXT_PUBLIC_LOCALE_COOKIE;

export const routingConfig = {
  // A list of all locales that are supported
  locales: ['en', 'de', 'it', 'fr'],
  // Used when no locale matches
  defaultLocale: 'en',
  // Used for routing
  localePrefix: 'as-needed' as LocalePrefixMode,
  // Keep next-intl on the same cookie name as `src/site/middleware.ts` (`syncSiteCookie`) and
  // `src/lib/server/context.ts`; otherwise next-intl silently falls back to `NEXT_LOCALE` while we
  // write `NEXT_PUBLIC_LOCALE_COOKIE`, which creates the stale-locale bug described in
  // `site-switch.ts` (site switch leaves an unsupported `de` in the next-intl-owned cookie and
  // causes `/us` → `/us/de` redirects on sites that do not advertise `de`).
  ...(localeCookieName ? { localeCookie: { name: localeCookieName } } : {}),
};
export const routing = defineRouting({
  ...routingConfig,
});
