'use client';

import { useEffect, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { DynamicIcon, IconName } from 'lucide-react/dynamic';
import TopBarSwitcher from '@/components/ui/molecules/ui-topbar-switcher';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/hooks/session/useSession';
import { useSite } from '@/hooks/site/useSite';
import { l10n } from '@/lib/utils';

export function CurrencySwitcher() {
  const { session, loading: sessionLoading, setCurrency } = useSession();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('common.Currencies');
  const { currencies, loading: siteLoading } = useSite();
  const currentCurrency = useMemo(() => {
    if (!currencies || currencies.length === 0) {
      return undefined;
    }

    if (session?.currency) {
      const matchedCurrency = currencies.find((currency) => currency.code === session.currency);
      if (matchedCurrency) {
        return matchedCurrency;
      }
    }

    return currencies[0];
  }, [currencies, session]);

  const switchCurrency = (currency: string) => {
    setCurrency(currency);
  };

  useEffect(() => {
    if (session?.currency != currentCurrency?.code) {
      // refresh page, because much will change due to changed currency
      router.refresh();
    }
  }, [session, currentCurrency, router]);

  if (siteLoading || sessionLoading) {
    return <Spinner color="default" variant="sm" />;
  }

  if (!currencies || currencies.length <= 1 || !currentCurrency) {
    return <></>;
  }

  function getIconName(): IconName {
    switch (currentCurrency?.code) {
      case 'EUR':
        return 'euro';
      case 'GBP':
        return 'pound-sterling';
      case 'USD':
        return 'dollar-sign';
      case 'YEN':
        return 'japanese-yen';
      case 'RS':
        return 'indian-rupee';
      default:
        return 'coins';
    }
  }
  const icon = (
    <span className="w-4 h-4">
      <DynamicIcon name={getIconName()} className="w-4 h-4" />
    </span>
  );

  return (
    <TopBarSwitcher
      options={currencies.map((currency) => ({
        code: currency.id,
        name: l10n(currency.name || currency.id, locale),
      }))}
      current={currentCurrency.id}
      label={t('label')}
      onSelected={switchCurrency}
      icon={icon}
    />
  );
}
