'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import TopBarSwitcher from '@/components/ui/molecules/ui-topbar-switcher';
import { useSite } from '@/hooks/site/useSite';
import { redirect } from '@/i18n/navigation';
import { getSite } from '@/lib/client/site';
import { Spinner } from '../../ui/spinner';

export function SiteSwitcher() {
  const t = useTranslations('common.Regions');
  const { site, availableSites, loading: siteLoading } = useSite();
  const locale = useLocale();
  const [currentSite] = useState(site);

  const switchSite = async (site: string) => {
    // redirect to ensure clean session handling on server side
    const siteObject = await getSite(site);
    if (!siteObject) {
      console.error('Site not found:', site);
      return;
    }
    const targetLocale = siteObject.languages?.includes(locale) ? locale : siteObject.languages?.[0] || locale;
    redirect({ href: '/', locale: targetLocale, site, forcePrefix: true });
  };

  if (siteLoading) {
    return <Spinner color="default" variant="sm" />;
  }

  if (!availableSites || !currentSite) {
    return <></>;
  }

  // If only one site is available, just show the site name without switcher
  if (availableSites.length === 1) {
    return (
      <div className="flex items-baseline gap-1.5 h-auto normal-case focus-none hover:cursor-pointer">
        <Globe className="flex self-center w-4 h-4" />
        <span className="flex self-baseline text-sm">{currentSite.name}</span>
      </div>
    );
  }

  return (
    <TopBarSwitcher
      options={availableSites.map((site) => ({
        code: site.code,
        name: site.name,
      }))}
      current={currentSite.code}
      label={t('label')}
      onSelected={switchSite}
      icon={<Globe className="w-4 h-4" />}
    />
  );
}
