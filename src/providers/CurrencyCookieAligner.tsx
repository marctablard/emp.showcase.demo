'use client';

import { useEffect, useRef } from 'react';
import { useSession } from '@/hooks/session/useSession';
import { fetchCurrentSession } from '@/lib/client/session';
import { CURRENCY_COOKIE_NAME } from '@/lib/common/cookie-names';
import { normalizeCurrencyCode } from '@/lib/common/currency-cookie';
import { getLogger } from '@/lib/logger/use-logger-client';

function readCurrencyCookie(): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const parts = document.cookie ? document.cookie.split(';') : [];
  for (const part of parts) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    if (name !== CURRENCY_COOKIE_NAME) {
      continue;
    }
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}

/**
 * `next-currency` is readable and outlives logout. A healthy SSR session does not
 * call `GET /api/session`, so a stale cookie would be copied onto the next anonymous
 * token. When the cookie is missing or disagrees, that GET rewrites it to the live
 * session currency and leaves the session itself unchanged.
 */
export function CurrencyCookieAligner() {
  const { session, loading } = useSession();
  const attemptedCurrency = useRef<string | undefined>(undefined);
  const sessionCurrency = session?.currency;

  useEffect(() => {
    if (loading || !sessionCurrency) {
      return;
    }
    const cookie = normalizeCurrencyCode(readCurrencyCookie());
    const live = normalizeCurrencyCode(sessionCurrency);
    if (!live || cookie === live || attemptedCurrency.current === live) {
      return;
    }
    attemptedCurrency.current = live;
    // `fetchCurrentSession()` swallows failures unless asked to throw, which would
    // leave the guard set and skip the next currency change.
    void fetchCurrentSession(true).catch((err) => {
      if (attemptedCurrency.current === live) {
        attemptedCurrency.current = undefined;
      }
      getLogger().warn({ err }, 'Failed to realign next-currency with the session');
    });
  }, [loading, sessionCurrency]);

  return null;
}
