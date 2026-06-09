'use client';

import type { StoreApi } from 'zustand';
import { devSyncLog } from '@/lib/client/dev-sync-log';
import { updateSessionContext } from '@/lib/client/session';
import { type LoggerService, getLogger } from '@/lib/logger/use-logger-client';
import type { CartStore } from '@/stores/cart-store';
import type { SessionStore } from '@/stores/session-store-context';
import type { SiteStore } from '@/stores/site-store';

const SETTLING_REASON_SITE_SWITCH = 'site-switch';

/** Sync the locale cookie so next-intl picks up the aligned locale on the next request. */
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
 * Single awaited pipeline for every site change (user / deep-link). Happy path:
 * one `PATCH /api/session` + one `GET /api/cart` (+ optional cart-currency reconcile when
 * a shared currency leaves a stale per-site cart). Runs under the session mutation lock
 * and a `beginSettling` window so consumers render one spinner across the whole flow.
 * Guards: same-site / unknown-site / locked.
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

/** Target site metadata. Accepts strings or `{ id | code }` objects; lists are normalized to ids. */
interface TargetSiteMetadata {
  languages?: Array<string | { id?: string; code?: string }> | undefined;
  currencies?: Array<string | { id?: string; code?: string }> | undefined;
  defaultCurrency?: string | { id?: string } | undefined;
  defaultLanguage?: string | undefined;
}

export interface SiteSwitchOptions {
  /** `'user'` = switcher click (navigates + refreshes). `'deep-link'` = URL-driven alignment (no nav). */
  source: 'user' | 'deep-link';
  /** Current UI locale — used for user source to pick a compatible target-site locale. */
  locale?: string;
  /** Navigator for user-initiated switches (typically `router.push`). */
  navigateTo?: (path: string) => void;
  /** Computes the target-site path (typically `@/i18n/navigation`'s `getPathname`). */
  getRedirectPath?: (args: SiteSwitchRedirectPathArgs) => string;
  /** Resolves target-site metadata. Required for user source; optional for deep-link. */
  getSiteByCode?: (site: string) => Promise<TargetSiteMetadata | null | undefined>;
  /** Next router used only for user-initiated switches. */
  router?: { refresh: () => void };
  logger?: LoggerService;
}

export interface SiteSwitchResult {
  success: boolean;
  reason?: 'locked' | 'unknown-site' | 'error' | 'same-site';
  correlationId?: string;
  /** Count of BFF responses the orchestrator is responsible for (telemetry). */
  upstreamCalls?: number;
  /**
   * Set when the orchestrator rolled the session currency back to the target site's default
   * because the preferred currency could not be applied to the per-site cart (Emporix's
   * `/changeCurrency` is transactional and will fail the whole cart if any item lacks a
   * price list in the target currency). Callers can surface this to the user (toast).
   */
  currencyFallback?: {
    from: string;
    to: string;
  };
}

export const NAVIGATION_REFRESH_DELAY_MS = 150;

function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeList(items: Array<string | { id?: string; code?: string }> | undefined): string[] {
  if (!items) {
    return [];
  }
  const out: string[] = [];
  for (const item of items) {
    if (typeof item === 'string') {
      if (item.length > 0) out.push(item);
    } else if (item && typeof item === 'object') {
      const value = item.id ?? item.code;
      if (typeof value === 'string' && value.length > 0) {
        out.push(value);
      }
    }
  }
  return out;
}

function resolveDefaultCurrency(meta: TargetSiteMetadata | null | undefined): string | undefined {
  const defaultCurrency = meta?.defaultCurrency;
  if (typeof defaultCurrency === 'string') {
    return defaultCurrency || undefined;
  }
  if (defaultCurrency && typeof defaultCurrency === 'object') {
    return defaultCurrency.id;
  }
  return undefined;
}

