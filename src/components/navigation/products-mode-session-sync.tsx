'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useProductsMode } from '@/components/navigation/products-mode-context';
import { useLogger } from '@/hooks/common/useLogger';

/**
 * Refreshes the server components when the NextAuth session state disagrees with the
 * server-seeded products mode (COP-4822).
 *
 * The nav-shell layout resolves the products mode and the navigation trees on the server and
 * seeds them into `ProductsModeProvider`. A login through the intercepted `/login` dialog (and a
 * session that expires while browsing) only updates the client session — the layout's RSC
 * payload is never refetched, so header, footer and PLP would keep showing "All Products" and
 * the public category tree until a hard reload. This bridge calls `router.refresh()` once per
 * `pathname` + session `status` whenever the two disagree, so the server re-resolves the mode.
 *
 * Renders nothing. Must be mounted inside `SessionProvider` (root `[site]/[locale]/layout.tsx`)
 * and inside `ProductsModeProvider`.
 */
export function ProductsModeSessionSync() {
  const { status } = useSession();
  const { mode } = useProductsMode();
  const router = useRouter();
  const pathname = usePathname();
  const logger = useLogger();
  const refreshedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    const loggedInButAnonymous = status === 'authenticated' && mode === 'anonymous';
    const loggedOutButPersonalised = status === 'unauthenticated' && mode !== 'anonymous';

    if (!loggedInButAnonymous && !loggedOutButPersonalised) {
      return;
    }

    const refreshKey = `${pathname}|${status}`;
    if (refreshedForRef.current === refreshKey) {
      return;
    }

    refreshedForRef.current = refreshKey;
    logger.debug(
      { status, mode, pathname },
      'Products mode out of sync with the auth session; refreshing server components',
    );
    router.refresh();
  }, [status, mode, pathname, router, logger]);

  return null;
}

export default ProductsModeSessionSync;
