import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type {
  EmporixContextAttribute,
  EmporixSessionContext,
} from '@/platform/integrations/emporix/model/session-context';
import type { EmporixSessionContextApi } from '@/platform/integrations/emporix/session/EmporixSessionContextApi';
import type { SessionMapper } from '@/platform/services/model/session/SessionMapper';
import type { Session } from '@/platform/services/model/session/session';
import { SessionService } from '../SessionService';

/**
 * Implementation of SessionService for Emporix session context data.
 * Wraps around the SessionContextApi to provide session management functionality.
 */
@injectable('SessionService', 'Singleton')
class EmporixSessionService implements SessionService {
  // Static default values from environment variables with fallbacks
  private defaultSite = process.env.NEXT_PUBLIC_DEFAULT_SITE || 'main';
  private defaultLanguage = process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE || 'en';
  private defaultCountry = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY || 'DE';
  private defaultRegion = process.env.NEXT_PUBLIC_DEFAULT_REGION || 'Europe';
  private availableSites = process.env.NEXT_PUBLIC_AVAILABLE_SITES?.split(',') || ['main'];

  constructor(
    @inject('EmporixSessionContextApi') private sessionContextApi: EmporixSessionContextApi,
    @inject('EmporixSessionMapper') private mapper: SessionMapper<EmporixSessionContext, EmporixContextAttribute>,
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

  async setSite(site: string): Promise<void> {
    const session = await this.sessionContextApi.getOwnSessionContext();
    if (!session) {
      return;
    }
    await this.sessionContextApi.updateOwnSessionContext({
      siteCode: site,
      metadata: {
        version: session.metadata?.version || 1,
      },
    });
  }

  async setCart(cartId: string): Promise<void> {
    const session = await this.sessionContextApi.getOwnSessionContext();
    if (!session) {
      return;
    }
    this.sessionContextApi.addOwnSessionContextAttribute({
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

  async getById(id: string): Promise<Session | undefined> {
    const sessionContext = await this.sessionContextApi.getSessionContext(id);
    const result = sessionContext ? this.mapper.mapToService(sessionContext) : undefined;
    return result;
  }

  /**
   * Get the current session context
   */
  async getCurrent(): Promise<Session | undefined> {
    const sessionContext = await this.sessionContextApi.getOwnSessionContext();
    if (sessionContext?.siteCode) {
      if (!this.availableSites.includes(sessionContext.siteCode)) {
        await this.setSite(this.defaultSite);
        sessionContext.siteCode = this.defaultSite;
      }
    }
    const result = sessionContext ? this.mapper.mapToService(sessionContext) : undefined;
    if (!result) {
      // TODO, can this even be?
      return undefined;
    }
    const updateDefaults: Partial<EmporixSessionContext> = {};
    if (!result.country) {
      updateDefaults.targetLocation = this.defaultCountry;
      result.country = this.defaultCountry;
    }
    if (Object.keys(updateDefaults).length > 0) {
      updateDefaults.metadata = {
        version: sessionContext?.metadata?.version || 1,
      };
      this.sessionContextApi.updateOwnSessionContext(updateDefaults);
    }
    if (!result.language) {
      this.setLanguage(this.defaultLanguage);
      result.language = this.defaultLanguage;
    }
    if (!result.region) {
      this.setRegion(this.defaultRegion);
      result.region = this.defaultRegion;
    }
    return result;
  }
}

export default EmporixSessionService;
