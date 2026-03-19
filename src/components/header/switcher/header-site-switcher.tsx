'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import TopBarSwitcher from '@/components/ui/molecules/ui-topbar-switcher';
import { useSession } from '@/hooks/session/useSession';
import { useSite } from '@/hooks/site/useSite';
import { getPathname } from '@/i18n/navigation';
import { getSite } from '@/lib/client/site';
import { getLogger } from '@/lib/logger/use-logger-client';
import { Spinner } from '../../ui/spinner';
import { ToastType, notify } from '../../ui/toast-notification';
import { switchSiteAndRedirect } from './site-switcher-utils';

export function SiteSwitcher() {
  const t = useTranslations('common.Regions');
  const { site, availableSites, loading: siteLoading } = useSite();
  const { setSite: updateSessionSite } = useSession();
  const locale = useLocale();
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);

  const switchSite = async (targetSite: string) => {
    if (isSwitching || siteLoading || !site || targetSite === site.code) {
      return;
    }

    setIsSwitching(true);
    try {
      await switchSiteAndRedirect({
        site: targetSite,
        locale,
        getSiteByCode: getSite,
        updateSessionSite,
        getRedirectPath: getPathname,
        navigateTo: (path) => router.push(path),
        logger: getLogger(),
        notifySwitchFailure: () =>
          notify({
            title: t('switchFailed'),
            type: ToastType.Error,
          }),
      });
    } finally {
      setIsSwitching(false);
    }
  };

  if (siteLoading) {
    return <Spinner color="default" variant="sm" />;
  }

  if (!availableSites || !site) {
    return <></>;
  }

  // If only one site is available, just show the site name without switcher
  if (availableSites.length === 1) {
    return (
      <div className="flex items-baseline gap-1.5 h-auto normal-case focus-none hover:cursor-pointer">
        <Globe className="flex self-center w-4 h-4" />
        <span className="flex self-baseline text-sm">{site.name}</span>
      </div>
    );
  }

  return (
    <TopBarSwitcher
      options={availableSites.map((site) => ({
        code: site.code,
        name: site.name,
      }))}
      current={site.code}
      label={t('label')}
      onSelected={switchSite}
      icon={<Globe className="w-4 h-4" />}
      disabled={isSwitching || siteLoading}
    />
  );
}
