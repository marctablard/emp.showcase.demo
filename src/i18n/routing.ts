import { LocalePrefixMode, defineRouting } from 'next-intl/routing';

export const routingConfig = {
  // A list of all locales that are supported
  locales: ['en', 'de'],
  // Used when no locale matches
  defaultLocale: 'en',
  // Used for routing
  localePrefix: 'as-needed' as LocalePrefixMode,
  localeCooke: {
    name: process.env.NEXT_PUBLIC_LOCALE_COOKIE,
  },
};
export const routing = defineRouting({
  ...routingConfig,
});
