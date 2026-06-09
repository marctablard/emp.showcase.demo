import { shallow } from 'zustand/shallow';
import { devSyncLog } from '@/lib/client/dev-sync-log';
import { invalidateShippingMethodsResponseCache } from '@/lib/client/shipping-methods-response-cache';
import { getLogger } from '@/lib/logger/use-logger-client';
import type {
  AvailabilityStoreApi,
  CartStoreApi,
  CheckoutStoreApi,
  ComparisonStoreApi,
  CustomerStoreApi,
  ProductStoreApi,
  SessionStoreApi,
  SiteStoreApi,
} from '@/providers/StoreProvider';

type UnsubscribeFn = () => void;

interface StoreSynchronizerParams {
  sessionStore: SessionStoreApi;
  cartStore: CartStoreApi;
  siteStore: SiteStoreApi;
  customerStore: CustomerStoreApi;
  productStore: ProductStoreApi;
  availabilityStore: AvailabilityStoreApi;
  checkoutStore: CheckoutStoreApi;
  comparisonStore?: ComparisonStoreApi;
}

const CURRENCY_SYNC_RETRY_DELAYS_MS = [0, 250, 750];

/**
 * Defensive/reactive cross-store subscriptions. Session mutations are owned by
 * `performSiteSwitch`; these handlers only react to already-settled session changes
 * (cache invalidations, derived-store updates, defensive nets for non-orchestrated flows
 * such as login/logout). Returns unsubscribers for unmount.
 */
