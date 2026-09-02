'use client';

import type { StoreApi } from 'zustand';
import { devSyncLog } from '@/lib/client/dev-sync-log';
import { updateSessionContext } from '@/lib/client/session';
import { writeLocaleCookie } from '@/lib/common/locale-cookie';
import { resolveCountryForSite } from '@/lib/common/site-country';
import { type LoggerService, getLogger } from '@/lib/logger/use-logger-client';
import type { Session } from '@/platform/services/model/session/session';
import type { CartStore } from '@/stores/cart-store';
import type { SessionStore } from '@/stores/session-store-context';
import type { SiteStore } from '@/stores/site-store';

const SETTLING_REASON_SITE_SWITCH = 'site-switch';

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

/** Target site metadata. Accepts strings or `{ id | code }` objects; lists are normalized to ids. */
interface TargetSiteMetadata {
  languages?: Array<string | { id?: string; code?: string }> | undefined;
  currencies?: Array<string | { id?: string; code?: string }> | undefined;
  defaultCurrency?: string | { id?: string } | undefined;
  defaultLanguage?: string | undefined;
  defaultCountry?: string;
  countries?: Array<string | { code?: string }>;
  shipToCountries?: Array<string | { code?: string }>;
}

export interface SiteSwitchOptions {
  /** `'user'` = switcher click (navigates + refreshes). `'deep-link'` = URL-driven alignment (no nav). */
  source: 'user' | 'deep-link';
  /** Current UI locale — used for user source to pick a compatible target-site locale. */
  locale?: string;
  /** Navigator for user-initiated switches. Receives logical `'/'` plus `{ locale, site }`. */
  navigateTo?: (href: string, options: { locale: string; site: string }) => void;
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

let switchFallbackCounter = 0;

function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(2);
    crypto.getRandomValues(arr);
    return `sw-${Date.now().toString(36)}-${arr[0].toString(36)}${arr[1].toString(36)}`;
  }
  switchFallbackCounter++;
  return `sw-${Date.now().toString(36)}-${switchFallbackCounter.toString(36)}`;
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

function resolveNextCurrency(
  prevCurrency: string | undefined,
  targetCurrencies: string[],
  targetDefaultCurrency: string | undefined,
): string | undefined {
  if (!prevCurrency || targetCurrencies.length === 0) {
    return prevCurrency;
  }
  if (targetCurrencies.includes(prevCurrency)) {
    return prevCurrency;
  }
  return targetDefaultCurrency;
}

function resolveNextLanguage(
  prevLanguage: string | undefined,
  targetLanguages: string[],
  siteDefaultLanguage: string | undefined,
): string | undefined {
  if (!prevLanguage || targetLanguages.length === 0) {
    return prevLanguage;
  }
  if (targetLanguages.includes(prevLanguage)) {
    return prevLanguage;
  }
  if (siteDefaultLanguage && targetLanguages.includes(siteDefaultLanguage)) {
    return siteDefaultLanguage;
  }
  return targetLanguages[0];
}

function buildSiteSwitchSessionFields(
  targetSite: string,
  nextCurrency: string | undefined,
  nextLanguage: string | undefined,
  nextCountry: string | undefined,
  prevCurrency: string | undefined,
  prevLanguage: string | undefined,
  prevCountry: string | undefined,
): { siteCode: string; currency?: string; language?: string; country?: string } {
  const sessionFields: { siteCode: string; currency?: string; language?: string; country?: string } = {
    siteCode: targetSite,
  };
  if (nextCurrency && nextCurrency !== prevCurrency) {
    sessionFields.currency = nextCurrency;
  }
  if (nextLanguage && nextLanguage !== prevLanguage) {
    sessionFields.language = nextLanguage;
  }
  if (nextCountry && nextCountry.toUpperCase() !== (prevCountry ?? '').trim().toUpperCase()) {
    sessionFields.country = nextCountry;
  }
  return sessionFields;
}

function logSiteSwitchEvent(
  logger: LoggerService,
  payload: Record<string, unknown>,
  message: string,
  level: 'info' | 'error' = 'info',
): void {
  if (level === 'error') {
    logger.error(payload, message);
    return;
  }
  logger.info(payload, message);
}

async function loadTargetSiteMetadata(
  targetSite: string,
  opts: SiteSwitchOptions,
  logger: LoggerService,
  correlationId: string,
): Promise<TargetSiteMetadata | null | undefined> {
  if (!opts.getSiteByCode) {
    return undefined;
  }
  try {
    // Cache-first lookup; not counted toward the upstream budget.
    return await opts.getSiteByCode(targetSite);
  } catch (err) {
    logger.error({ err, site: targetSite, correlationId }, 'Failed to resolve target site metadata');
    return undefined;
  }
}

