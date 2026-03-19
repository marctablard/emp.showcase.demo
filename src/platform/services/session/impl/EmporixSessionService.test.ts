import { Container } from 'inversify';
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

  describe('addAttributeToCurrentSession', () => {
    it('should map the attribute and call addOwnSessionContextAttribute on the SessionContextApi', async () => {
      const mockSessionAttribute: EmporixContextAttribute = {
        key: 'language',
        value: 'en',
      };
      sessionService.setLanguage('en');
      expect(mockSessionContextApi.addOwnSessionContextAttribute).toHaveBeenCalledTimes(1);
      expect(mockSessionContextApi.addOwnSessionContextAttribute).toHaveBeenCalledWith(mockSessionAttribute);
    });
  });

  describe('setSite', () => {
    it('should clear currentCart BEFORE updating siteCode when site changes', async () => {
      // Arrange
      const callOrder: string[] = [];
      mockSessionContextApi.getOwnSessionContext.mockResolvedValue({
        sessionId: 'test-session',
        siteCode: 'site-a',
        metadata: { version: 1 },
      });
      mockSessionContextApi.getOwnSessionContext.mockResolvedValueOnce({
        sessionId: 'test-session',
        siteCode: 'site-a',
        metadata: { version: 1 },
      });
      mockSessionContextApi.getOwnSessionContext.mockResolvedValueOnce({
        sessionId: 'test-session',
        siteCode: 'site-a',
        metadata: { version: 1 },
      });
      mockSessionContextApi.removeOwnSessionContextAttribute.mockImplementation(async () => {
        callOrder.push('removeOwnSessionContextAttribute');
      });
      mockSessionContextApi.updateOwnSessionContext.mockImplementation(async () => {
        callOrder.push('updateOwnSessionContext');
      });

      // Act
      await sessionService.setSite('site-b', 'EUR');

      // Assert — cartId cleared BEFORE siteCode update to prevent race condition
      expect(callOrder).toEqual(['removeOwnSessionContextAttribute', 'updateOwnSessionContext']);
      expect(mockSessionContextApi.removeOwnSessionContextAttribute).toHaveBeenCalledWith('currentCart');
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledWith({
        siteCode: 'site-b',
        currency: 'EUR',
        metadata: { version: 1 },
      });
    });

    it('should clear currentCart and reset currency when site changes with defaultCurrency', async () => {
      // Arrange
      mockSessionContextApi.getOwnSessionContext.mockResolvedValue({
        sessionId: 'test-session',
        siteCode: 'site-a', // Current site
        metadata: { version: 1 },
      });
      mockSessionContextApi.getOwnSessionContext.mockResolvedValueOnce({
        sessionId: 'test-session',
        siteCode: 'site-a',
        metadata: { version: 1 },
      });
      mockSessionContextApi.getOwnSessionContext.mockResolvedValueOnce({
        sessionId: 'test-session',
        siteCode: 'site-a',
        metadata: { version: 1 },
      });
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();
      mockSessionContextApi.removeOwnSessionContextAttribute.mockResolvedValue();

      // Act
      await sessionService.setSite('site-b', 'EUR'); // New site with default currency

      // Assert — single atomic PATCH includes both siteCode and currency
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledWith({
        siteCode: 'site-b',
        currency: 'EUR',
        metadata: { version: 1 },
      });
      expect(mockSessionContextApi.removeOwnSessionContextAttribute).toHaveBeenCalledWith('currentCart');
    });

    it('should NOT include currency in PATCH when site is set to same value', async () => {
      // Arrange
      mockSessionContextApi.getOwnSessionContext.mockResolvedValue({
        sessionId: 'test-session',
        siteCode: 'site-a',
        metadata: { version: 1 },
      });
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();

      // Act
      await sessionService.setSite('site-a', 'EUR'); // Same site

      // Assert — currency should NOT be included since site didn't change
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledWith({
        siteCode: 'site-a',
        metadata: { version: 1 },
      });
      expect(mockSessionContextApi.removeOwnSessionContextAttribute).not.toHaveBeenCalled();
    });

    it('should NOT clear currentCart when session has no siteCode set initially', async () => {
      // Arrange - session exists but no siteCode yet (first time setting site)
      mockSessionContextApi.getOwnSessionContext.mockResolvedValue({
        sessionId: 'test-session',
        metadata: { version: 1 },
      });
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();

      // Act
      await sessionService.setSite('site-a', 'EUR');

      // Assert — first-time site set: siteChanged is false, so no currency reset
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledWith({
        siteCode: 'site-a',
        metadata: { version: 1 },
      });
      expect(mockSessionContextApi.removeOwnSessionContextAttribute).not.toHaveBeenCalled();
    });

    it('should not update currency when defaultCurrency is not provided (backward compatibility)', async () => {
      // Arrange
      mockSessionContextApi.getOwnSessionContext.mockResolvedValue({
        sessionId: 'test-session',
        siteCode: 'site-a',
        metadata: { version: 1 },
      });
      mockSessionContextApi.getOwnSessionContext.mockResolvedValueOnce({
        sessionId: 'test-session',
        siteCode: 'site-a',
        metadata: { version: 1 },
      });
      mockSessionContextApi.getOwnSessionContext.mockResolvedValueOnce({
        sessionId: 'test-session',
        siteCode: 'site-a',
        metadata: { version: 1 },
      });
      mockSessionContextApi.updateOwnSessionContext.mockResolvedValue();
      mockSessionContextApi.removeOwnSessionContextAttribute.mockResolvedValue();

      // Act — no defaultCurrency argument
      await sessionService.setSite('site-b');

      // Assert — PATCH only contains siteCode, no currency
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenCalledWith({
        siteCode: 'site-b',
        metadata: { version: 1 },
      });
      expect(mockSessionContextApi.removeOwnSessionContextAttribute).toHaveBeenCalledWith('currentCart');
    });

    it('should retry once with refreshed version when first PATCH fails with version conflict', async () => {
      mockSessionContextApi.getOwnSessionContext
        .mockResolvedValueOnce({
          sessionId: 'test-session',
          siteCode: 'site-a',
          metadata: { version: 3 },
        })
        .mockResolvedValueOnce({
          sessionId: 'test-session',
          siteCode: 'site-a',
          metadata: { version: 4 },
        })
        .mockResolvedValueOnce({
          sessionId: 'test-session',
          siteCode: 'site-a',
          metadata: { version: 5 },
        });
      mockSessionContextApi.removeOwnSessionContextAttribute.mockResolvedValue();
      mockSessionContextApi.updateOwnSessionContext
        .mockRejectedValueOnce(
          new Error(
            'Failed to update own session context: Not Found - {"message":"The context with sessionId test-session and version 4 has not been found."}',
          ),
        )
        .mockResolvedValueOnce();

      await sessionService.setSite('site-b', 'EUR');

      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenNthCalledWith(1, {
        siteCode: 'site-b',
        currency: 'EUR',
        metadata: { version: 4 },
      });
      expect(mockSessionContextApi.updateOwnSessionContext).toHaveBeenNthCalledWith(2, {
        siteCode: 'site-b',
        currency: 'EUR',
        metadata: { version: 5 },
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        {
          site: 'site-b',
          previousVersion: 4,
          retryVersion: 5,
        },
        'Retrying session site update after version conflict',
      );
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
          metadata: { version: 3 },
        })
        .mockResolvedValueOnce({
          sessionId: 'test-session',
          siteCode: 'site-a',
          metadata: { version: 4 },
        });
      mockSessionContextApi.removeOwnSessionContextAttribute.mockResolvedValue();
      mockSessionContextApi.updateOwnSessionContext
        .mockRejectedValueOnce(
          new Error(
            'Failed to update own session context: Not Found - {"message":"The context with sessionId test-session and version 3 has not been found."}',
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
});
