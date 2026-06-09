import { Container } from 'inversify';
import type { EmporixTokenManager } from '@/platform/integrations/emporix/common/EmporixTokenManager';
import type { EmporixConfig } from '@/platform/integrations/emporix/config';
import type {
  EmporixContextAttribute,
  EmporixSessionContext,
} from '@/platform/integrations/emporix/model/session-context';
import { EmporixSessionContextApi } from '@/platform/integrations/emporix/session/EmporixSessionContextApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Session, SessionAttribute } from '@/platform/services/model/session/session';
import { SessionMapper } from '../../model/session';
import { SiteService } from '../../site/SiteService';
import EmporixSessionService from './EmporixSessionService';

describe('EmporixSessionService', () => {
  let container: Container;
  let sessionService: EmporixSessionService;
  let mockSessionContextApi: jest.Mocked<EmporixSessionContextApi>;
  let mockSiteService: jest.Mocked<SiteService>;
  let mockTokenManager: jest.Mocked<EmporixTokenManager>;
  let mockConfig: EmporixConfig;
  let mockSessionMapper: jest.Mocked<SessionMapper<EmporixSessionContext, EmporixContextAttribute>>;
  let mockLogger: jest.Mocked<LoggerService>;

  const mockSessionContext: EmporixSessionContext = {
    sessionId: 'test-session-id',
    currency: 'USD',
    siteCode: 'test-site',
    context: {
      testAttribute: {
        key: 'testAttribute',
        value: 'test-value',
      },
    },
  };

  const mockSession: Session = {
    id: 'test-session-id',
    currency: 'USD',
    siteCode: 'test-site',
    attributes: {
      testAttribute: {
        key: 'testAttribute',
        value: 'test-value',
      },
    },
  };

  const mockSessionAttribute: SessionAttribute = {
    key: 'testAttribute',
    value: 'test-value',
  };

  const mockContextAttribute: EmporixContextAttribute = {
    key: 'testAttribute',
    value: 'test-value',
  };

  beforeEach(() => {
    container = new Container();

    // Create mock for SessionContextApi
    mockSessionContextApi = {
      getOwnSessionContext: jest.fn(),
      updateOwnSessionContext: jest.fn(),
      addOwnSessionContextAttribute: jest.fn(),
      removeOwnSessionContextAttribute: jest.fn(),
      // Add other required methods from the interface
      getSessionContext: jest.fn(),
      updateSessionContext: jest.fn(),
      addSessionContextAttribute: jest.fn(),
      removeSessionContextAttribute: jest.fn(),
    };

    // Create mock for SessionMapper
    mockSessionMapper = {
      mapToService: jest.fn(),
      mapToSource: jest.fn(),
      mapPartialToSource: jest.fn(),
      mapAttributeToSource: jest.fn(),
    };

    mockSiteService = {
      getSite: jest.fn(),
      invalidateSiteCache: jest.fn(),
      getAvailableSites: jest.fn(),
      getCountries: jest.fn(),
      getCountry: jest.fn(),
      getRegions: jest.fn(),
      getRegion: jest.fn(),
      getExchangeRates: jest.fn(),
      getExchangeRate: jest.fn(),
      getCurrencies: jest.fn(),
      getCurrency: jest.fn(),
    };

    mockTokenManager = {
      getPublicToken: jest.fn(),
      getAnonymousToken: jest.fn(),
      clearAnonymousToken: jest.fn(),
      getCustomerToken: jest.fn(),
      clearCustomerToken: jest.fn(),
      getServiceAccessToken: jest.fn(),
      getSessionToken: jest.fn(),
      refreshCustomerTokenWithLegalEntity: jest.fn(),
      clearPublicTokenCache: jest.fn(),
      clearTokens: jest.fn(),
    } as jest.Mocked<EmporixTokenManager>;

    mockConfig = {
      tenant: 'test-tenant',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      baseUrl: 'https://api.test.com',
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    // Register mocks
    container.bind<EmporixSessionContextApi>('EmporixSessionContextApi').toConstantValue(mockSessionContextApi);
    container
      .bind<SessionMapper<EmporixSessionContext, EmporixContextAttribute>>('EmporixSessionMapper')
      .toConstantValue(mockSessionMapper);
    container.bind<EmporixSessionService>('SessionService').to(EmporixSessionService);
    container.bind<SiteService>('SiteService').toConstantValue(mockSiteService);
    container.bind<EmporixTokenManager>('EmporixTokenManager').toConstantValue(mockTokenManager);
    container.bind<EmporixConfig>('EmporixConfig').toConstantValue(mockConfig);
    container.bind<LoggerService>('LoggerService').toConstantValue(mockLogger);

    // Get service instance
    sessionService = container.get<EmporixSessionService>('SessionService');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentSession', () => {
    it('should call getOwnSessionContext on the SessionContextApi and map the result', async () => {
      mockSessionContextApi.getOwnSessionContext.mockResolvedValue(mockSessionContext);
      mockSessionMapper.mapToService.mockReturnValue(mockSession);

      const result = await sessionService.getCurrent();

      expect(mockSessionContextApi.getOwnSessionContext).toHaveBeenCalledTimes(1);
      expect(mockSessionMapper.mapToService).toHaveBeenCalledWith(mockSessionContext);
      expect(result).toEqual(mockSession);
    });

    it('should return undefined when session not found', async () => {
      mockSessionContextApi.getOwnSessionContext.mockResolvedValue(undefined);

      const result = await sessionService.getCurrent();

      expect(mockSessionContextApi.getOwnSessionContext).toHaveBeenCalledTimes(1);
      expect(mockSessionMapper.mapToService).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('updateCurrentSession', () => {
    it('should map the session and call updateOwnSessionContext on the SessionContextApi', async () => {
      const mappedPartialContext: Partial<EmporixSessionContext> = {
        currency: 'EUR',
        metadata: {
          version: 1,
        },
      };

      mockSessionMapper.mapPartialToSource.mockReturnValue(mappedPartialContext);
      mockSessionContextApi.getOwnSessionContext.mockResolvedValue(mockSessionContext);
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();

      await sessionService.setCurrency('EUR');
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledTimes(1);
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledWith(mappedPartialContext);
    });
  });

  describe('setLanguage', () => {
    it('should PATCH language as a top-level session-context field (2026-04-21 BE change)', async () => {
      // Since the 2026-04-21 Session Context changelog, `language` is a
      // first-class field on the session context and `setLanguage` must
      // write it via `PATCH /me/context` at the top level — not as a
      // context attribute.
      mockSessionContextApi.getOwnSessionContext.mockResolvedValueOnce({
        sessionId: 'test-session',
        siteCode: 'site-a',
        currency: 'EUR',
        context: { currentCart: 'cart-123' },
        metadata: { version: 4 },
      });
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();
      mockSessionMapper.mapToService.mockReturnValue(mockSession);

      await sessionService.setLanguage('en');

      expect(mockSessionContextApi.addOwnSessionContextAttribute).not.toHaveBeenCalled();
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledTimes(1);
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledWith({
        language: 'en',
        metadata: { version: 4 },
      });
    });
  });

  describe('setSite', () => {
    it('should issue a single combined PATCH (siteCode + currency) when site changes', async () => {
      mockSessionContextApi.getOwnSessionContext.mockResolvedValueOnce({
        sessionId: 'test-session',
        siteCode: 'site-a',
        metadata: { version: 1 },
      });
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();

      await sessionService.setSite('site-b', 'EUR');

      // No longer clears `currentCart` — the client-side `performSiteSwitch` orchestrator
      // re-fetches the per-site cart via `CartService.getCart()` / `getCartByCriteria`.
      expect(mockSessionContextApi.removeOwnSessionContextAttribute).not.toHaveBeenCalled();
      // Single combined PATCH using the initial version — no second GET.
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledTimes(1);
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledWith({
        siteCode: 'site-b',
        currency: 'EUR',
        metadata: { version: 1 },
      });
      // Only the previous site's cache is invalidated — keep the target site
      // cache warm (the API route that called us typically just hydrated it).
      expect(mockSiteService.invalidateSiteCache).toHaveBeenCalledWith('site-a');
      expect(mockSiteService.invalidateSiteCache).not.toHaveBeenCalledWith('site-b');
    });

    it('should NOT include currency in PATCH when site is set to same value', async () => {
      mockSessionContextApi.getOwnSessionContext.mockResolvedValue({
        sessionId: 'test-session',
        siteCode: 'site-a',
        metadata: { version: 1 },
      });
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();

      await sessionService.setSite('site-a', 'EUR');

      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledWith({
        siteCode: 'site-a',
        metadata: { version: 1 },
      });
      expect(mockSessionContextApi.removeOwnSessionContextAttribute).not.toHaveBeenCalled();
      expect(mockSiteService.invalidateSiteCache).not.toHaveBeenCalled();
    });

    it('should NOT clear currentCart when session has no siteCode set initially', async () => {
      mockSessionContextApi.getOwnSessionContext.mockResolvedValue({
        sessionId: 'test-session',
        metadata: { version: 1 },
      });
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();

      await sessionService.setSite('site-a', 'EUR');

      // First-time site set: siteChanged is false → no currency reset, no cache invalidation.
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledWith({
        siteCode: 'site-a',
        metadata: { version: 1 },
      });
      expect(mockSessionContextApi.removeOwnSessionContextAttribute).not.toHaveBeenCalled();
      expect(mockSiteService.invalidateSiteCache).not.toHaveBeenCalled();
    });

    it('should not update currency when defaultCurrency is not provided (backward compatibility)', async () => {
      mockSessionContextApi.getOwnSessionContext.mockResolvedValueOnce({
        sessionId: 'test-session',
        siteCode: 'site-a',
        metadata: { version: 1 },
      });
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();

      await sessionService.setSite('site-b');

      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledWith({
        siteCode: 'site-b',
        metadata: { version: 1 },
      });
      expect(mockSessionContextApi.removeOwnSessionContextAttribute).not.toHaveBeenCalled();
    });

    it('should retry once with refreshed version when first PATCH fails with version conflict', async () => {
      mockSessionContextApi.getOwnSessionContext
        .mockResolvedValueOnce({
          sessionId: 'test-session',
          siteCode: 'site-a',
          metadata: { version: 3 },
        })
        // After version conflict — service re-reads to get latest version.
        .mockResolvedValueOnce({
          sessionId: 'test-session',
          siteCode: 'site-a',
          metadata: { version: 5 },
        });
      mockSessionContextApi.updateOwnSessionContext
        .mockRejectedValueOnce(
          new Error(
            'Failed to update own session context: Not Found - {"message":"The context with sessionId test-session and version 3 has not been found."}',
          ),
        )
        .mockResolvedValueOnce();

      await sessionService.setSite('site-b', 'EUR');

      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenNthCalledWith(1, {
        siteCode: 'site-b',
        currency: 'EUR',
        metadata: { version: 3 },
      });
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenNthCalledWith(2, {
        siteCode: 'site-b',
        currency: 'EUR',
        metadata: { version: 5 },
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        {
          site: 'site-b',
          previousVersion: 3,
          retryVersion: 5,
        },
        'Retrying session site update after version conflict',
      );
    });

    it('should abort retry when siteCode was concurrently changed by another mutation', async () => {
      mockSessionContextApi.getOwnSessionContext
        .mockResolvedValueOnce({
          sessionId: 'test-session',
          siteCode: 'site-a',
          metadata: { version: 3 },
        })
        .mockResolvedValueOnce({
          sessionId: 'test-session',
          siteCode: 'site-c',
          metadata: { version: 6 },
        });
      mockSessionContextApi.updateOwnSessionContext.mockRejectedValueOnce(
        new Error(
          'Failed to update own session context: Not Found - {"message":"The context with sessionId test-session and version 3 has not been found."}',
        ),
      );

      await sessionService.setSite('site-b', 'EUR');

      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          targetSite: 'site-b',
          initialSiteCode: 'site-a',
          currentSiteCode: 'site-c',
        },
        'Aborting setSite retry — siteCode was concurrently changed by another mutation',
      );
    });

    it('should skip retry when latest session already has the target siteCode', async () => {
      mockSessionContextApi.getOwnSessionContext
        .mockResolvedValueOnce({
          sessionId: 'test-session',
          siteCode: 'site-a',
          metadata: { version: 3 },
        })
        .mockResolvedValueOnce({
          sessionId: 'test-session',
          siteCode: 'site-b',
          metadata: { version: 6 },
        });
      mockSessionContextApi.updateOwnSessionContext.mockRejectedValueOnce(
        new Error(
          'Failed to update own session context: Not Found - {"message":"The context with sessionId test-session and version 3 has not been found."}',
        ),
      );

      await sessionService.setSite('site-b', 'EUR');

      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith({ site: 'site-b' }, 'Site already set to target — skipping retry');
    });

    it('should throw when retry also fails after version conflict', async () => {
      mockSessionContextApi.getOwnSessionContext
        .mockResolvedValueOnce({
          sessionId: 'test-session',
          siteCode: 'site-a',
          metadata: { version: 2 },
        })
        .mockResolvedValueOnce({
          sessionId: 'test-session',
          siteCode: 'site-a',
          metadata: { version: 4 },
        });
      mockSessionContextApi.updateOwnSessionContext
        .mockRejectedValueOnce(
          new Error(
            'Failed to update own session context: Not Found - {"message":"The context with sessionId test-session and version 2 has not been found."}',
          ),
        )
        .mockRejectedValueOnce(
          new Error(
            'Failed to update own session context: Not Found - {"message":"The context with sessionId test-session and version 4 has not been found."}',
          ),
        );

      await expect(sessionService.setSite('site-b', 'EUR')).rejects.toThrow('Failed to update own session context');
    });
  });

  describe('updateContext', () => {
    it('should skip pre-PATCH GET when expectedVersion is provided and the patch has no context fields', async () => {
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();
      // Without an initialSession baseline we issue one follow-up GET to return the canonical shape.
      mockSessionContextApi.getOwnSessionContext.mockResolvedValueOnce({
        sessionId: 'test-session',
        siteCode: 'site-b',
        currency: 'EUR',
        metadata: { version: 8 },
      });
      mockSessionMapper.mapToService.mockReturnValue(mockSession);

      const result = await sessionService.updateContext(
        { siteCode: 'site-b', currency: 'EUR' },
        { expectedVersion: 7 },
      );

      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledTimes(1);
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledWith({
        siteCode: 'site-b',
        currency: 'EUR',
        metadata: { version: 7 },
      });
      // No pre-PATCH read, only one post-PATCH read for the canonical shape.
      expect(mockSessionContextApi.getOwnSessionContext).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockSession);
    });

    it('should pre-PATCH GET and merge existing context attributes when the patch touches context (e.g. region)', async () => {
      mockSessionContextApi.getOwnSessionContext
        .mockResolvedValueOnce({
          sessionId: 'test-session',
          siteCode: 'site-a',
          currency: 'EUR',
          context: { currentCart: 'cart-123', language: 'en' },
          metadata: { version: 8 },
        })
        .mockResolvedValueOnce({
          sessionId: 'test-session',
          siteCode: 'site-b',
          currency: 'EUR',
          metadata: { version: 9 },
        });
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();
      mockSessionMapper.mapToService.mockReturnValue(mockSession);

      await sessionService.updateContext(
        { siteCode: 'site-b', currency: 'EUR', region: 'DACH' },
        { expectedVersion: 7 },
      );

      // Pre-PATCH GET is forced because the patch includes `region`, which is
      // still stored inside `context` (`language` moved to top-level in the
      // 2026-04-21 BE change, but `region` remains a custom context field).
      // Existing context attributes (`currentCart`, `language`) must survive
      // the merge because `PATCH /me/context` replaces the whole `context`.
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledWith({
        siteCode: 'site-b',
        currency: 'EUR',
        context: { currentCart: 'cart-123', language: 'en', region: 'DACH' },
        metadata: { version: 8 },
      });
    });

    it('should send top-level language (no context merge) in a single PATCH after one GET', async () => {
      mockSessionContextApi.getOwnSessionContext.mockResolvedValueOnce({
        sessionId: 'test-session',
        siteCode: 'site-a',
        metadata: { version: 3 },
      });
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();
      mockSessionMapper.mapToService.mockReturnValue(mockSession);

      await sessionService.updateContext({ language: 'fr' });

      // One GET (because no `expectedVersion` was provided) and one PATCH.
      // Language must be top-level — not nested under `context` — since the
      // 2026-04-21 BE changelog promoted it to a first-class field.
      expect(mockSessionContextApi.getOwnSessionContext).toHaveBeenCalledTimes(1);
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledWith({
        language: 'fr',
        metadata: { version: 3 },
      });
      expect(mockSessionContextApi.removeOwnSessionContextAttribute).not.toHaveBeenCalled();
    });

    it('should skip the pre-PATCH GET when only top-level fields (e.g. language) change and expectedVersion is provided', async () => {
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();
      // updateContext returns the canonical Session by issuing a single GET
      // after the PATCH when no `initialSession` is available. That's a
      // separate code path — assert the PATCH shape, not the call count.
      mockSessionContextApi.getOwnSessionContext.mockResolvedValue({
        sessionId: 'test-session',
        siteCode: 'site-a',
        language: 'de',
        metadata: { version: 11 },
      });
      mockSessionMapper.mapToService.mockReturnValue(mockSession);

      const invocationOrder: string[] = [];
      mockSessionContextApi.getOwnSessionContext.mockImplementation(async () => {
        invocationOrder.push('GET');
        return { sessionId: 'test-session', siteCode: 'site-a', language: 'de', metadata: { version: 11 } };
      });
      mockSessionContextApi.updateOwnSessionContext.mockImplementation(async () => {
        invocationOrder.push('PATCH');
      });

      await sessionService.updateContext({ language: 'de' }, { expectedVersion: 10 });

      // No `region`/context patch → the pre-fetch GET is skipped. The PATCH
      // therefore uses the caller-supplied `expectedVersion` directly.
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledWith({
        language: 'de',
        metadata: { version: 10 },
      });
      // PATCH must come before any GET — proving we did NOT pre-fetch.
      expect(invocationOrder[0]).toBe('PATCH');
    });

    it('should retry exactly once on version conflict and rethrow on second failure', async () => {
      mockSessionContextApi.getOwnSessionContext.mockResolvedValueOnce({
        sessionId: 'test-session',
        siteCode: 'site-a',
        metadata: { version: 9 },
      });
      mockSessionContextApi.updateOwnSessionContext
        .mockRejectedValueOnce(
          new Error(
            'Failed to update own session context: Not Found - {"message":"The context with sessionId test-session and version 5 has not been found."}',
          ),
        )
        .mockResolvedValueOnce();
      mockSessionMapper.mapToService.mockReturnValue(mockSession);

      await sessionService.updateContext({ siteCode: 'site-b' }, { expectedVersion: 5 });

      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledTimes(2);
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenNthCalledWith(1, {
        siteCode: 'site-b',
        metadata: { version: 5 },
      });
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenNthCalledWith(2, {
        siteCode: 'site-b',
        metadata: { version: 9 },
      });
    });
  });

  describe('clearCart', () => {
    it('should call removeOwnSessionContextAttribute with currentCart', async () => {
      mockSessionContextApi.removeOwnSessionContextAttribute.mockResolvedValue();

      await sessionService.clearCart();

      expect(mockSessionContextApi.removeOwnSessionContextAttribute).toHaveBeenCalledTimes(1);
      expect(mockSessionContextApi.removeOwnSessionContextAttribute).toHaveBeenCalledWith('currentCart');
    });

    it('should not throw when attribute does not exist (404)', async () => {
      mockSessionContextApi.removeOwnSessionContextAttribute.mockRejectedValue(new Error('Not Found'));

      await expect(sessionService.clearCart()).resolves.not.toThrow();
    });

    it('should log unexpected errors but not throw', async () => {
      mockSessionContextApi.removeOwnSessionContextAttribute.mockRejectedValue(new Error('Internal Server Error'));

      await expect(sessionService.clearCart()).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: 'Internal Server Error' },
        'Failed to clear cart from session context',
      );
    });
  });

  describe('adjustSessionsSettings - site currency validation', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_DEFAULT_SITE = 'main';
      process.env.NEXT_PUBLIC_AVAILABLE_SITES = 'main';
      process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE = 'en';
      process.env.NEXT_PUBLIC_DEFAULT_COUNTRY = 'DE';
      process.env.NEXT_PUBLIC_DEFAULT_REGION = 'Europe';
    });

    afterEach(() => {
      delete process.env.NEXT_PUBLIC_DEFAULT_SITE;
      delete process.env.NEXT_PUBLIC_AVAILABLE_SITES;
      delete process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE;
      delete process.env.NEXT_PUBLIC_DEFAULT_COUNTRY;
      delete process.env.NEXT_PUBLIC_DEFAULT_REGION;
    });

    it('should call getSite when all session fields are present to validate currency on site', async () => {
      const fullyPopulatedContext: EmporixSessionContext = {
        sessionId: 'test-session',
        currency: 'EUR',
        siteCode: 'main',
        targetLocation: 'DE',
        context: {
          language: { key: 'language', value: 'en' },
          region: { key: 'region', value: 'Europe' },
        },
      };
      const mappedSession: Session = {
        id: 'test-session',
        currency: 'EUR',
        siteCode: 'main',
        country: 'DE',
        language: 'en',
        region: 'Europe',
      };

      mockSessionContextApi.getOwnSessionContext.mockResolvedValue(fullyPopulatedContext);
      mockSessionMapper.mapToService.mockReturnValue(mappedSession);
      mockSiteService.getSite.mockResolvedValue({
        code: 'main',
        name: 'Main',
        defaultCountry: 'DE',
        defaultCurrency: { id: 'EUR', code: 'EUR', name: 'Euro', active: true },
        currencies: [{ id: 'EUR', code: 'EUR', name: 'Euro', active: true }],
        countries: [],
        shipToCountries: [],
        regions: [],
        paymentModes: [],
        languages: ['en'],
        defaultLanguage: 'en',
        address: { contactName: '', street: '', zipCode: '', city: '', country: 'DE' },
        includesTax: false,
        decimals: 2,
      });

      const result = await sessionService.getCurrent();

      expect(result).toBeDefined();
      expect(result?.currency).toBe('EUR');
      expect(mockSiteService.getSite).toHaveBeenCalledWith('main');
      expect(mockSessionContextApi.updateOwnSessionContext).not.toHaveBeenCalled();
    });

    it('should patch currency when session is fully populated but currency is not on site', async () => {
      const fullyPopulatedContext: EmporixSessionContext = {
        sessionId: 'test-session',
        currency: 'EUR',
        siteCode: 'ch-site',
        targetLocation: 'DE',
        context: {
          language: { key: 'language', value: 'en' },
          region: { key: 'region', value: 'Europe' },
        },
        metadata: { version: 2 },
      };
      const mappedSession: Session = {
        id: 'test-session',
        currency: 'EUR',
        siteCode: 'ch-site',
        country: 'DE',
        language: 'en',
        region: 'Europe',
      };

      mockSessionContextApi.getOwnSessionContext.mockResolvedValue(fullyPopulatedContext);
      mockSessionMapper.mapToService.mockReturnValue(mappedSession);
      mockSiteService.getSite.mockResolvedValue({
        code: 'ch-site',
        name: 'CH',
        defaultCountry: 'CH',
        defaultCurrency: { id: 'CHF', code: 'CHF', name: 'Franc', active: true },
        currencies: [{ id: 'CHF', code: 'CHF', name: 'Franc', active: true }],
        countries: [],
        shipToCountries: [],
        regions: [],
        paymentModes: [],
        languages: ['en'],
        defaultLanguage: 'en',
        address: { contactName: '', street: '', zipCode: '', city: '', country: 'CH' },
        includesTax: false,
        decimals: 2,
      });
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();

      const result = await sessionService.getCurrent();

      expect(result).toBeDefined();
      expect(result?.currency).toBe('CHF');
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalled();
    });

    it('should call getSite when region is missing from session', async () => {
      const missingRegionContext: EmporixSessionContext = {
        sessionId: 'test-session',
        currency: 'EUR',
        siteCode: 'main',
        targetLocation: 'DE',
        language: 'en',
      };
      const mappedSession: Session = {
        id: 'test-session',
        currency: 'EUR',
        siteCode: 'main',
        country: 'DE',
        language: 'en',
      };

      mockSessionContextApi.getOwnSessionContext.mockResolvedValue(missingRegionContext);
      mockSessionMapper.mapToService.mockReturnValue(mappedSession);
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();
      mockSiteService.getSite.mockResolvedValue({
        code: 'main',
        name: 'Main',
        defaultCountry: 'DE',
        defaultCurrency: { id: 'EUR', code: 'EUR', name: 'Euro', active: true },
        currencies: [{ id: 'EUR', code: 'EUR', name: 'Euro', active: true }],
        countries: [],
        shipToCountries: [],
        regions: [],
        paymentModes: [],
        languages: ['en'],
        defaultLanguage: 'en',
        address: { contactName: '', street: '', zipCode: '', city: '', country: 'DE' },
        includesTax: false,
        decimals: 2,
      });

      const result = await sessionService.getCurrent();

      expect(result).toBeDefined();
      expect(mockSiteService.getSite).toHaveBeenCalledWith('main');
    });

    it('should seed the default language as a top-level field when language is missing', async () => {
      // 2026-04-21 BE change: `language` is a first-class field, so the
      // default-language seed must go to the top of the PATCH payload rather
      // than under `context.language`.
      const missingLanguageContext: EmporixSessionContext = {
        sessionId: 'test-session',
        currency: 'EUR',
        siteCode: 'main',
        targetLocation: 'DE',
        context: { region: 'Europe' },
        metadata: { version: 2 },
      };
      const mappedSession: Session = {
        id: 'test-session',
        currency: 'EUR',
        siteCode: 'main',
        country: 'DE',
        region: 'Europe',
      };

      // The service captures `defaultLanguage` from env in its class-field
      // initializer during the outer `beforeEach`, which ran before this
      // describe's `beforeEach` overrode the env var. Pin the default
      // directly on the instance so the default-seeding branch is exercised
      // deterministically.
      (sessionService as unknown as { defaultLanguage: string }).defaultLanguage = 'en';

      mockSessionContextApi.getOwnSessionContext.mockResolvedValue(missingLanguageContext);
      mockSessionMapper.mapToService.mockReturnValue(mappedSession);
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();
      mockSiteService.getSite.mockResolvedValue({
        code: 'main',
        name: 'Main',
        defaultCountry: 'DE',
        defaultCurrency: { id: 'EUR', code: 'EUR', name: 'Euro', active: true },
        currencies: [{ id: 'EUR', code: 'EUR', name: 'Euro', active: true }],
        countries: [],
        shipToCountries: [],
        regions: [],
        paymentModes: [],
        languages: ['en'],
        defaultLanguage: 'en',
        address: { contactName: '', street: '', zipCode: '', city: '', country: 'DE' },
        includesTax: false,
        decimals: 2,
      });

      const result = await sessionService.getCurrent();

      expect(result?.language).toBe('en');
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledTimes(1);
      const [patchCall] = mockSessionContextApi.updateOwnSessionContext.mock.calls[0];
      expect(patchCall).toMatchObject({ language: 'en' });
      // Language must NOT be written under `context` (legacy placement).
      expect((patchCall?.context as Record<string, unknown> | undefined)?.language).toBeUndefined();
    });
  });
});
