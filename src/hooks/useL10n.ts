'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { l10n as utill10n } from '@/lib/utils';
import type { LocalizedString } from '@/platform/services/model/common';
import { useSiteStore } from '@/providers/StoreProvider';

type L10nInput = string | LocalizedString | Array<{ language: string; message: string }> | unknown;

/**
 * Client hook returning an `l10n` function with the deterministic fallback
 * chain `[currentLocale, site.defaultLanguage, NEXT_PUBLIC_DEFAULT_LANGUAGE]`.
 *
 * `useLocale()` supplies the current UI locale when `locale` is omitted, and
 * `site.defaultLanguage` is read from `useSiteStore` so every caller inherits
 * the same fallback without threading the site through props.
 */
export function useL10n(locale?: string) {
  const intlLocale = useLocale();
  const effectiveLocale = locale ?? intlLocale;
  const siteDefaultLanguage = useSiteStore().site?.defaultLanguage;

  const l10n = useMemo(() => {
    const fallbacks = siteDefaultLanguage ? [siteDefaultLanguage] : undefined;
    return (input: L10nInput) => utill10n(input, effectiveLocale, fallbacks);
  }, [effectiveLocale, siteDefaultLanguage]);

  return { l10n };
}