/** Runs the site-switch pipeline and emits a single telemetry event. Never throws. */
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
  const prevLanguage = prevSession?.language;
  const prevVersion = prevSession?.metadata?.version;

  if (!targetSite || targetSite === prevSiteCode) {
    logger.info(
      {
        event: 'site_switch',
        correlationId,
        source: opts.source,
        from: prevSiteCode,
        to: targetSite,
        outcome: 'same-site',
        upstreamCalls: 0,
        durationMs: 0,
      },
      'site switch skipped — same site',
    );
    return { success: true, reason: 'same-site', correlationId, upstreamCalls: 0 };
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
        upstreamCalls: 0,
        durationMs: 0,
      },
      'site switch skipped — session mutation lock held',
    );
    return { success: false, reason: 'locked', correlationId, upstreamCalls: 0 };
  }

  cartStore.getState().beginSettling(SETTLING_REASON_SITE_SWITCH);

  let upstreamCalls = 0;

  try {
    let targetSiteInfo: TargetSiteMetadata | null | undefined;
    if (opts.getSiteByCode) {
      try {
        // Cache-first lookup; not counted toward the upstream budget.
        targetSiteInfo = await opts.getSiteByCode(targetSite);
      } catch (err) {
        logger.error({ err, site: targetSite, correlationId }, 'Failed to resolve target site metadata');
      }
      // User source requires known metadata; deep-link tolerates a cold cache.
      if (!targetSiteInfo && opts.source === 'user') {
        logger.info(
          {
            event: 'site_switch',
            correlationId,
            source: opts.source,
            from: prevSiteCode,
            to: targetSite,
            outcome: 'unknown-site',
            upstreamCalls,
            durationMs: Date.now() - startedAt,
          },
          'site switch failed — unknown target site',
        );
        return { success: false, reason: 'unknown-site', correlationId, upstreamCalls };
      }
    }

    sessionStore.getState().setLoading(true);
    // Preserve current currency/language when supported; fall back to site defaults otherwise.
    const targetLanguages = normalizeList(targetSiteInfo?.languages);
    const targetCurrencies = normalizeList(targetSiteInfo?.currencies);
    const targetDefaultCurrency = resolveDefaultCurrency(targetSiteInfo);
    if (targetDefaultCurrency && !targetCurrencies.includes(targetDefaultCurrency)) {
      targetCurrencies.push(targetDefaultCurrency);
    }

    const nextCurrency =
      prevCurrency && targetCurrencies.length > 0
        ? targetCurrencies.includes(prevCurrency)
          ? prevCurrency
          : targetDefaultCurrency
        : prevCurrency;

    const nextLanguage =
      prevLanguage && targetLanguages.length > 0
        ? targetLanguages.includes(prevLanguage)
          ? prevLanguage
          : targetSiteInfo?.defaultLanguage && targetLanguages.includes(targetSiteInfo.defaultLanguage)
            ? targetSiteInfo.defaultLanguage
            : targetLanguages[0]
        : prevLanguage;

    const sessionFields: { siteCode?: string; currency?: string; language?: string } = {
      siteCode: targetSite,
    };
    if (nextCurrency && nextCurrency !== prevCurrency) {
      sessionFields.currency = nextCurrency;
    }
    if (nextLanguage && nextLanguage !== prevLanguage) {
      sessionFields.language = nextLanguage;
    }

    const updatedSession = await updateSessionContext(sessionFields, prevVersion);
    if (!updatedSession) {
      throw new Error('updateSessionContext returned null');
    }
    upstreamCalls += 1;
    sessionStore.getState().setSession(updatedSession);

    // Reset the site store if it still holds the previous site (SSR-seeded deep links).
    const currentSiteInStore = siteStore.getState().getSite()?.code;
    if (currentSiteInStore !== updatedSession.siteCode) {
      siteStore.getState().resetSite();
    }

    // Delegate per-site cart reset + refetch to `validateSite` so any in-flight `fetchCart`
    // from the previous site (closure-level `_fetchPromise` dedupe) is invalidated before
    // the target site's cart is loaded. Matches the pattern used by every other caller that
    // must discard an in-flight cart read (validateCart, validateLegalEntity, addToCart
    // mismatch branch, clearCart).
    try {
      await cartStore.getState().validateSite(updatedSession.siteCode);
      upstreamCalls += 1;
    } catch (err) {
      logger.error(
        { err, siteCode: updatedSession.siteCode, correlationId },
        'fetchCart failed during site switch — leaving cart unresolved',
      );
    }

    // Reconcile cart currency inside the settling window — the synchronizer subscriber is
    // suppressed under the mutation lock and cannot fire here. No-op when already aligned.
    const resolvedCart = cartStore.getState().currentCart;
    const resolvedCartCurrency = resolvedCart?.currency ?? resolvedCart?.totalPrice?.currency;
    const sessionCurrency = updatedSession.currency;
    let activeSession = updatedSession;
    let currencyFallback: { from: string; to: string } | undefined;
    if (
      resolvedCart &&
      resolvedCart.site === updatedSession.siteCode &&
      sessionCurrency &&
      resolvedCartCurrency &&
      resolvedCartCurrency !== sessionCurrency
    ) {
      let repriceFailed = false;
      try {
        await cartStore.getState().syncCurrencyWithSession(sessionCurrency, updatedSession.siteCode);
        upstreamCalls += 2;
      } catch (err) {
        repriceFailed = true;
        logger.error(
          {
            err,
            siteCode: updatedSession.siteCode,
            fromCurrency: resolvedCartCurrency,
            toCurrency: sessionCurrency,
            correlationId,
          },
          'syncCurrencyWithSession failed during site switch — cart currency may remain stale',
        );
      }

      // Emporix's /changeCurrency is transactional: on failure the cart store's updateCurrency
      // swallows the error (stores state.error, no rethrow), so the promise resolves even
      // though the cart was not repriced. Detect that by re-reading the post-call cart
      // currency and treat a non-convergence the same as a thrown failure.
      if (!repriceFailed) {
        const postCart = cartStore.getState().currentCart;
        const postCartCurrency = postCart?.currency ?? postCart?.totalPrice?.currency;
        if (postCart && postCart.site === updatedSession.siteCode && postCartCurrency !== sessionCurrency) {
          repriceFailed = true;
          logger.warn(
            {
              siteCode: updatedSession.siteCode,
              fromCurrency: postCartCurrency,
              toCurrency: sessionCurrency,
              correlationId,
            },
            'syncCurrencyWithSession resolved but cart currency did not converge — reprice rejected upstream',
          );
        }
      }

      if (repriceFailed) {
        // Fallback: the preferred currency was carried over from the previous site but the
        // per-site cart cannot honour it (at least one line item has no price list in that
        // currency). Roll the session currency back to the target site's defaultCurrency so
        // header/cart totals and line items realign, without clearing the cart.
        if (targetDefaultCurrency && targetDefaultCurrency !== sessionCurrency) {
          try {
            const rolledBack = await updateSessionContext(
              { currency: targetDefaultCurrency },
              updatedSession.metadata?.version,
            );
            if (rolledBack) {
              upstreamCalls += 1;
              sessionStore.getState().setSession(rolledBack);
              activeSession = rolledBack;
              // Clear the residual cart-store error set by updateCurrency's internal catch —
              // the failure is now recovered from the orchestrator's POV.
              cartStore.getState().setError(null);
              currencyFallback = { from: sessionCurrency, to: targetDefaultCurrency };
              logger.info(
                {
                  siteCode: updatedSession.siteCode,
                  fromCurrency: sessionCurrency,
                  toCurrency: targetDefaultCurrency,
                  correlationId,
                },
                'Rolled back session currency to target site default after reprice failure',
              );
            } else {
              logger.error(
                { siteCode: updatedSession.siteCode, toCurrency: targetDefaultCurrency, correlationId },
                'Session currency rollback returned null — session/cart currency may remain mismatched',
              );
            }
          } catch (rollbackErr) {
            logger.error(
              {
                err: rollbackErr,
                siteCode: updatedSession.siteCode,
                toCurrency: targetDefaultCurrency,
                correlationId,
              },
              'Session currency rollback failed — session/cart currency may remain mismatched',
            );
          }
        } else {
          logger.warn(
            {
              siteCode: updatedSession.siteCode,
              attemptedCurrency: sessionCurrency,
              targetDefaultCurrency,
              correlationId,
            },
            'Cannot roll back session currency — no usable defaultCurrency for target site',
          );
        }
      }
    }

    const currencyChanged = Boolean(activeSession.currency && activeSession.currency !== prevCurrency);
    const languageChanged = Boolean(activeSession.language && activeSession.language !== prevLanguage);

    devSyncLog('site-switch: post-switch snapshot', {
      correlationId,
      siteCode: activeSession.siteCode,
      sessionCurrency: activeSession.currency,
      prevCurrency,
      cartId: cartStore.getState().currentCart?.id ?? null,
      cartSite: cartStore.getState().currentCart?.site ?? null,
      cartCurrency:
        cartStore.getState().currentCart?.currency ?? cartStore.getState().currentCart?.totalPrice?.currency ?? null,
      currencyChanged,
      languageChanged,
      currencyFallback,
      upstreamCalls,
    });

    // Navigation + locale cookie sync (user source only).
    if (opts.source === 'user' && opts.navigateTo && opts.getRedirectPath) {
      const fallbackLocale = opts.locale ?? activeSession.language ?? '';
      const resolvedTargetLocale =
        targetLanguages.length > 0
          ? targetLanguages.includes(fallbackLocale)
            ? fallbackLocale
            : targetLanguages[0]
          : fallbackLocale;

      const localeChanged = Boolean(resolvedTargetLocale) && resolvedTargetLocale !== opts.locale;
      if (localeChanged) {
        writeLocaleCookie(resolvedTargetLocale);
      }

      const targetPath = opts.getRedirectPath({
        href: '/',
        locale: resolvedTargetLocale,
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
        languageChanged,
        currencyFallback,
        outcome: 'success',
        upstreamCalls,
        durationMs: Date.now() - startedAt,
      },
      'site switch pipeline complete',
    );
    return { success: true, correlationId, upstreamCalls, currencyFallback };
  } catch (err) {
    logger.error(
      {
        event: 'site_switch',
        correlationId,
        source: opts.source,
        from: prevSiteCode,
        to: targetSite,
        outcome: 'error',
        upstreamCalls,
        durationMs: Date.now() - startedAt,
        err: err instanceof Error ? err.message : String(err),
      },
      'site switch pipeline failed',
    );
    return { success: false, reason: 'error', correlationId, upstreamCalls };
  } finally {
    sessionStore.getState().setLoading(false);
    sessionStore.getState().releaseMutationLock();
    cartStore.getState().endSettling(SETTLING_REASON_SITE_SWITCH);
  }
}
