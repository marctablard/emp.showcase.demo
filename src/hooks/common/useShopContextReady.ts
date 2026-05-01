'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@/hooks/session/useSession';
import { useSite } from '@/hooks/site/useSite';
import { getLogger } from '@/lib/logger/use-logger-client';
import { useCartStore } from '@/providers/StoreProvider';

interface ShopContextReadyOptions {
  requireCart?: boolean;
}

interface ShopContextReadyResult {
  ready: boolean;
  sessionReady: boolean;
  siteAligned: boolean;
  cartSettled: boolean;
}

const READY_TIMEOUT_MS = 10_000;

export function useShopContextReady(opts?: ShopContextReadyOptions): ShopContextReadyResult {
  const { session, loading: sessionLoading } = useSession();
  const { site } = useSite();
  const cartLoading = useCartStore().loading;
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const derived = useMemo(() => {
    const sessionReady =
      !sessionLoading && session !== null && session !== undefined && !!session.siteCode && !!session.currency;

    const siteAligned = sessionReady && !!site && site.code === session!.siteCode;

    const cartSettled = !opts?.requireCart || !cartLoading;

    return {
      natural: sessionReady && siteAligned && cartSettled,
      sessionReady,
      siteAligned,
      cartSettled,
    };
  }, [sessionLoading, session, site, cartLoading, opts?.requireCart]);

  // Reset timedOut when the context naturally resolves
  if (derived.natural && timedOut) {
    setTimedOut(false);
  }

  useEffect(() => {
    if (derived.natural) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        getLogger().warn(
          {
            sessionReady: derived.sessionReady,
            siteAligned: derived.siteAligned,
            cartSettled: derived.cartSettled,
          },
          'useShopContextReady: forcing ready after timeout — possible state deadlock',
        );
        setTimedOut(true);
      }, READY_TIMEOUT_MS);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [derived.natural, derived.sessionReady, derived.siteAligned, derived.cartSettled]);

  return {
    ready: derived.natural || timedOut,
    sessionReady: derived.sessionReady,
    siteAligned: derived.siteAligned,
    cartSettled: derived.cartSettled,
  };
}