export function setupStoreSynchronization({
  sessionStore,
  cartStore,
  siteStore,
  customerStore,
  productStore,
  availabilityStore,
  checkoutStore,
  comparisonStore,
}: StoreSynchronizerParams): UnsubscribeFn[] {
  const unsubscribers: UnsubscribeFn[] = [];
  let activeCurrencySyncToken = 0;

  const unsubShippingMethodsCache = sessionStore.subscribe(
    (state) => ({
      currency: state.session?.currency,
      siteCode: state.session?.siteCode,
      legalEntityId: typeof state.session?.legalEntityId === 'string' ? state.session.legalEntityId.trim() : '',
    }),
    () => {
      invalidateShippingMethodsResponseCache();
    },
    { equalityFn: shallow },
  );
  unsubscribers.push(unsubShippingMethodsCache);

  // Reset the persisted checkout store (`emp-checkout`, sessionStorage) when the session
  // site or currency changes. Shipping/billing addresses, payment and shipping method
  // selections are scoped to a single site+currency context — keeping them across a site
  // or currency switch can POST legal-entity addresses or shipping methods from the
  // previous context to Emporix and make the cart calc reject the order.
  const unsubCheckoutReset = sessionStore.subscribe(
    (state) => ({
      siteCode: state.session?.siteCode ?? '',
      currency: state.session?.currency ?? '',
    }),
    (curr, prev) => {
      if (!curr.siteCode || !curr.currency) {
        return;
      }
      const prevSite = typeof prev === 'object' && prev && 'siteCode' in prev ? prev.siteCode : '';
      const prevCurrency = typeof prev === 'object' && prev && 'currency' in prev ? prev.currency : '';
      if (!prevSite || !prevCurrency) {
        return;
      }
      if (prevSite === curr.siteCode && prevCurrency === curr.currency) {
        return;
      }
      devSyncLog('store-sync: reset checkout store (session site/currency changed)', {
        prevSite,
        prevCurrency,
        siteCode: curr.siteCode,
        currency: curr.currency,
      });
      checkoutStore.getState().reset();
    },
    { equalityFn: shallow },
  );
  unsubscribers.push(unsubCheckoutReset);

  // Product cache is keyed only by id; clear on site/currency change so PDP/search never
  // display another site's currency before the fresh fetch completes.
  const unsubProductClientCache = sessionStore.subscribe(
    (state) => ({
      siteCode: state.session?.siteCode ?? '',
      currency: state.session?.currency ?? '',
    }),
    (curr, prev) => {
      if (!curr.siteCode || !curr.currency) {
        return;
      }
      if (prev === undefined) {
        return;
      }
      const prevSite =
        typeof prev === 'object' && prev && 'siteCode' in prev ? (prev as { siteCode: string }).siteCode : '';
      const prevCur =
        typeof prev === 'object' && prev && 'currency' in prev ? (prev as { currency: string }).currency : '';
      if (!prevSite || !prevCur) {
        return;
      }
      if (prevSite === curr.siteCode && prevCur === curr.currency) {
        return;
      }
      devSyncLog('store-sync: clear client product cache (session site/currency changed)', {
        prevSite,
        prevCurrency: prevCur,
        siteCode: curr.siteCode,
        currency: curr.currency,
      });
      productStore.getState().clearProductCache();
      availabilityStore.getState().clearAllAvailabilities();
    },
    { equalityFn: shallow },
  );
  unsubscribers.push(unsubProductClientCache);

  const runCurrencySync = async (currency: string, siteCode: string) => {
    // Suppressed while `performSiteSwitch` holds the mutation lock: the orchestrator is the
    // single writer and already reconciles cart currency inside its settling window.
    if (sessionStore.getState().isMutationInFlight()) {
      devSyncLog('store-sync: currency sync suppressed — mutation in flight', { currency, siteCode });
      return;
    }
    const syncToken = ++activeCurrencySyncToken;
    for (let i = 0; i < CURRENCY_SYNC_RETRY_DELAYS_MS.length; i++) {
      const delay = CURRENCY_SYNC_RETRY_DELAYS_MS[i];
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Cancel stale scheduled attempts if newer currency/site changes arrived.
      if (syncToken !== activeCurrencySyncToken) {
        return;
      }

      const latestSession = sessionStore.getState().session;
      if (!latestSession || latestSession.currency !== currency || latestSession.siteCode !== siteCode) {
        devSyncLog('store-sync: currency sync skipped (stale session)', {
          currency,
          siteCode,
          latestCurrency: latestSession?.currency,
          latestSite: latestSession?.siteCode,
        });
        return;
      }

      try {
        devSyncLog('store-sync: syncing cart currency with session', { currency, siteCode });
        await cartStore.getState().syncCurrencyWithSession(currency, siteCode);
      } catch (error) {
        getLogger().error({ error, currency, siteCode, attempt: i + 1 }, 'Failed to sync cart currency with session');
      }
    }

    try {
      await cartStore.getState().flushPendingCurrencySync();
    } catch (error) {
      getLogger().error({ error, currency, siteCode }, 'Failed to flush pending currency sync intent');
    }
  };

  // Currency sync — reacts immediately to settled session changes.
  const unsubCurrency = sessionStore.subscribe(
    (state) => ({
      currency: state.session?.currency,
      siteCode: state.session?.siteCode,
    }),
    async ({ currency, siteCode }) => {
      if (!currency || !siteCode) return;
      await runCurrencySync(currency, siteCode);
    },
    { equalityFn: shallow },
  );
  unsubscribers.push(unsubCurrency);

  // Site validation — defensive net for non-orchestrated session changes (login/logout,
  // SSR seed propagation). Gated on `isMutationInFlight` so we never race `performSiteSwitch`.
  const unsubSite = sessionStore.subscribe(
    (state) => state.session?.siteCode,
    async (siteCode, prevSiteCode) => {
      if (!siteCode || siteCode === prevSiteCode) return;

      if (sessionStore.getState().isMutationInFlight()) {
        devSyncLog('store-sync: validate cart site suppressed — mutation in flight', { siteCode, prevSiteCode });
        return;
      }

      devSyncLog('store-sync: session site changed — validate cart site (defensive)', { siteCode, prevSiteCode });
      try {
        await cartStore.getState().validateSite(siteCode);
      } catch (error) {
        getLogger().error({ error }, 'Failed to validate cart site');
      }
    },
  );
  unsubscribers.push(unsubSite);

  // Site store reset on session site change; preserves `availableSites` cache.
  const unsubSiteStore = sessionStore.subscribe(
    (state) => state.session?.siteCode,
    (siteCode, prevSiteCode) => {
      if (!siteCode || siteCode === prevSiteCode) return;

      const currentSite = siteStore.getState().getSite();
      if (currentSite && currentSite.code !== siteCode) {
        devSyncLog('store-sync: resetting site store after session site change', {
          siteCode,
          previousStoreSite: currentSite.code,
        });
        customerStore.getState().invalidateLegalEntityCheckoutAddresses();
        siteStore.getState().resetSite();
      }
    },
  );
  unsubscribers.push(unsubSiteStore);

  const unsubLegalEntity = sessionStore.subscribe(
    (state) => {
      const le = state.session?.legalEntityId;
      return typeof le === 'string' ? le.trim() : '';
    },
    async (legalEntityId, previousLegalEntityId) => {
      if (legalEntityId === previousLegalEntityId) {
        return;
      }
      comparisonStore?.getState().clearComparison();
      // Cache invalidation is free (no upstream call); cart re-fetch waits for the mutation
      // lock to release so we don't race a concurrent per-site `fetchCart`.
      customerStore.getState().invalidateLegalEntityCheckoutAddresses();
      if (sessionStore.getState().isMutationInFlight()) {
        devSyncLog('store-sync: validate cart legal entity suppressed — mutation in flight', {
          legalEntityId,
          previousLegalEntityId,
        });
        return;
      }
      try {
        await cartStore.getState().validateLegalEntity(legalEntityId === '' ? undefined : legalEntityId);
      } catch (error) {
        getLogger().error({ error }, 'Failed to validate cart legal entity');
      }
    },
  );
  unsubscribers.push(unsubLegalEntity);

  return unsubscribers;
}
