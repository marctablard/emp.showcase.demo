import { defineRouting } from 'next-intl/routing';
import { LocalePrefixMode } from 'next-intl/routing';

export const routingConfig = {
  // A list of all locales that are supported
  locales: ['en', 'de'],
  // Used when no locale matches
  defaultLocale: 'en',
  // Used for routing
  localePrefix: 'as-needed' as LocalePrefixMode,
}
export const routing = defineRouting({
  ...routingConfig
});
