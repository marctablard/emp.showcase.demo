import { createNavigation as createIntlNavigation } from 'next-intl/navigation';
import { routing } from '@/i18n/routing';

const { getPathname: getI18nPathname } = createIntlNavigation(routing);

export type LocaleAwareHref = string | { pathname: string };

/**
 * next-intl-aligned locale path for site-aware `useRouter`.
 * Omitting `nextLocale` (or passing the current locale) uses `currentLocale`
 * without `forcePrefix` so default `en` stays unprefixed.
 * `forcePrefix` is only used when switching to a different locale.
 */
export function resolveLocaleAwareHref(href: LocaleAwareHref, currentLocale: string, nextLocale?: string): string {
  const isDifferentLocale = nextLocale != null && nextLocale !== currentLocale;

  if (isDifferentLocale) {
    return getI18nPathname({
      href,
      locale: nextLocale,
      forcePrefix: true,
    });
  }

  return getI18nPathname({
    href,
    locale: currentLocale,
  });
}
