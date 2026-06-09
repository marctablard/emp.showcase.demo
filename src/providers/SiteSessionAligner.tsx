'use client';

import { useContext, useEffect, useRef } from 'react';
import { shallow } from 'zustand/shallow';
import { performSiteSwitch } from '@/lib/client/site-switch';
import { getLogger } from '@/lib/logger/use-logger-client';
import { SiteContext } from '@/providers/SiteProvider';
import { CartStoreContext, SessionStoreContext, SiteStoreContext } from '@/providers/StoreProvider';

/**
 * Aligns Emporix session + session store with a URL-driven site change (deep links).
 *
 * Subscribes to the session store so the check re-runs once the session finishes loading —
 * common cold-start case: SSR cannot fetch Emporix session (no `session-id` cookie yet) →
 * store seeds `null`/`undefined` → client `/api/session` resolves to a different site than
 * the URL. A plain `useEffect` with only store-reference deps would run once with `session=null`
 * and bail out forever, leaving `useGlobalSyncReady` wedged on `site-mismatch` and disabling
 * the switchers. The `pipelineInFlightRef` guard + session mutation lock ensure at most one
 * orchestrator pipeline runs at a time.
 */
export function SiteSessionAligner() {
  const urlSiteCode = useContext(SiteContext);
  const sessionStore = useContext(SessionStoreContext);
  const siteStore = useContext(SiteStoreContext);
  const cartStore = useContext(CartStoreContext);
  const pipelineInFlightRef = useRef(false);

  useEffect(() => {
    if (!urlSiteCode || !sessionStore || !siteStore || !cartStore) {
      return;
    }

    const getSiteByCode = async (code: string) => {
      const availableSites = siteStore.getState().getAvailableSites?.();
      if (!availableSites) {
        return undefined;
      }
      return availableSites.find((s) => s.code === code);
    };

    const runAlignmentIfNeeded = async () => {
      if (pipelineInFlightRef.current) {
        return;
      }
      const { session, loading, isMutationInFlight } = sessionStore.getState();
      if (!session?.siteCode || loading || isMutationInFlight() || session.siteCode === urlSiteCode) {
        return;
      }

      pipelineInFlightRef.current = true;
      try {
        await performSiteSwitch(
          urlSiteCode,
          { sessionStore, siteStore, cartStore },
          { source: 'deep-link', getSiteByCode, logger: getLogger() },
        );
      } finally {
        pipelineInFlightRef.current = false;
      }
    };

    void runAlignmentIfNeeded();

    // Re-evaluate on relevant session slice changes — picks up the client `/api/session`
    // resolution when SSR seeded a `null`/`undefined` session.
    const unsubscribe = sessionStore.subscribe(
      (state) => ({
        siteCode: state.session?.siteCode ?? null,
        loading: state.loading,
      }),
      () => {
        void runAlignmentIfNeeded();
      },
      { equalityFn: shallow },
    );
    return unsubscribe;
  }, [urlSiteCode, sessionStore, siteStore, cartStore]);

  return null;
}
