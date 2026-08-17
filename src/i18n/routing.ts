import type { LocalePrefixMode } from 'next-intl/routing';
import { defineRouting } from 'next-intl/routing';
import { getLocaleCookieName } from '@/lib/common/locale-cookie';

export const routingConfig = {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  localePrefix: 'as-needed' as LocalePrefixMode,
  // URL is the locale source of truth. Cookie / Accept-Language detection would
  // re-prefix `/us-branch` → `/us-branch/de` when cookies are missing or stale
  // (COP-5852 freeze). Language still changes via `/de` in the path.
  localeDetection: false,
  // Named cookie is still written when the browser allows it (language switcher);
  // it is not used to detect locale.
  localeCookie: { name: getLocaleCookieName() },
};

export const routing = defineRouting({
  ...routingConfig,
});
