'use client';

import { useContext } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CartStoreContext, SessionStoreContext, SiteStoreContext } from '@/providers/StoreProvider';

/**
 * Reasons why the cross-store sync pipeline is not yet "ready" — enumerated so UIs can tailor
 * skeletons / tooltips per phase. Checked in the order listed: the first applicable reason wins.
 */
export type SyncNotReadyReason =
  | 'session-mutation'
  | 'session-loading'
  | 'site-loading'
  | 'site-mismatch'
  | 'cart-loading'
  | 'cart-mismatch';

export interface GlobalSyncReady {
  ready: boolean;
  reason?: SyncNotReadyReason;
}

const READY: GlobalSyncReady = Object.freeze({ ready: true });

/**
 * Derives a single readiness state from the session, site, and cart stores. Use this to gate UI
 * surfaces that display or mutate cart / currency / site-dependent data so users do not see
 * stale values during a site switch or authentication transition.
 *
 * Subscribes through selectors so the hook only re-renders when the fields it reads change.
 * `availableSites` is intentionally excluded — we only care about whether the active site, the
 * session, and the cart are aligned.
 */
export function useGlobalSyncReady(): GlobalSyncReady {
  const sessionStoreApi = useContext(SessionStoreContext);
  const siteStoreApi = useContext(SiteStoreContext);
  const cartStoreApi = useContext(CartStoreContext);

  if (!sessionStoreApi || !siteStoreApi || !cartStoreApi) {
    throw new Error('useGlobalSyncReady must be used within StoreProvider');
  }

  const sessionSlice = useStore(
    sessionStoreApi,
    useShallow((s) => ({
      loading: s.loading,
      sessionSiteCode: s.session?.siteCode ?? null,
      mutationInFlight: s.isMutationInFlight(),
    })),
  );

  const siteSlice = useStore(
    siteStoreApi,
    useShallow((s) => ({
      loading: s.loading,
      siteCode: s.site?.code ?? null,
    })),
  );

  const cartSlice = useStore(
    cartStoreApi,
    useShallow((s) => ({
      loading: s.loading,
      cartSite: s.currentCart?.site ?? null,
    })),
  );

  if (sessionSlice.mutationInFlight) return { ready: false, reason: 'session-mutation' };
  if (sessionSlice.loading) return { ready: false, reason: 'session-loading' };
  if (siteSlice.loading) return { ready: false, reason: 'site-loading' };

  if (sessionSlice.sessionSiteCode && siteSlice.siteCode && siteSlice.siteCode !== sessionSlice.sessionSiteCode) {
    return { ready: false, reason: 'site-mismatch' };
  }

  if (cartSlice.loading) return { ready: false, reason: 'cart-loading' };

  if (sessionSlice.sessionSiteCode && cartSlice.cartSite && cartSlice.cartSite !== sessionSlice.sessionSiteCode) {
    return { ready: false, reason: 'cart-mismatch' };
  }

  return READY;
}
