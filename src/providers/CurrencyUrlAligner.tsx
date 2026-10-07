'use client';

import { Suspense, useContext, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { useGlobalSyncReady } from '@/hooks/common/useGlobalSyncReady';
import { useSession } from '@/hooks/session/useSession';
import { useSite } from '@/hooks/site/useSite';
import { usePathname, useRouter } from '@/i18n/navigation';
import { fetchCurrentSession } from '@/lib/client/session';
import { currencySwitchBlockedCopy } from '@/lib/common/currency-switch-message';
import {
  CURRENCY_QUERY_PARAM,
  isCurrencyAllowedOnSite,
  parseCurrencyQueryParam,
  replaceCurrencySearchParam,
} from '@/lib/common/currency-url';
import { getLogger } from '@/lib/logger/use-logger-client';
import { SiteContext } from '@/providers/SiteProvider';
import { SessionStoreContext } from '@/providers/StoreProvider';

/**
 * Honors inbound `?currency=` (share / external links) and keeps that query
 * aligned with session + cart.
 *
 * - Missing param: do nothing. Defaults stay out of the URL.
 * - Valid param ≠ session: try `setCurrency`. Success keeps the URL; failure
 *   (unsupported, cart reprice, network) rewrites the query to the session currency.
 * - Invalid param: rewrite to the session currency.
 *
 * Waits for site/session alignment so a deep-linked site switch can finish first.
 */
function CurrencyUrlAlignerContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const urlSiteCode = useContext(SiteContext);
  const { session, loading: sessionLoading, setCurrency } = useSession();
  const { site, loading: siteLoading } = useSite();
  const sessionStore = useContext(SessionStoreContext);
  const { ready: syncReady } = useGlobalSyncReady();
  const tRegions = useTranslations('common.Regions');
  const pipelineInFlightRef = useRef(false);
  const lastFailedAttemptRef = useRef<string | null>(null);
  const sessionCurrency = session?.currency?.trim().toUpperCase();
  const sessionSiteCode = session?.siteCode;
  const hasCurrencyQuery = searchParams.has(CURRENCY_QUERY_PARAM);
  const rawCurrencyQuery = searchParams.get(CURRENCY_QUERY_PARAM);
  const storefrontSearch = searchParams.toString();

  useEffect(() => {
    if (
      !sessionCurrency ||
      sessionLoading ||
      siteLoading ||
      !sessionSiteCode ||
      !urlSiteCode ||
      sessionSiteCode !== urlSiteCode ||
      !site ||
      pipelineInFlightRef.current
    ) {
      return;
    }

    if (!hasCurrencyQuery) {
      lastFailedAttemptRef.current = null;
      return;
    }

    const parsed = parseCurrencyQueryParam(rawCurrencyQuery);

    if (parsed && parsed === sessionCurrency) {
      lastFailedAttemptRef.current = null;
      if (rawCurrencyQuery !== sessionCurrency) {
        router.replace(replaceCurrencySearchParam(pathname, storefrontSearch, sessionCurrency), {
          scroll: false,
        });
      }
      return;
    }

    const rewriteToSession = () => {
      router.replace(replaceCurrencySearchParam(pathname, storefrontSearch, sessionCurrency), {
        scroll: false,
      });
    };

    if (!parsed || !isCurrencyAllowedOnSite(site, parsed)) {
      rewriteToSession();
      return;
    }

    // Wait until site/session/cart are settled. Calling setCurrency while another
    // mutation holds the lock returns success:false and must not rewrite the URL
    // back to the old session currency.
    if (!syncReady) {
      return;
    }

    const attemptKey = `${parsed}|${sessionCurrency}`;
    if (lastFailedAttemptRef.current === attemptKey) {
      return;
    }

    pipelineInFlightRef.current = true;
    const fromCurrency = sessionCurrency;
    void (async () => {
      try {
        getLogger().info(
          { event: 'currency_url_align', from: fromCurrency, to: parsed },
          'Applying currency from storefront URL',
        );
        const result = await setCurrency(parsed);
        if (result.success) {
          lastFailedAttemptRef.current = null;
          router.refresh();
          return;
        }
        if (result.cartCurrencyBlocked) {
          lastFailedAttemptRef.current = attemptKey;
          rewriteToSession();
          const blocked = currencySwitchBlockedCopy(fromCurrency, parsed, result.couponCodes);
          notify({
            title: tRegions(blocked.key, blocked.values),
            type: ToastType.Info,
            duration: 8000,
          });
          return;
        }
        if (sessionStore?.getState().isMutationInFlight()) {
          lastFailedAttemptRef.current = null;
          return;
        }
        const latest = await fetchCurrentSession();
        const latestCurrency = latest?.currency?.trim().toUpperCase();
        if (latestCurrency === parsed) {
          lastFailedAttemptRef.current = null;
          if (latest) {
            sessionStore?.getState().setSession(latest);
          }
          router.refresh();
          return;
        }
        lastFailedAttemptRef.current = attemptKey;
        rewriteToSession();
      } catch (err) {
        lastFailedAttemptRef.current = attemptKey;
        getLogger().error({ err, event: 'currency_url_align_failed', to: parsed }, 'Currency URL align failed');
        rewriteToSession();
      } finally {
        pipelineInFlightRef.current = false;
      }
    })();
  }, [
    hasCurrencyQuery,
    pathname,
    rawCurrencyQuery,
    router,
    sessionCurrency,
    sessionLoading,
    sessionSiteCode,
    sessionStore,
    setCurrency,
    syncReady,
    site,
    siteLoading,
    storefrontSearch,
    tRegions,
    urlSiteCode,
  ]);

  return null;
}

export function CurrencyUrlAligner() {
  return (
    <Suspense fallback={null}>
      <CurrencyUrlAlignerContent />
    </Suspense>
  );
}
