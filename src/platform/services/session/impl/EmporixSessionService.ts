import { inject } from 'inversify';
import { resolveCountryForSite } from '@/lib/common/site-country';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixTokenManager } from '@/platform/integrations/emporix/common/EmporixTokenManager';
import { decodeTokenLegalEntityId } from '@/platform/integrations/emporix/common/util/common';
import type { EmporixConfig } from '@/platform/integrations/emporix/config';
import type {
  EmporixContextAttribute,
  EmporixSessionContext,
} from '@/platform/integrations/emporix/model/session-context';
import type { EmporixOAuthApi } from '@/platform/integrations/emporix/oauth/EmporixOAuthApi';
import type { EmporixSessionContextApi } from '@/platform/integrations/emporix/session/EmporixSessionContextApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Site } from '@/platform/services/model/common/site';
import type { SessionMapper } from '@/platform/services/model/session/SessionMapper';
import type { Session } from '@/platform/services/model/session/session';
import type { SiteService } from '../../site/SiteService';
import type { SessionService } from '../SessionService';

/**
 * Implementation of SessionService for Emporix session context data.
 * Wraps around the SessionContextApi to provide session management functionality.
 */
@injectable('SessionService', 'Singleton')
class EmporixSessionService implements SessionService {
  // Env healthchecks guarantee these required values are present.
  private defaultSite = process.env.NEXT_PUBLIC_DEFAULT_SITE;
  private defaultLanguage = process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE;
  private defaultCountry = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY;
  private defaultRegion = process.env.NEXT_PUBLIC_DEFAULT_REGION;
  private availableSites = process.env.NEXT_PUBLIC_AVAILABLE_SITES?.split(',') || [];

