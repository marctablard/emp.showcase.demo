'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { ToastType, notify } from '@/components/ui/toast-notification';

/**
 * Drains a `sessionStorage`-queued currency-fallback event and surfaces it as a toast
 * **after** the route transition has committed.
 *
 * Why this indirection:
 *
 * When a site switch rolls the session currency back to the target site's default
 * (because `/changeCurrency` rejected for at least one cart item), the switcher used to
 * call `notify(...)` immediately after `performSiteSwitch` resolved. At that moment
 * `router.push(targetSitePath)` had already been fired inside the pipeline and a
 * deferred `router.refresh()` was about to run — so the toast was mounted into sonner's
 * portal in the middle of a route transition and flickered in and out as the
 * `[site]/[locale]` subtree re-rendered.
 *
 * Instead, the switcher now writes the fallback payload to `sessionStorage` before the
 * transition, and this small bus — mounted once in the root locale layout — reads it on
 * the next effect cycle after `usePathname()` updates (which happens *after* the router
 * commits the new route). The toast therefore appears on the settled page and lives for
 * its full duration.
 */
export const PENDING_CURRENCY_FALLBACK_KEY = 'emp-pending-currency-fallback';

interface PendingCurrencyFallback {
  from: string;
  to: string;
}

function readPendingFallback(): PendingCurrencyFallback | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(PENDING_CURRENCY_FALLBACK_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PendingCurrencyFallback>;
    if (typeof parsed?.from === 'string' && typeof parsed?.to === 'string' && parsed.from && parsed.to) {
      return { from: parsed.from, to: parsed.to };
    }
    // Corrupt payload — clear it so we don't keep retrying.
    window.sessionStorage.removeItem(PENDING_CURRENCY_FALLBACK_KEY);
    return null;
  } catch {
    try {
      window.sessionStorage.removeItem(PENDING_CURRENCY_FALLBACK_KEY);
    } catch {
      // sessionStorage may be unavailable (private mode / quota) — ignore.
    }
    return null;
  }
}

function clearPendingFallback(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.removeItem(PENDING_CURRENCY_FALLBACK_KEY);
  } catch {
    // sessionStorage may be unavailable (private mode / quota) — ignore.
  }
}

export function CurrencyFallbackToastBus() {
  const t = useTranslations('common.Regions');
  const pathname = usePathname();

  useEffect(() => {
    const pending = readPendingFallback();
    if (!pending) {
      return;
    }
    notify({
      title: t('currencyFallback', { from: pending.from, to: pending.to }),
      type: ToastType.Info,
      duration: 8000,
    });
    clearPendingFallback();
  }, [pathname, t]);

  return null;
}
