import { useLocale } from 'next-intl';
import { routingConfig } from '@/i18n/routing';
import { l10nOrEmpty as utilL10nOrEmpty, l10n as utill10n } from '@/lib/l10n';
import type { LocalizedString } from '@/platform/services/model/common';

/**
 * Hook for localizing content based on the current locale (and routing default locale fallback).
 */
export function useL10n(locale?: string, defaultLocale: string = routingConfig.defaultLocale) {
  const intlLocale = useLocale();
  const resolvedLocale = locale ?? intlLocale;

  return {
    l10n: (input: string | LocalizedString) => utill10n(input, resolvedLocale, defaultLocale),
    l10nOrEmpty: (input: string | LocalizedString) => utilL10nOrEmpty(input, resolvedLocale, defaultLocale),
  };
}
