'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';
import TopBarSwitcher from '@/components/ui/molecules/ui-topbar-switcher';
import { Spinner } from '@/components/ui/spinner';
import { useSite } from '@/hooks/site/useSite';
import { type LanguageKey, dk } from '@/i18n/dynamic-key';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { updateSessionLanguage } from '@/lib/client/session';
import { getLogger } from '@/lib/logger/use-logger-client';

const LOCALIZED_BREADCRUMB_FILTER_PARAMS = [
  'filters[_product_i18n.categoryBreadcrumbs.displayPath]',
  'filters[_product_i18n.categories.breadcrumbs.displayPath]',
];

export const stripLocalizedBreadcrumbFilter = (search: string): string => {
  const normalizedSearch = search.startsWith('?') ? search.slice(1) : search;
  const searchParams = new URLSearchParams(normalizedSearch);

  for (const paramName of LOCALIZED_BREADCRUMB_FILTER_PARAMS) {
    searchParams.delete(paramName);
  }

  return searchParams.toString();
};

export function LanguageSwitcher() {
  const t = useTranslations('common.Languages');

  const currentLocale = useLocale();
  const { site, loading: siteLoading } = useSite();
  const pathname = usePathname();
  const router = useRouter();

  // Memoize the language options to avoid recreating objects on each render
  const languageOptions = useMemo(() => {
    let availableLanguages;
    if (site?.languages && Array.isArray(site.languages) && site.languages.length > 0) {
      availableLanguages = routing.locales.filter((locale) =>
        site.languages.some((lang) => lang.toLowerCase() === locale.toLowerCase()),
      );
    } else {
      availableLanguages = routing.locales;
    }
    return availableLanguages.map((locale) => ({
      code: locale,
      name: t(dk<LanguageKey>(locale)),
    }));
  }, [site, t]);

  const switchLocale = async (newLocale: string) => {
    if (!site) {
      return;
    }
    // Keep Emporix session.language aligned with the UI locale so downstream
    // localized reads (cart, checkout, recommendations) receive the expected
    // language. Failures are logged but never block navigation — the SSR
    // layout self-heals unsupported locales on next request.
    try {
      await updateSessionLanguage(newLocale);
    } catch (err) {
      getLogger().error(
        { err, locale: newLocale, site: site.code },
        'updateSessionLanguage failed during language switch',
      );
    }
    const sanitizedSearch = stripLocalizedBreadcrumbFilter(globalThis.location.search);
    const isBrowsePath = pathname.endsWith('/browse');
    let href = pathname;
    if (sanitizedSearch) {
      href = `${pathname}?${sanitizedSearch}`;
    }
    if (!sanitizedSearch && isBrowsePath) {
      href = '/browse';
    }
    router.push(href, { locale: newLocale, site: site.code });
  };

  if (siteLoading) {
    return <Spinner color="white" variant="sm" />;
  }

  return (
    <TopBarSwitcher
      options={languageOptions}
      icon={<Languages className="w-4 h-4" />}
      current={currentLocale}
      label={t('label')}
      onSelected={switchLocale}
    />
  );
}
