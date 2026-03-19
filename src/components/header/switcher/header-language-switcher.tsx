'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';
import TopBarSwitcher from '@/components/ui/molecules/ui-topbar-switcher';
import { Spinner } from '@/components/ui/spinner';
import { useSite } from '@/hooks/site/useSite';
import { type LanguageKey, dk } from '@/i18n/dynamic-key';
import { redirect, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function LanguageSwitcher() {
  const t = useTranslations('common.Languages');

  const currentLocale = useLocale();
  const { site, loading: siteLoading } = useSite();
  const pathname = usePathname();

  // Get the current search parameters to preserve them when switching languages
  const searchParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

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

  const switchLocale = (newLocale: string) => {
    if (!site) {
      return;
    }
    const searchParamsString = searchParams.toString();
    const queryString = searchParamsString ? `?${searchParamsString}` : '';
    redirect({ href: pathname + queryString, locale: newLocale, site: site.code, forcePrefix: true });
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
