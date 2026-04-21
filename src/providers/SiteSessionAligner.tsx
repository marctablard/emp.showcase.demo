'use client';

import { useContext, useEffect } from 'react';
import { performSiteSwitch } from '@/lib/client/site-switch';
import { getLogger } from '@/lib/logger/use-logger-client';
import { SiteContext } from '@/providers/SiteProvider';
import { CartStoreContext, SessionStoreContext, SiteStoreContext } from '@/providers/StoreProvider';

/**
 * Bridges URL-driven site changes to the Emporix session + Zustand session store.
 *
 * When a user navigates to a different site via direct URL (external link, bookmark,
 * typed URL) the middleware updates the site cookie and the layout provides the new
 * site code through SiteContext. However, the server-side Emporix session and the
 * client-side session store are NOT automatically updated on mount.
 *
 * This component closes that gap by delegating to `performSiteSwitch` with
 * `source: 'deep-link'`, so the same single awaited pipeline runs regardless of
 * whether the user clicked the header switcher or deep-linked to a different site.
 * The orchestrator's session mutation lock prevents concurrent runs (double-mount
 * under Strict Mode, race with the header switcher).
 */
export function SiteSessionAligner() {
  const urlSiteCode = useContext(SiteContext);
  const sessionStore = useContext(SessionStoreContext);
  const siteStore = useContext(SiteStoreContext);
  const cartStore = useContext(CartStoreContext);

  useEffect(() => {
    if (!urlSiteCode || !sessionStore || !siteStore || !cartStore) {
      return;
    }

    const { session, loading } = sessionStore.getState();
    if (!session?.siteCode || loading || session.siteCode === urlSiteCode) {
      return;
    }

    void performSiteSwitch(
      urlSiteCode,
      { sessionStore, siteStore, cartStore },
      { source: 'deep-link', logger: getLogger() },
    );

    // No cleanup — the async pipeline runs to completion under the session mutation lock,
    // so a Strict Mode re-mount cannot fire a second orchestrator run.
  }, [urlSiteCode, sessionStore, siteStore, cartStore]);

  return null;
}
