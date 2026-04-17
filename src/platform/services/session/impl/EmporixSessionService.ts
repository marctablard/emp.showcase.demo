import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixTokenManager } from '@/platform/integrations/emporix/common/EmporixTokenManager';
import type { EmporixConfig } from '@/platform/integrations/emporix/config';
import type {
  EmporixContextAttribute,
  EmporixSessionContext,
} from '@/platform/integrations/emporix/model/session-context';
import type { EmporixSessionContextApi } from '@/platform/integrations/emporix/session/EmporixSessionContextApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
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
    this.sessionContextApi.addOwnSessionContextAttribute({
      key: 'language',
      value: language,
    });
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
    // TODO propagate Country Switch via Event-System
    await this.sessionContextApi.updateOwnSessionContext({
      targetLocation: country,
      metadata: {
        version: session.metadata?.version || 1,
      },
    });
  }

  async setSite(site: string, defaultCurrency?: string): Promise<void> {
    const initialSession = await this.sessionContextApi.getOwnSessionContext();
    if (!initialSession) {
      return;
    }

    // Check if site is actually changing
    const siteChanged = initialSession.siteCode && initialSession.siteCode !== site;
    let session = initialSession;

    // Step 1: Clear cart association FIRST when site is changing.
    // This ensures that during the window between this call and the siteCode update,
    // any concurrent getCart() reads OLD siteCode + NO cartId → falls back to
    // criteria search with old siteCode → returns correct cart for old context.
    if (siteChanged) {
      await this.sessionContextApi.removeOwnSessionContextAttribute('currentCart');

      // Refresh context to obtain the latest metadata.version after attribute mutation.
      const refreshedSession = await this.sessionContextApi.getOwnSessionContext();
      if (!refreshedSession) {
        return;
      }
      session = refreshedSession;
    }

    // Step 2: Update siteCode (and currency if applicable).
    // After this, the session has new siteCode + no cartId → getCart() falls back to
    // criteria search with new siteCode → creates/finds correct cart for new context.
    const buildUpdatePayload = (context: EmporixSessionContext): Partial<EmporixSessionContext> => {
      const updatePayload: Partial<EmporixSessionContext> = {
        siteCode: site,
        metadata: {
          version: context.metadata?.version || 1,
        },
      };
      // When switching sites, also reset currency to the target site's default.
      // This aligns with Emporix's session initialization behavior where
      // anonymous sessions get the site's default currency.
      if (siteChanged && defaultCurrency) {
        updatePayload.currency = defaultCurrency;
      }
      return updatePayload;
    };

    const updatePayload = buildUpdatePayload(session);
    try {
      await this.sessionContextApi.updateOwnSessionContext(updatePayload);
    } catch (error) {
      if (!this.isSessionContextVersionConflictError(error)) {
        throw error;
      }

      // Bounded optimistic-lock retry: fetch latest version and retry exactly once.
      const latestSession = await this.sessionContextApi.getOwnSessionContext();
      if (!latestSession) {
        throw error;
      }

      const retryPayload = buildUpdatePayload(latestSession);
      this.logger.warn(
        {
          site,
          previousVersion: session.metadata?.version || 1,
          retryVersion: latestSession.metadata?.version || 1,
        },
        'Retrying session site update after version conflict',
      );
      await this.sessionContextApi.updateOwnSessionContext(retryPayload);
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

  async setLegalEntity(legalEntityId: string): Promise<void> {
    await this.tokenManager.refreshCustomerTokenWithLegalEntity(this.config.tenant, legalEntityId);
    await this.sessionContextApi.addOwnSessionContextAttribute({
      key: 'legalEntityId',
      value: legalEntityId,
    });
  }

  async clearCart(): Promise<void> {
    try {
      await this.sessionContextApi.removeOwnSessionContextAttribute('currentCart');
    } catch (error) {
      // Log but don't throw — clearing is best-effort. The cart attribute may
      // not exist (e.g., new session, already cleared) which returns 404.
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
   * Get the current session context
   */
  async getCurrent(): Promise<Session | undefined> {
    try {
      const sessionContext = await this.sessionContextApi.getOwnSessionContext();
      const result = sessionContext ? this.mapper.mapToService(sessionContext) : undefined;
      if (!result) {
        return undefined;
      }
      await this.adjustSessionsSettings(sessionContext, result);
      return result;
    } catch (_error) {
      // fail silently for ssr context
      return undefined;
    }
  }

  private async adjustSessionsSettings(sessionContext: EmporixSessionContext | undefined, result: Session) {
    const resolvedDefaultSite = this.defaultSite || this.availableSites[0];
    const updateDefaults: Partial<EmporixSessionContext> = {};
    if (resolvedDefaultSite && (!sessionContext?.siteCode || !this.availableSites.includes(sessionContext.siteCode))) {
      updateDefaults.siteCode = resolvedDefaultSite;
      result.siteCode = resolvedDefaultSite;
    }
    const site = await this.siteService.getSite(result.siteCode);
    if (!site) {
      return;
    }
    if (!sessionContext?.currency || !site.currencies.find((currency) => currency.id === result.currency)) {
      updateDefaults.currency = site.defaultCurrency.id;
      result.currency = site.defaultCurrency.id;
    }
    if (!result.country) {
      updateDefaults.targetLocation = this.defaultCountry;
      result.country = this.defaultCountry;
    }
    if (!result.language) {
      if (updateDefaults.context) {
        updateDefaults.context.language = this.defaultLanguage;
      } else {
        updateDefaults.context = { language: this.defaultLanguage };
      }
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
    if (Object.keys(updateDefaults).length > 0) {
      updateDefaults.metadata = {
        version: sessionContext?.metadata?.version || 1,
      };
      // Fire-and-forget: update session defaults in background.
      // 404 errors are expected for newly created sessions due to eventual consistency
      // in the Emporix backend - the session context may not be immediately available
      // for updates after token creation.
      this.sessionContextApi.updateOwnSessionContext(updateDefaults).catch((error: Error) => {
        // Only log unexpected errors (not 404s which are expected for new sessions)
        if (!error.message.includes('Not Found')) {
          this.logger.error({ error: error.message }, 'Unexpected error updating session defaults');
        }
      });
    }
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