async function validateCartForSwitchedSite(
  cartStore: StoreApi<CartStore>,
  siteCode: string,
  logger: LoggerService,
  correlationId: string,
): Promise<number> {
  try {
    await cartStore.getState().validateSite(siteCode);
    return 1;
  } catch (err) {
    logger.error({ err, siteCode, correlationId }, 'fetchCart failed during site switch — leaving cart unresolved');
    return 0;
  }
}

function readCartCurrency(cart: CartStore['currentCart']): string | undefined {
  return cart?.currency ?? cart?.totalPrice?.currency;
}

function shouldReconcileCartCurrency(
  cart: CartStore['currentCart'],
  siteCode: string | undefined,
  sessionCurrency: string | undefined,
): boolean {
  const cartCurrency = readCartCurrency(cart);
  return Boolean(cart && cart.site === siteCode && sessionCurrency && cartCurrency && cartCurrency !== sessionCurrency);
}

function cartCurrencyDidNotConverge(
  cart: CartStore['currentCart'],
  siteCode: string | undefined,
  sessionCurrency: string | undefined,
): boolean {
  return Boolean(cart && cart.site === siteCode && readCartCurrency(cart) !== sessionCurrency);
}

async function rollbackSessionCurrencyToSiteDefault(
  sessionStore: StoreApi<SessionStore>,
  cartStore: StoreApi<CartStore>,
  logger: LoggerService,
  args: {
    updatedSession: Session;
    sessionCurrency: string;
    targetDefaultCurrency: string;
    correlationId: string;
  },
): Promise<{ activeSession: Session; extraUpstreamCalls: number } | undefined> {
  const { updatedSession, sessionCurrency, targetDefaultCurrency, correlationId } = args;
  try {
    const rolledBack = await updateSessionContext(
      { currency: targetDefaultCurrency },
      updatedSession.metadata?.version,
    );
    if (!rolledBack) {
      logger.error(
        { siteCode: updatedSession.siteCode, toCurrency: targetDefaultCurrency, correlationId },
        'Session currency rollback returned null — session/cart currency may remain mismatched',
      );
      return undefined;
    }
    sessionStore.getState().setSession(rolledBack);
    // Clear the residual cart-store error set by updateCurrency's internal catch —
    // the failure is now recovered from the orchestrator's POV.
    cartStore.getState().setError(null);
    logger.info(
      {
        siteCode: updatedSession.siteCode,
        fromCurrency: sessionCurrency,
        toCurrency: targetDefaultCurrency,
        correlationId,
      },
      'Rolled back session currency to target site default after reprice failure',
    );
    return { activeSession: rolledBack, extraUpstreamCalls: 1 };
  } catch (error_) {
    logger.error(
      {
        err: error_,
        siteCode: updatedSession.siteCode,
        toCurrency: targetDefaultCurrency,
        correlationId,
      },
      'Session currency rollback failed — session/cart currency may remain mismatched',
    );
    return undefined;
  }
}

