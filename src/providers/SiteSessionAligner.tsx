'use client';

import { useContext, useEffect } from 'react';
import { fetchCurrentSession, updateSessionSite } from '@/lib/client/session';
import { getLogger } from '@/lib/logger/use-logger-client';
import { SiteContext } from '@/providers/SiteProvider';
import { useSessionStore } from '@/providers/StoreProvider';

/**
 * Bridges URL-driven site changes to the Emporix session + Zustand session store.
 *
 * When a user navigates to a different site via direct URL (external link, bookmark,
 * typed URL) the middleware updates the site cookie and the layout provides the new
 * site code through SiteContext. However, the server-side Emporix session and the
 * client-side session store are NOT automatically updated — the store synchronizer
 * only reacts to session.siteCode changes in the client store.
 *
 * This component closes that gap: it detects when the URL site diverges from the
 * session site and calls the session site API so the full sync pipeline fires
 * (currency, cart, site store reset, etc.).
 *
 * Uses the session store's shared mutation lock to prevent concurrent API calls.
 * The async work intentionally runs to completion even after unmount — updating a
 * Zustand store from a detached async closure is safe (external state, not
 * component state), and aborting would leave the session permanently misaligned
 * when React Strict Mode cancels the first mount's effect.
 */
export function SiteSessionAligner() {
  const urlSiteCode = useContext(SiteContext);
  const { session, setSession, loading, tryAcquireMutationLock, releaseMutationLock } = useSessionStore();

  useEffect(() => {
    if (!urlSiteCode || !session?.siteCode || loading) {
      return;
    }

    if (session.siteCode === urlSiteCode) {
      return;
    }

    if (!tryAcquireMutationLock()) {
      return;
    }

    const targetSite = urlSiteCode;

    (async () => {
      const logger = getLogger();
      try {
        const success = await updateSessionSite(targetSite);

        if (!success) {
          logger.warn({ targetSite, sessionSiteCode: session.siteCode }, 'Site session alignment: update failed');
          return;
        }

        const updatedSession = await fetchCurrentSession(true);
        setSession(updatedSession);
      } catch (error) {
        logger.error({ err: error, targetSite, sessionSiteCode: session.siteCode }, 'Site session alignment failed');
      } finally {
        releaseMutationLock();
      }
    })();

    // No cleanup — the async work must run to completion so the store is updated.
    // Aborting here (e.g. on Strict Mode remount) would skip setSession and leave
    // the session permanently misaligned.
  }, [urlSiteCode, session?.siteCode, loading, session, setSession, tryAcquireMutationLock, releaseMutationLock]);

  return null;
}