  constructor(
    @inject('EmporixSessionContextApi') private sessionContextApi: EmporixSessionContextApi,
    @inject('EmporixSessionMapper') private mapper: SessionMapper<EmporixSessionContext, EmporixContextAttribute>,
    @inject('SiteService') private siteService: SiteService,
    @inject('EmporixTokenManager') private tokenManager: EmporixTokenManager,
    @inject('EmporixOAuthApi') private readonly oauthApi: EmporixOAuthApi,
    @inject('EmporixConfig') private config: EmporixConfig,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  async setRegion(region: string): Promise<void> {
    // TODO propagate Region Switch via Event-System
    await this.sessionContextApi.addOwnSessionContextAttribute({
      key: 'region',
      value: region,
    });
  }

  async setLanguage(language: string): Promise<void> {
    // TODO propagate Language Switch via Event-System
    // Language is a top-level session-context field since the 2026-04-21 Emporix
    // Session Context changelog; go through the combined PATCH helper so the
    // write hits `PATCH /me/context` with the optimistic-lock + retry semantics
    // shared by the other scalar setters.
    await this.updateContext({ language });
  }

  async setCurrency(currency: string): Promise<void> {
    const session = await this.sessionContextApi.getOwnSessionContext();
    if (!session) {
      return;
    }
    await this.sessionContextApi.updateOwnSessionContext({
      currency: currency,
      metadata: {
        version: session.metadata?.version || 1,
      },
    });
  }

  async setCountry(country: string): Promise<void> {
    const session = await this.sessionContextApi.getOwnSessionContext();
    if (!session) {
      return;
    }
    const targetLocation = this.normalizeSessionCountry(country);
    if (!targetLocation) {
      return;
    }
    // TODO propagate Country Switch via Event-System
    await this.sessionContextApi.updateOwnSessionContext({
      targetLocation,
      metadata: {
        version: session.metadata?.version || 1,
      },
    });
  }

  async setSite(site: string, defaultCurrency?: string): Promise<void> {
    // Delegates to the combined updater so retry semantics live in one place. Does not touch
    // `currentCart` — per-site cart resolution is the client orchestrator's responsibility.
    const initialSession = await this.sessionContextApi.getOwnSessionContext();
    if (!initialSession) {
      return;
    }
    const previousSiteCode = initialSession.siteCode;
    const siteChanged = !!previousSiteCode && previousSiteCode !== site;
    const fields: Partial<EmporixSessionContext> = { siteCode: site };
    if (siteChanged && defaultCurrency) {
      fields.currency = defaultCurrency;
    }
    const targetSite = await this.siteService.getSite(site);
    const nextCountry = resolveCountryForSite(targetSite, initialSession.targetLocation);
    if (nextCountry && nextCountry !== initialSession.targetLocation) {
      fields.targetLocation = nextCountry;
    }

    await this.updateSessionContextWithRetry(fields, {
      initialSession,
      // Abort the retry if another mutation already moved siteCode — retrying would clobber it.
      abortOnConflict: (latest) =>
        latest.siteCode === site
          ? { reason: 'already-target', log: { site } }
          : previousSiteCode && latest.siteCode !== previousSiteCode
            ? {
                reason: 'concurrent-site-change',
                log: {
                  targetSite: site,
                  initialSiteCode: previousSiteCode,
                  currentSiteCode: latest.siteCode,
                },
              }
            : undefined,
      retryLogLabel: 'Retrying session site update after version conflict',
      retryLogContext: { site },
    });

    // Only invalidate the previous site's cache; the new site's cache was likely just warmed.
    if (siteChanged && previousSiteCode) {
      this.siteService.invalidateSiteCache(previousSiteCode);
    }
  }

  async setCart(cartId: string): Promise<void> {
    const session = await this.sessionContextApi.getOwnSessionContext();
    if (!session) {
      return;
    }
    await this.sessionContextApi.addOwnSessionContextAttribute({
      key: 'currentCart',
      value: cartId,
    });
    /*
    // Needs to be done with Service Authorization!
    await this.sessionContextApi.updateSessionContext(session.sessionId, {
      cartId: cartId,
      metadata: {
        version: session.metadata?.version || 1,
      },
    });
    */
  }

  async setLegalEntity(legalEntityId: string): Promise<{ tokenRefreshSucceeded: true; tokenLooksLikeJwt: boolean }> {
    const refreshedToken = await this.tokenManager.refreshCustomerTokenWithLegalEntity(
      this.config.tenant,
      legalEntityId,
      this.config.clientId,
    );
    if (!refreshedToken) {
      this.logger.error(
        { legalEntityId, tokenRefreshSucceeded: false },
        'Failed to refresh customer token with legal entity',
      );
      throw new Error('Failed to scope customer token to the selected legal entity');
    }

    await this.sessionContextApi.addOwnSessionContextAttribute({
      key: 'legalEntityId',
      value: legalEntityId,
    });
    return {
      tokenRefreshSucceeded: true,
      tokenLooksLikeJwt: refreshedToken.accessToken.split('.').length === 3,
    };
  }

  async getCustomerTokenLegalEntityId(): Promise<string | undefined> {
    try {
      const token = await this.tokenManager.getCustomerToken(this.config.tenant, this.config.clientId);
      if (!token) {
        return undefined;
      }
      try {
        const validated = await this.oauthApi.validateCustomerToken(this.config.tenant, token.accessToken);
        if (validated.legalEntityId) {
          return validated.legalEntityId;
        }
      } catch (error) {
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'Could not validate customer token legal entity; falling back to token claims',
        );
      }
      return decodeTokenLegalEntityId(token.accessToken, token.saasToken);
    } catch (error) {
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Could not read customer token legal entity for diagnostics',
      );
      return undefined;
    }
  }

  async clearLegalEntity(): Promise<void> {
    try {
      await this.sessionContextApi.removeOwnSessionContextAttribute('legalEntityId');
    } catch (error) {
      // 404 on removing a missing attribute is a no-op.
      if (error instanceof Error && !error.message.includes('Not Found')) {
        this.logger.error({ error: error.message }, 'Failed to clear legalEntityId from session context');
      }
    }
    // Re-scope the customer token to drop the legalEntityId claim (no-op for anonymous sessions).
    try {
      await this.tokenManager.refreshCustomerTokenWithLegalEntity(this.config.tenant, '', this.config.clientId);
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to refresh customer token after clearing legal entity',
      );
    }
  }

  async updateContext(
    fields: {
      siteCode?: string;
      currency?: string;
      language?: string;
      country?: string;
      region?: string;
    },
    opts?: { expectedVersion?: number },
  ): Promise<Session | undefined> {
    const payload: Partial<EmporixSessionContext> = {};
    if (fields.siteCode !== undefined) payload.siteCode = fields.siteCode;
    if (fields.currency !== undefined) payload.currency = fields.currency;
    if (fields.country !== undefined) payload.targetLocation = fields.country;
    // `language` is a first-class field on `EmporixSessionContext` since the
    // 2026-04-21 BE changelog, so it goes in the top-level PATCH payload (no
    // pre-fetch needed). Custom attributes like `region` still need to be
    // merged into the full `context` object because PATCH replaces it.
    if (fields.language !== undefined) payload.language = fields.language;
    const contextPatch: Record<string, string> = {};
    if (fields.region !== undefined) contextPatch.region = fields.region;
    const hasContextPatch = Object.keys(contextPatch).length > 0;

    const hasUpdates = Object.keys(payload).length > 0 || hasContextPatch;
    if (!hasUpdates) {
      return this.getCurrent();
    }

    const expectedVersion = opts?.expectedVersion;
    let initialSession: EmporixSessionContext | undefined;
    let baseVersion: number;

    // `PATCH /me/context` replaces the whole `context` object, so a context patch must be
    // pre-merged with the existing context (preserving `currentCart`, etc.). Force a pre-fetch
    // in that case; otherwise trust `expectedVersion` and skip the read on the happy path.
    if (hasContextPatch || !(typeof expectedVersion === 'number' && expectedVersion > 0)) {
      initialSession = await this.sessionContextApi.getOwnSessionContext();
      if (!initialSession) {
        return undefined;
      }
      baseVersion = initialSession.metadata?.version || 1;
    } else {
      baseVersion = expectedVersion;
    }

    if (hasContextPatch) {
      payload.context = { ...(initialSession?.context ?? {}), ...contextPatch };
    }

    const finalSession = await this.updateSessionContextWithRetry(payload, {
      initialSession,
      baseVersion,
      retryLogLabel: 'Retrying session context update after version conflict',
      retryLogContext: { fields: Object.keys(payload) },
      returnContext: true,
    });

    return finalSession ? this.mapper.mapToService(finalSession) : undefined;
  }

  /**
   * Shared optimistic-lock retry for `updateOwnSessionContext`. Happy path: one PATCH.
   * On version conflict: re-read, apply `abortOnConflict` guard, retry once. Other errors
   * rethrow. When `returnContext` is true, returns the merged post-PATCH context so callers
   * can avoid an extra GET.
   */
  private async updateSessionContextWithRetry(
    fields: Partial<EmporixSessionContext>,
    opts: {
      initialSession?: EmporixSessionContext;
      baseVersion?: number;
      abortOnConflict?: (latest: EmporixSessionContext) => { reason: string; log: Record<string, unknown> } | undefined;
      retryLogLabel: string;
      retryLogContext?: Record<string, unknown>;
      returnContext?: boolean;
    },
  ): Promise<EmporixSessionContext | undefined> {
    const baseVersion = opts.baseVersion ?? opts.initialSession?.metadata?.version ?? 1;
    const firstPayload: Partial<EmporixSessionContext> = {
      ...fields,
      metadata: { version: baseVersion },
    };

    try {
      await this.sessionContextApi.updateOwnSessionContext(firstPayload);
      if (!opts.returnContext) {
        return undefined;
      }
      // Locally merge to avoid a follow-up GET; the API does not echo the updated resource.
      const baseline = opts.initialSession;
      if (baseline) {
        return this.mergeContextPatch(baseline, fields, baseVersion + 1);
      }
      // Pure expectedVersion path — fall back to a single GET for a canonical Session.
      return (await this.sessionContextApi.getOwnSessionContext()) ?? undefined;
    } catch (error) {
      if (!this.isSessionContextVersionConflictError(error)) {
        throw error;
      }

      const latestSession = await this.sessionContextApi.getOwnSessionContext();
      if (!latestSession) {
        throw error;
      }

      const abort = opts.abortOnConflict?.(latestSession);
      if (abort) {
        this.logger.info(
          abort.log,
          abort.reason === 'already-target'
            ? 'Site already set to target — skipping retry'
            : 'Aborting setSite retry — siteCode was concurrently changed by another mutation',
        );
        return opts.returnContext ? latestSession : undefined;
      }

      const retryVersion = latestSession.metadata?.version || 1;
      this.logger.warn(
        {
          ...(opts.retryLogContext ?? {}),
          previousVersion: baseVersion,
          retryVersion,
        },
        opts.retryLogLabel,
      );
      // Re-merge any `context` patch against the freshly-read context so concurrently-added
      // keys (e.g. `currentCart`) survive the full-object replacement that PATCH performs.
      const retryFields: Partial<EmporixSessionContext> = fields.context
        ? {
            ...fields,
            context: { ...(latestSession.context ?? {}), ...fields.context },
          }
        : fields;
      await this.sessionContextApi.updateOwnSessionContext({
        ...retryFields,
        metadata: { version: retryVersion },
      });
      return opts.returnContext ? this.mergeContextPatch(latestSession, retryFields, retryVersion + 1) : undefined;
    }
  }

  /** Shallow-merged copy of `base` with `patch` applied — synthesizes the post-PATCH context. */
  private mergeContextPatch(
    base: EmporixSessionContext,
    patch: Partial<EmporixSessionContext>,
    nextVersion: number,
  ): EmporixSessionContext {
    return {
      ...base,
      ...(patch.siteCode !== undefined ? { siteCode: patch.siteCode } : {}),
      ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
      ...(patch.targetLocation !== undefined ? { targetLocation: patch.targetLocation } : {}),
      ...(patch.language !== undefined ? { language: patch.language } : {}),
      ...(patch.context ? { context: { ...(base.context ?? {}), ...patch.context } } : {}),
      metadata: { version: nextVersion },
    };
  }

  async clearCart(): Promise<void> {
    try {
      await this.sessionContextApi.removeOwnSessionContextAttribute('currentCart');
    } catch (error) {
      // Best-effort: 404 means the attribute was already missing.
      if (error instanceof Error && !error.message.includes('Not Found')) {
        this.logger.error({ error: error.message }, 'Failed to clear cart from session context');
      }
    }
  }

  async getById(id: string): Promise<Session | undefined> {
    const sessionContext = await this.sessionContextApi.getSessionContext(id);
    const result = sessionContext ? this.mapper.mapToService(sessionContext) : undefined;
    return result;
  }

  /**
   * Get the current session context; a failed lookup is swallowed (best-effort read).
   */
  async getCurrent(): Promise<Session | undefined> {
    try {
      return await this.getCurrentOrThrow();
    } catch (error) {
      // Best-effort read for SSR / display paths: log and resolve "no session". Access-gating
      // callers must use getCurrentOrThrow() so an outage cannot pass as an anonymous visitor.
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Could not read current session context; treating as no session (best-effort read)',
      );
      return undefined;
    }
  }

  /**
   * Get the current session context; `undefined` only when there is no session, a failed lookup
   * rejects so access-gating callers can fail closed.
   */
  async getCurrentOrThrow(): Promise<Session | undefined> {
    const sessionContext = await this.sessionContextApi.getOwnSessionContext();
    const result = sessionContext ? this.mapper.mapToService(sessionContext) : undefined;
    if (!result) {
      return undefined;
    }
    await this.adjustSessionsSettings(sessionContext, result);
    return result;
  }

  private applyDefaultSiteIfNeeded(
    sessionContext: EmporixSessionContext | undefined,
    result: Session,
    updateDefaults: Partial<EmporixSessionContext>,
  ): void {
    const resolvedDefaultSite = this.defaultSite || this.availableSites[0];
    if (resolvedDefaultSite && (!sessionContext?.siteCode || !this.availableSites.includes(sessionContext.siteCode))) {
      updateDefaults.siteCode = resolvedDefaultSite;
      result.siteCode = resolvedDefaultSite;
    }
  }

  private applySiteCurrencyIfNeeded(site: Site, result: Session, updateDefaults: Partial<EmporixSessionContext>): void {
    if (site.defaultCurrency?.id && (!result.currency || !this.isCurrencySupportedOnSite(site, result.currency))) {
      updateDefaults.currency = site.defaultCurrency.id;
      result.currency = site.defaultCurrency.id;
    }
  }

  private applySessionCountryDefaults(
    site: Site,
    result: Session,
    updateDefaults: Partial<EmporixSessionContext>,
  ): void {
    const currentCountry = this.normalizeSessionCountry(result.country);
    const nextCountry =
      resolveCountryForSite(site, currentCountry || undefined) || (currentCountry ? undefined : this.defaultCountry);
    const rawCountry = typeof result.country === 'string' ? result.country : '';
    if (nextCountry && nextCountry !== rawCountry) {
      updateDefaults.targetLocation = nextCountry;
      result.country = nextCountry;
    }
  }

  private applyLanguageAndRegionDefaults(result: Session, updateDefaults: Partial<EmporixSessionContext>): void {
    if (!result.language) {
      // Top-level field since the 2026-04-21 BE changelog — write it at the
      // root of the PATCH payload so we don't have to round-trip the full
      // `context` object just to seed a default language.
      updateDefaults.language = this.defaultLanguage;
      result.language = this.defaultLanguage;
    }
    if (!result.region) {
      if (updateDefaults.context) {
        updateDefaults.context.region = this.defaultRegion;
      } else {
        updateDefaults.context = { region: this.defaultRegion };
      }
      result.region = this.defaultRegion;
    }
  }

  private async persistSessionDefaults(
    sessionContext: EmporixSessionContext | undefined,
    updateDefaults: Partial<EmporixSessionContext>,
  ): Promise<void> {
    if (Object.keys(updateDefaults).length === 0) {
      return;
    }
    // Merge with existing `context` since PATCH replaces the whole object.
    if (updateDefaults.context) {
      updateDefaults.context = {
        ...(sessionContext?.context ?? {}),
        ...updateDefaults.context,
      };
    }
    this.logger.info({ updateDefaults }, 'Patching session defaults');
    updateDefaults.metadata = {
      version: sessionContext?.metadata?.version || 1,
    };
    // Await so later match-prices-by-context / cart reads see the same country.
    // 404s are expected for newly-created sessions (eventual consistency).
    try {
      await this.sessionContextApi.updateOwnSessionContext(updateDefaults);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('Not Found')) {
        this.logger.error({ error: message }, 'Unexpected error updating session defaults');
      }
    }
  }

  private async adjustSessionsSettings(sessionContext: EmporixSessionContext | undefined, result: Session) {
    const updateDefaults: Partial<EmporixSessionContext> = {};
    this.applyDefaultSiteIfNeeded(sessionContext, result, updateDefaults);

    const needsAdjustment = Object.keys(updateDefaults).length > 0;
    this.logger.debug(
      `adjustSessionsSettings entry site=${result.siteCode} currency=${result.currency} country=${result.country} language=${result.language} region=${result.region} needsAdjustment=${needsAdjustment}`,
    );

    const site = await this.siteService.getSite(result.siteCode);
    if (!site) {
      return;
    }

    this.applySiteCurrencyIfNeeded(site, result, updateDefaults);
    this.applySessionCountryDefaults(site, result, updateDefaults);
    this.applyLanguageAndRegionDefaults(result, updateDefaults);
    await this.persistSessionDefaults(sessionContext, updateDefaults);
  }

  private normalizeSessionCountry(value: string | undefined): string {
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
  }

  private isCurrencySupportedOnSite(site: Site, currency: string): boolean {
    const supported = new Set<string>();
    if (site.defaultCurrency?.id) {
      supported.add(site.defaultCurrency.id);
    }
    if (site.defaultCurrency?.code) {
      supported.add(site.defaultCurrency.code);
    }
    for (const entry of site.currencies ?? []) {
      if (entry.id) {
        supported.add(entry.id);
      }
      if (entry.code) {
        supported.add(entry.code);
      }
    }
    return supported.has(currency);
  }

  private isSessionContextVersionConflictError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    const message = error.message.toLowerCase();
    return (
      message.includes('failed to update own session context') &&
      message.includes('not found') &&
      message.includes('version') &&
      message.includes('has not been found')
    );
  }
}

export default EmporixSessionService;
