'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import TopBarSwitcher from '@/components/ui/molecules/ui-topbar-switcher';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/hooks/session/useSession';
import { useSite } from '@/hooks/site/useSite';
import { useL10n } from '@/hooks/useL10n';

export function RegionSwitcher() {
  const { session, loading: sessionLoading, setRegion } = useSession();
  const { l10n } = useL10n();
  const t = useTranslations('common.Regions');
  const { regions, loading: siteLoading } = useSite();
  const currentRegion = useMemo(() => {
    if (!regions || regions.length === 0) {
      return undefined;
    }

    if (session?.region) {
      const matchedRegion = regions.find((region) => region.code === session.region);
      if (matchedRegion) {
        return matchedRegion;
      }
    }

    return regions[0];
  }, [regions, session]);

  const switchRegion = (region: string) => {
    setRegion(region);
  };

  if (siteLoading || sessionLoading) {
    return <Spinner color="default" variant="sm" />;
  }

  if (!regions || regions.length <= 1 || !currentRegion) {
    return <></>;
  }

  return (
    <TopBarSwitcher
      options={regions.map((region) => ({
        code: region.code,
        name: l10n(region.name),
      }))}
      current={currentRegion.code}
      label={t('label')}
      onSelected={switchRegion}
      icon={<Globe className="w-4 h-4" />}
    />
  );
}
