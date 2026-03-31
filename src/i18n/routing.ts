import type { LocalePrefixMode } from 'next-intl/routing';
import { defineRouting } from 'next-intl/routing';

export const routingConfig = {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  localePrefix: 'as-needed' as LocalePrefixMode,
  localeCookie: {
    name: process.env.NEXT_PUBLIC_LOCALE_COOKIE,
  },
};

export const routing = defineRouting({
  ...routingConfig,
});
