'use client';

import { Suspense, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { IconName } from 'lucide-react/dynamic';
import { DynamicIcon } from 'lucide-react/dynamic';
import TopBarSwitcher from '@/components/ui/molecules/ui-topbar-switcher';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/hooks/session/useSession';
import { useSite } from '@/hooks/site/useSite';
import { l10n } from '@/lib/utils';

function CurrencySwitcherContent() {
  const { session, loading: sessionLoading, setCurrency } = useSession();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('common.Currencies');
  const { currencies, loading: siteLoading, site } = useSite();
  const [isSwitching, setIsSwitching] = useState(false);
  const currentCurrency = useMemo(() => {
    // First, try to find session currency in available currencies
    if (currencies && currencies.length > 0) {
      if (session?.currency) {
        const matchedCurrency = currencies.find((currency) => currency.code === session.currency);
        if (matchedCurrency) {
          return matchedCurrency;
        }
      }
      return currencies[0];
    }

    // Fallback to site's default currency when currencies array is empty
    if (site?.defaultCurrency) {
      return site.defaultCurrency;
    }

    return undefined;
  }, [currencies, session, site]);

  const switchCurrency = async (currency: string) => {
    if (isSwitching || sessionLoading) {
      return;
    }
    if (currency === currentCurrency?.id || currency === session?.currency) {
      return;
    }

    setIsSwitching(true);
    try {
      const success = await setCurrency(currency);
      if (success) {
        // Refresh page after session update completes to reload prices with new currency
        router.refresh();
      }
    } finally {
      setIsSwitching(false);
    }
  };

  if (siteLoading || sessionLoading) {
    return <Spinner color="default" variant="sm" />;
  }

  if (!currentCurrency) {
    return <></>;
  }

  // Build options array - use currencies if available, otherwise use currentCurrency
  const options =
    currencies && currencies.length > 0
      ? currencies.map((currency) => ({
          code: currency.id,
          name: l10n(currency.name || currency.id, locale),
        }))
      : [
          {
            code: currentCurrency.id,
            name: l10n(currentCurrency.name || currentCurrency.id, locale),
          },
        ];

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
      options={options}
      current={currentCurrency.id}
      label={t('label')}
      onSelected={switchCurrency}
      icon={icon}
      disabled={isSwitching || sessionLoading}
    />
  );
}

export function CurrencySwitcher() {
  return (
    <Suspense fallback={<Spinner color="default" variant="sm" />}>
      <CurrencySwitcherContent />
    </Suspense>
  );
}
