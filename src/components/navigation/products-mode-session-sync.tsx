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
 * `pathname` + session `status` + customer id whenever the auth session disagrees with the
 * server-seeded mode or customer, so the server re-resolves the mode.
 *
 * Renders nothing. Must be mounted inside `SessionProvider` (root `[site]/[locale]/layout.tsx`)
 * and inside `ProductsModeProvider`.
 */
function sessionCustomerId(session: { user?: { id?: string | null } } | null | undefined): string | undefined {
  const id = session?.user?.id?.trim();
  return id || undefined;
}

export function ProductsModeSessionSync() {
  const { status, data: session } = useSession();
  const { mode, customerId: seededCustomerId } = useProductsMode();
  const router = useRouter();
  const pathname = usePathname();
  const logger = useLogger();
  const refreshedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    const authCustomerId = sessionCustomerId(session);
    const loggedInButAnonymous = status === 'authenticated' && mode === 'anonymous';
    const loggedOutButPersonalised = status === 'unauthenticated' && mode !== 'anonymous';
    const customerMismatch =
      status === 'authenticated' && authCustomerId !== undefined && seededCustomerId !== authCustomerId;

    if (!loggedInButAnonymous && !loggedOutButPersonalised && !customerMismatch) {
      return;
    }

    const refreshKey = `${pathname}|${status}|${authCustomerId ?? ''}|${seededCustomerId ?? ''}`;
    if (refreshedForRef.current === refreshKey) {
      return;
    }

    refreshedForRef.current = refreshKey;
    logger.debug(
      { status, mode, pathname, authCustomerId, seededCustomerId },
      'Products mode out of sync with the auth session; refreshing server components',
    );
    router.refresh();
  }, [status, session, mode, seededCustomerId, pathname, router, logger]);

  return null;
}

export default ProductsModeSessionSync;
