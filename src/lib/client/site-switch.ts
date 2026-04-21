'use client';

import type { StoreApi } from 'zustand';
import { fetchCurrentSession, updateSessionLanguage, updateSessionSite } from '@/lib/client/session';
import { type LoggerService, getLogger } from '@/lib/logger/use-logger-client';
import type { CartStore } from '@/stores/cart-store';
import type { SessionStore } from '@/stores/session-store-context';
import type { SiteStore } from '@/stores/site-store';

/**
 * Write the locale cookie from the browser before `router.push` fires, so the next RSC/middleware
 * round-trip sees the aligned locale. Without this, `next-intl`'s cookie-driven locale detection
 * keeps the pre-switch locale (e.g. `de`) and redirects `/us` → `/us/de` even after the switch to
 * a site that does not advertise that locale — which in turn makes the layout redirect away from
 * any deep link the user was navigating to.
 */
function writeLocaleCookie(locale: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  const cookieName = process.env.NEXT_PUBLIC_LOCALE_COOKIE;
  if (!cookieName) {
    return;
  }
  const maxAge = 365 * 24 * 60 * 60;
  document.cookie = `${cookieName}=${encodeURIComponent(locale)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

/**
 * Single awaited client-side pipeline for every site change — whether user-initiated
 * (`SiteSwitcher`) or URL-driven (`SiteSessionAligner`).
 *
 * Ordering guarantees:
 *  1. Acquire the session mutation lock (single writer guarantee).
 *  2. `PUT /api/session/site` (server clears `currentCart` and PATCHes `{ siteCode, currency }`).
 *  3. `GET /api/session` to refetch the authoritative session.
 *  4. `sessionStore.setSession(updated)` — fires downstream subscriptions (caches, LE check).
 *  5. `await` in parallel: `siteStore.resetSite()` (prompts `useSite` to refetch active site)
 *     and `cartStore.validateSite(session.siteCode)` (clears cart + `GET /api/cart`).
 *  6. If currency changed, `await cartStore.syncCurrencyWithSession(...)`.
 *  7. If `source === 'user'`, navigate + schedule `router.refresh()` after a 150 ms
 *     micro-delay so RSC trees have settled.
 *  8. Release the mutation lock (always, via `finally`).
 *
 * The mutation lock is the only concurrency primitive required: it guarantees that a second
 * invocation (double-click, Strict Mode re-mount, deep-link race) cannot observe an
 * intermediate state.
 */
export interface SiteSwitchStores {
  sessionStore: StoreApi<SessionStore>;
  siteStore: StoreApi<SiteStore>;
  cartStore: StoreApi<CartStore>;
}

export interface SiteSwitchRedirectPathArgs {
  href: string;
  locale: string;
  site: string;
  forcePrefix?: boolean;
}

export interface SiteSwitchOptions {
  /**
   * `'user'` = header site switcher click. Orchestrator navigates to the target site URL and
   *            triggers `router.refresh()` so server components reload with the new session.
   * `'deep-link'` = URL-driven divergence detected by `SiteSessionAligner`. The browser is already
   *                 on the target URL so we skip navigation and refresh; the aligner's parent tree
   *                 re-renders naturally once `sessionStore.setSession` fires.
   */
  source: 'user' | 'deep-link';
  /** Current UI locale — only relevant when `source === 'user'` to pick a target-site-compatible locale. */
  locale?: string;
  /** Navigator for user-initiated switches (typically `router.push`). Ignored for deep-link source. */
  navigateTo?: (path: string) => void;
  /** Computes the target-site path. Typically `@/i18n/navigation`'s `getPathname`. */
  getRedirectPath?: (args: SiteSwitchRedirectPathArgs) => string;
  /**
   * Optional lookup used to resolve the target site's allowed locales (used to pick a
   * compatible target locale). Can be omitted for deep-link source.
   */
  getSiteByCode?: (site: string) => Promise<{ languages?: string[] } | null | undefined>;
  /** Next router object with `refresh()`. Only invoked for user-initiated switches. */
  router?: { refresh: () => void };
  logger?: LoggerService;
}

export interface SiteSwitchResult {
  success: boolean;
  reason?: 'locked' | 'unknown-site' | 'error' | 'same-site';
  correlationId?: string;
}

/** Matches the 150 ms delay previously used inline inside `header-site-switcher.tsx`. */
export const NAVIGATION_REFRESH_DELAY_MS = 150;

function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Runs the site-switch pipeline and emits a single structured telemetry event on completion.
 *
 * @returns `{ success: true }` on success (including same-site no-op),
 *          `{ success: false, reason }` on failure. Never throws.
 */
export async function performSiteSwitch(
  targetSite: string,
  stores: SiteSwitchStores,
  opts: SiteSwitchOptions,
): Promise<SiteSwitchResult> {
  const logger = opts.logger ?? getLogger();
  const { sessionStore, siteStore, cartStore } = stores;
  const correlationId = generateCorrelationId();
  const startedAt = Date.now();

  const prevSession = sessionStore.getState().session;
  const prevSiteCode = prevSession?.siteCode;
  const prevCurrency = prevSession?.currency;

  if (!targetSite || targetSite === prevSiteCode) {
    logger.info(
      {
        event: 'site_switch',
        correlationId,
        source: opts.source,
        from: prevSiteCode,
        to: targetSite,
        outcome: 'same-site',
        durationMs: 0,
      },
      'site switch skipped — same site',
    );
    return { success: true, reason: 'same-site', correlationId };
  }

  if (!sessionStore.getState().tryAcquireMutationLock()) {
    logger.info(
      {
        event: 'site_switch',
        correlationId,
        source: opts.source,
        from: prevSiteCode,
        to: targetSite,
        outcome: 'locked',
        durationMs: 0,
      },
      'site switch skipped — session mutation lock held',
    );
    return { success: false, reason: 'locked', correlationId };
  }

  let targetSiteInfo: { languages?: string[] } | null | undefined;
  if (opts.getSiteByCode) {
    try {
      targetSiteInfo = await opts.getSiteByCode(targetSite);
    } catch (err) {
      logger.error({ err, site: targetSite, correlationId }, 'Failed to resolve target site metadata');
    }
    if (!targetSiteInfo) {
      sessionStore.getState().releaseMutationLock();
      logger.info(
        {
          event: 'site_switch',
          correlationId,
          source: opts.source,
          from: prevSiteCode,
          to: targetSite,
          outcome: 'unknown-site',
          durationMs: Date.now() - startedAt,
        },
        'site switch failed — unknown target site',
      );
      return { success: false, reason: 'unknown-site', correlationId };
    }
  }

  sessionStore.getState().setLoading(true);

  try {
    const siteUpdateSuccess = await updateSessionSite(targetSite);
    if (!siteUpdateSuccess) {
      throw new Error('updateSessionSite returned false');
    }

    const updatedSession = await fetchCurrentSession(true);
    if (!updatedSession) {
      throw new Error('fetchCurrentSession returned null');
    }
    sessionStore.getState().setSession(updatedSession);

    // Run site-store reset (drops active site; `useSite` effect refetches) in parallel with the
    // cart validation (clears + GET /api/cart). resetSite is synchronous but exposed here so
    // tests can assert it was called before the parallel await resolves.
    //
    // Skip `resetSite()` when `siteStore.site` already matches the target (typical for
    // SSR-aligned deep-links where the layout seeded the correct site). Clearing it would
    // force `useSite` into a transient `site: undefined` window and flip
    // `useShopContextReady.siteAligned` to false long enough to trip the deadlock guard.
    const currentSiteInStore = siteStore.getState().getSite()?.code;
    const shouldResetSite = currentSiteInStore !== updatedSession.siteCode;
    await Promise.all([
      shouldResetSite ? Promise.resolve(siteStore.getState().resetSite()) : Promise.resolve(),
      cartStore.getState().validateSite(updatedSession.siteCode),
    ]);

    const newCurrency = updatedSession.currency;
    const currencyChanged = Boolean(newCurrency && newCurrency !== prevCurrency);
    if (currencyChanged && newCurrency) {
      try {
        await cartStore.getState().syncCurrencyWithSession(newCurrency, updatedSession.siteCode);
      } catch (err) {
        logger.error(
          { err, currency: newCurrency, siteCode: updatedSession.siteCode, correlationId },
          'syncCurrencyWithSession failed during site switch',
        );
      }
    }

    if (opts.source === 'user' && opts.navigateTo && opts.getRedirectPath) {
      const fallbackLocale = opts.locale ?? updatedSession.language ?? '';
      const targetLanguages = targetSiteInfo?.languages;
      const targetLocale =
        targetLanguages && targetLanguages.length > 0
          ? targetLanguages.includes(fallbackLocale)
            ? fallbackLocale
            : targetLanguages[0]
          : fallbackLocale;

      // When the target site does not advertise the current UI locale (e.g. FW/CHF/de → US which
      // only supports en), we must realign both the server-side session language AND the
      // client-cookie that next-intl reads. Otherwise the next navigation (header search, product
      // tile click, etc.) re-introduces `/de` into URLs on the new site and the layout bounces the
      // user back to `/` to correct the locale, discarding deep links.
      const localeChanged = Boolean(targetLocale) && targetLocale !== opts.locale;
      if (localeChanged) {
        writeLocaleCookie(targetLocale);
        try {
          await updateSessionLanguage(targetLocale);
        } catch (err) {
          logger.error(
            { err, locale: targetLocale, site: targetSite, correlationId },
            'updateSessionLanguage failed during site switch (locale realignment)',
          );
        }
      }

      const targetPath = opts.getRedirectPath({
        href: '/',
        locale: targetLocale,
        site: targetSite,
        forcePrefix: true,
      });
      opts.navigateTo(targetPath);
      if (opts.router) {
        const router = opts.router;
        setTimeout(() => {
          router.refresh();
        }, NAVIGATION_REFRESH_DELAY_MS);
      }
    }

    logger.info(
      {
        event: 'site_switch',
        correlationId,
        source: opts.source,
        from: prevSiteCode,
        to: targetSite,
        currencyChanged,
        outcome: 'success',
        durationMs: Date.now() - startedAt,
      },
      'site switch pipeline complete',
    );
    return { success: true, correlationId };
  } catch (err) {
    logger.error(
      {
        event: 'site_switch',
        correlationId,
        source: opts.source,
        from: prevSiteCode,
        to: targetSite,
        outcome: 'error',
        durationMs: Date.now() - startedAt,
        err: err instanceof Error ? err.message : String(err),
      },
      'site switch pipeline failed',
    );
    return { success: false, reason: 'error', correlationId };
  } finally {
    sessionStore.getState().setLoading(false);
    sessionStore.getState().releaseMutationLock();
  }
}