async function reconcileSiteSwitchCartCurrency(
  stores: SiteSwitchStores,
  logger: LoggerService,
  args: {
    updatedSession: Session;
    targetDefaultCurrency: string | undefined;
    correlationId: string;
  },
): Promise<{
  activeSession: Session;
  currencyFallback?: { from: string; to: string };
  extraUpstreamCalls: number;
}> {
  const { sessionStore, cartStore } = stores;
  const { updatedSession, targetDefaultCurrency, correlationId } = args;
  const sessionCurrency = updatedSession.currency;
  const currentCart = cartStore.getState().currentCart;
  if (!shouldReconcileCartCurrency(currentCart, updatedSession.siteCode, sessionCurrency) || !sessionCurrency) {
    return { activeSession: updatedSession, extraUpstreamCalls: 0 };
  }

  let extraUpstreamCalls = 0;
  let repriceFailed = false;
  try {
    await cartStore.getState().syncCurrencyWithSession(sessionCurrency, updatedSession.siteCode);
    extraUpstreamCalls += 2;
  } catch (err) {
    repriceFailed = true;
    logger.error(
      {
        err,
        siteCode: updatedSession.siteCode,
        fromCurrency: readCartCurrency(currentCart),
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
  if (
    !repriceFailed &&
    cartCurrencyDidNotConverge(cartStore.getState().currentCart, updatedSession.siteCode, sessionCurrency)
  ) {
    repriceFailed = true;
    logger.warn(
      {
        siteCode: updatedSession.siteCode,
        fromCurrency: readCartCurrency(cartStore.getState().currentCart),
        toCurrency: sessionCurrency,
        correlationId,
      },
      'syncCurrencyWithSession resolved but cart currency did not converge — reprice rejected upstream',
    );
  }

  if (!repriceFailed) {
    return { activeSession: updatedSession, extraUpstreamCalls };
  }

  if (!targetDefaultCurrency || targetDefaultCurrency === sessionCurrency) {
    logger.warn(
      {
        siteCode: updatedSession.siteCode,
        attemptedCurrency: sessionCurrency,
        targetDefaultCurrency,
        correlationId,
      },
      'Cannot roll back session currency — no usable defaultCurrency for target site',
    );
    return { activeSession: updatedSession, extraUpstreamCalls };
  }

  const rolledBack = await rollbackSessionCurrencyToSiteDefault(sessionStore, cartStore, logger, {
    updatedSession,
    sessionCurrency,
    targetDefaultCurrency,
    correlationId,
  });
  if (!rolledBack) {
    return { activeSession: updatedSession, extraUpstreamCalls };
  }
  return {
    activeSession: rolledBack.activeSession,
    extraUpstreamCalls: extraUpstreamCalls + rolledBack.extraUpstreamCalls,
    currencyFallback: { from: sessionCurrency, to: targetDefaultCurrency },
  };
}

function navigateAfterUserSiteSwitch(
  opts: SiteSwitchOptions,
  targetSite: string,
  targetLanguages: string[],
  activeLanguage: string | undefined,
): void {
  if (opts.source !== 'user' || !opts.navigateTo) {
    return;
  }

  const fallbackLocale = opts.locale ?? activeLanguage ?? '';
  let resolvedTargetLocale = fallbackLocale;
  if (targetLanguages.length > 0 && !targetLanguages.includes(fallbackLocale)) {
    resolvedTargetLocale = targetLanguages[0];
  }

  if (resolvedTargetLocale) {
    writeLocaleCookie(resolvedTargetLocale);
  }

  opts.navigateTo('/', { locale: resolvedTargetLocale, site: targetSite });
  if (opts.router) {
    const router = opts.router;
    setTimeout(() => {
      router.refresh();
    }, NAVIGATION_REFRESH_DELAY_MS);
  }
}

type SiteSwitchPipelineArgs = {
  targetSite: string;
  stores: SiteSwitchStores;
  opts: SiteSwitchOptions;
  logger: LoggerService;
  telemetryBase: Record<string, unknown>;
  startedAt: number;
  prev: { siteCode?: string; currency?: string; language?: string; country?: string; version?: number };
  progress: { upstreamCalls: number };
};

async function runSiteSwitchPipeline(args: SiteSwitchPipelineArgs): Promise<SiteSwitchResult> {
  const { targetSite, stores, opts, logger, telemetryBase, startedAt, prev, progress } = args;
  const { sessionStore, siteStore, cartStore } = stores;
  const correlationId = String(telemetryBase.correlationId);

  const targetSiteInfo = await loadTargetSiteMetadata(targetSite, opts, logger, correlationId);
  // User source requires known metadata; deep-link tolerates a cold cache.
  if (!targetSiteInfo && opts.source === 'user' && opts.getSiteByCode) {
    logSiteSwitchEvent(
      logger,
      {
        ...telemetryBase,
        outcome: 'unknown-site',
        upstreamCalls: progress.upstreamCalls,
        durationMs: Date.now() - startedAt,
      },
      'site switch failed — unknown target site',
    );
    return { success: false, reason: 'unknown-site', correlationId, upstreamCalls: progress.upstreamCalls };
  }

  sessionStore.getState().setLoading(true);
  const targetLanguages = normalizeList(targetSiteInfo?.languages);
  const targetCurrencies = normalizeList(targetSiteInfo?.currencies);
  const targetDefaultCurrency = resolveDefaultCurrency(targetSiteInfo);
  if (targetDefaultCurrency && !targetCurrencies.includes(targetDefaultCurrency)) {
    targetCurrencies.push(targetDefaultCurrency);
  }

  const nextCurrency = resolveNextCurrency(prev.currency, targetCurrencies, targetDefaultCurrency);
  const nextLanguage = resolveNextLanguage(prev.language, targetLanguages, targetSiteInfo?.defaultLanguage);
  const nextCountry = resolveCountryForSite(targetSiteInfo, prev.country);
  const sessionFields = buildSiteSwitchSessionFields(
    targetSite,
    nextCurrency,
    nextLanguage,
    nextCountry,
    prev.currency,
    prev.language,
    prev.country,
  );

  const updatedSession = await updateSessionContext(sessionFields, prev.version);
  if (!updatedSession) {
    throw new Error('updateSessionContext returned null');
  }
  progress.upstreamCalls += 1;
  sessionStore.getState().setSession(updatedSession);

  // Reset the site store if it still holds the previous site (SSR-seeded deep links).
  if (siteStore.getState().getSite()?.code !== updatedSession.siteCode) {
    siteStore.getState().resetSite();
  }

  // Delegate per-site cart reset + refetch to `validateSite` so any in-flight `fetchCart`
  // from the previous site (closure-level `_fetchPromise` dedupe) is invalidated before
  // the target site's cart is loaded.
  progress.upstreamCalls += await validateCartForSwitchedSite(
    cartStore,
    updatedSession.siteCode,
    logger,
    correlationId,
  );

  const reconciled = await reconcileSiteSwitchCartCurrency(stores, logger, {
    updatedSession,
    targetDefaultCurrency,
    correlationId,
  });
  progress.upstreamCalls += reconciled.extraUpstreamCalls;
  const { activeSession, currencyFallback } = reconciled;
  const upstreamCalls = progress.upstreamCalls;

  const currencyChanged = Boolean(activeSession.currency && activeSession.currency !== prev.currency);
  const languageChanged = Boolean(activeSession.language && activeSession.language !== prev.language);

  devSyncLog('site-switch: post-switch snapshot', {
    correlationId,
    siteCode: activeSession.siteCode,
    sessionCurrency: activeSession.currency,
    prevCurrency: prev.currency,
    cartId: cartStore.getState().currentCart?.id ?? null,
    cartSite: cartStore.getState().currentCart?.site ?? null,
    cartCurrency:
      cartStore.getState().currentCart?.currency ?? cartStore.getState().currentCart?.totalPrice?.currency ?? null,
    currencyChanged,
    languageChanged,
    currencyFallback,
    upstreamCalls,
  });

  navigateAfterUserSiteSwitch(opts, targetSite, targetLanguages, activeSession.language);

  logSiteSwitchEvent(
    logger,
    {
      ...telemetryBase,
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
}

/** Runs the site-switch pipeline and emits a single telemetry event. Never throws. */
export async function performSiteSwitch(
  targetSite: string,
  stores: SiteSwitchStores,
  opts: SiteSwitchOptions,
): Promise<SiteSwitchResult> {
  const logger = opts.logger ?? getLogger();
  const { sessionStore, cartStore } = stores;
  const correlationId = generateCorrelationId();
  const startedAt = Date.now();

  const prevSession = sessionStore.getState().session;
  const telemetryBase = {
    event: 'site_switch',
    correlationId,
    source: opts.source,
    from: prevSession?.siteCode,
    to: targetSite,
  };

  if (!targetSite || targetSite === prevSession?.siteCode) {
    logSiteSwitchEvent(
      logger,
      { ...telemetryBase, outcome: 'same-site', upstreamCalls: 0, durationMs: 0 },
      'site switch skipped — same site',
    );
    return { success: true, reason: 'same-site', correlationId, upstreamCalls: 0 };
  }

  if (!sessionStore.getState().tryAcquireMutationLock()) {
    logSiteSwitchEvent(
      logger,
      { ...telemetryBase, outcome: 'locked', upstreamCalls: 0, durationMs: 0 },
      'site switch skipped — session mutation lock held',
    );
    return { success: false, reason: 'locked', correlationId, upstreamCalls: 0 };
  }

  cartStore.getState().beginSettling(SETTLING_REASON_SITE_SWITCH);

  const progress = { upstreamCalls: 0 };

  try {
    return await runSiteSwitchPipeline({
      targetSite,
      stores,
      opts,
      logger,
      telemetryBase,
      startedAt,
      prev: {
        siteCode: prevSession?.siteCode,
        currency: prevSession?.currency,
        language: prevSession?.language,
        country: prevSession?.country,
        version: prevSession?.metadata?.version,
      },
      progress,
    });
  } catch (err) {
    logSiteSwitchEvent(
      logger,
      {
        ...telemetryBase,
        outcome: 'error',
        upstreamCalls: progress.upstreamCalls,
        durationMs: Date.now() - startedAt,
        err: err instanceof Error ? err.message : String(err),
      },
      'site switch pipeline failed',
      'error',
    );
    return { success: false, reason: 'error', correlationId, upstreamCalls: progress.upstreamCalls };
  } finally {
    sessionStore.getState().setLoading(false);
    sessionStore.getState().releaseMutationLock();
    cartStore.getState().endSettling(SETTLING_REASON_SITE_SWITCH);
  }
}
