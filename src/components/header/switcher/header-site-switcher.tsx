'use client';

import { useContext, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import TopBarSwitcher from '@/components/ui/molecules/ui-topbar-switcher';
import { useGlobalSyncReady } from '@/hooks/common/useGlobalSyncReady';
import { useSite } from '@/hooks/site/useSite';
import { getPathname } from '@/i18n/navigation';
import { getSite } from '@/lib/client/site';
import { performSiteSwitch } from '@/lib/client/site-switch';
import { getLogger } from '@/lib/logger/use-logger-client';
import { CartStoreContext, SessionStoreContext, SiteStoreContext } from '@/providers/StoreProvider';
import { Spinner } from '../../ui/spinner';
import { ToastType, notify } from '../../ui/toast-notification';

export function SiteSwitcher() {
  const t = useTranslations('common.Regions');
  const { site, availableSites, loading: siteLoading } = useSite();
  const { ready: syncReady } = useGlobalSyncReady();
  const locale = useLocale();
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);

  const sessionStore = useContext(SessionStoreContext);
  const siteStore = useContext(SiteStoreContext);
  const cartStore = useContext(CartStoreContext);

  const switchSite = async (targetSite: string) => {
    if (isSwitching || siteLoading || !site || targetSite === site.code) {
      return;
    }
    if (!sessionStore || !siteStore || !cartStore) {
      return;
    }

    setIsSwitching(true);
    try {
      const result = await performSiteSwitch(
        targetSite,
        { sessionStore, siteStore, cartStore },
        {
          source: 'user',
          locale,
          navigateTo: (path) => router.push(path),
          getRedirectPath: getPathname,
          getSiteByCode: getSite,
          router,
          logger: getLogger(),
        },
      );

      if (!result.success && result.reason !== 'same-site' && result.reason !== 'locked') {
        notify({ title: t('switchFailed'), type: ToastType.Error });
      }
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
      disabled={isSwitching || siteLoading || !syncReady}
    />
  );
}
