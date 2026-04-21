'use client';

import { Suspense, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { IconName } from 'lucide-react/dynamic';
import { DynamicIcon } from 'lucide-react/dynamic';
import TopBarSwitcher from '@/components/ui/molecules/ui-topbar-switcher';
import { Spinner } from '@/components/ui/spinner';
import { useGlobalSyncReady } from '@/hooks/common/useGlobalSyncReady';
import { useSession } from '@/hooks/session/useSession';
import { useSite } from '@/hooks/site/useSite';
import { useL10n } from '@/hooks/useL10n';

function CurrencySwitcherContent() {
  const { session, loading: sessionLoading, setCurrency } = useSession();
  const { l10n } = useL10n();
  const router = useRouter();
  const t = useTranslations('common.Currencies');
  const { currencies, loading: siteLoading, site } = useSite();
  const { ready: syncReady } = useGlobalSyncReady();
  const [isSwitching, setIsSwitching] = useState(false);
  const currentCurrency = useMemo(() => {
    // Match session currency by id or code (Emporix list entries may omit `code`).
    if (currencies && currencies.length > 0 && session?.currency) {
      const matchedCurrency = currencies.find(
        (currency) => currency.id === session.currency || currency.code === session.currency,
      );
      if (matchedCurrency) {
        return matchedCurrency;
      }
      return { id: session.currency, code: session.currency, name: session.currency };
    }

    if (currencies && currencies.length > 0) {
      return currencies[0];
    }

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
          name: l10n(currency.name || currency.id),
        }))
      : [
          {
            code: currentCurrency.id,
            name: l10n(currentCurrency.name || currentCurrency.id),
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
    <div data-testid="header-currency-display" data-selected-currency={currentCurrency.id}>
      <TopBarSwitcher
        options={options}
        current={currentCurrency.id}
        label={t('label')}
        onSelected={switchCurrency}
        icon={icon}
        disabled={isSwitching || sessionLoading || !syncReady}
      />
    </div>
  );
}

export function CurrencySwitcher() {
  return (
    <Suspense fallback={<Spinner color="default" variant="sm" />}>
      <CurrencySwitcherContent />
    </Suspense>
  );
}
