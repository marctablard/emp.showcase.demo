import { useLocale } from 'next-intl';
import { l10n as utill10n } from '@/lib/utils';
import type { LocalizedString } from '@/platform/services/model/common';

/**
 * Hook for localizing content based on the current locale
 * @returns Functions to handle localized content
 */
export function useL10n(locale?: string) {
  if (!locale) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    locale = useLocale();
  }

  const l10n = (input: string | LocalizedString) => utill10n(input, locale);

  return {
    l10n,
  };
}
