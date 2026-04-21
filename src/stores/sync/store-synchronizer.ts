// src/stores/sync/store-synchronizer.ts
import { shallow } from 'zustand/shallow';
import { devSyncLog } from '@/lib/client/dev-sync-log';
import { invalidateShippingMethodsResponseCache } from '@/lib/client/shipping-methods-response-cache';
import { getLogger } from '@/lib/logger/use-logger-client';
import type {
  AvailabilityStoreApi,
  CartStoreApi,
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
}

const CURRENCY_SYNC_RETRY_DELAYS_MS = [0, 250, 750];

/**
 * Sets up defensive/reactive cross-store subscriptions. **All session mutations now flow
 * through `performSiteSwitch` in `@/lib/client/site-switch`** — this module no longer PUTs
 * `/api/session/site` or runs any poll-based site/session alignment. Each subscription here
 * is a pure cache-invalidation or derived-store update reacting to an already-settled
 * session change.
 *
 * Subscriptions:
 * 1. Session currency changes → Cart currency update (with short retry matrix for
 *    transient flushes while cart is still refetching).
 * 2. Session site changes → Cart site validation (defensive net — the orchestrator has
 *    already awaited this; this fires only for non-orchestrated session mutations such as
 *    login/logout where the session changes independently).
 * 3. Session site changes → Site store reset (`resetSite` keeps `availableSites` cache).
 * 4. Session legalEntityId changes → Cart re-fetch + checkout-addresses invalidation.
 * 5. Session site/currency/legal entity → Invalidate shipping-methods response cache.
 * 6. Session site/currency changes → Clear product and availability client caches.
 *
 * Returns an array of unsubscribe functions for the caller to invoke on unmount.
 */
export function setupStoreSynchronization({
  sessionStore,
  cartStore,
  siteStore,
  customerStore,
  productStore,
  availabilityStore,
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

  // Product store is keyed only by product id; clear it when shop session context changes so PDP/search
  // cannot show another site's currency until a fresh fetch completes.
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

  // Subscription 1: Currency synchronization — reacts immediately (no poll gate).
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

  // Subscription 2: Site validation — defensive net for non-orchestrated session changes
  // (login/logout, SSR seed propagation). Orchestrator-initiated switches already awaited
  // validateSite, so the cart state is aligned by the time this fires; calling it again is
  // idempotent (lastSiteCode equals newSiteCode → early return inside validateSite).
  const unsubSite = sessionStore.subscribe(
    (state) => state.session?.siteCode,
    async (siteCode, prevSiteCode) => {
      if (!siteCode || siteCode === prevSiteCode) return;

      devSyncLog('store-sync: session site changed — validate cart site (defensive)', { siteCode, prevSiteCode });
      try {
        await cartStore.getState().validateSite(siteCode);
      } catch (error) {
        getLogger().error({ error }, 'Failed to validate cart site');
      }
    },
  );
  unsubscribers.push(unsubSite);

  // Subscription 3: Site store reset on session site change — keeps `availableSites` cached.
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
      customerStore.getState().invalidateLegalEntityCheckoutAddresses();
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
