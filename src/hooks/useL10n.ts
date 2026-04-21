'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { routingConfig } from '@/i18n/routing';
import { l10nOrEmpty as utilL10nOrEmpty, l10n as utill10n } from '@/lib/l10n';
import type { LocalizedString } from '@/platform/services/model/common';
import { useSiteStore } from '@/providers/StoreProvider';

/**
 * Hook for localizing content based on the current locale.
 *
 * Resolution order:
 *   1. `locale` argument (or `useLocale()` from next-intl when omitted)
 *   2. `defaultLocale` argument, or — when not provided — `site.defaultLanguage`
 *      from `useSiteStore`, falling back to `routingConfig.defaultLocale`
 */
export function useL10n(locale?: string, defaultLocale?: string) {
  const intlLocale = useLocale();
  const resolvedLocale = locale ?? intlLocale;
  const siteDefaultLanguage = useSiteStore().site?.defaultLanguage;
  const effectiveDefault = defaultLocale ?? siteDefaultLanguage ?? routingConfig.defaultLocale;

  return useMemo(
    () => ({
      l10n: (input: string | LocalizedString) => utill10n(input, resolvedLocale, effectiveDefault),
      l10nOrEmpty: (input: string | LocalizedString) => utilL10nOrEmpty(input, resolvedLocale, effectiveDefault),
    }),
    [resolvedLocale, effectiveDefault],
  );
}
