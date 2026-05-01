import { Container } from 'inversify';
import type { EmporixCountryApi } from '@/platform/integrations/emporix/country/EmporixCountryApi';
import type { EmporixCurrencyApi } from '@/platform/integrations/emporix/currency/EmporixCurrencyApi';
import { EmporixCountry, EmporixCurrency } from '@/platform/integrations/emporix/model';
import { EmporixSite } from '@/platform/integrations/emporix/model/site-settings';
import type { EmporixSiteSettingsApi } from '@/platform/integrations/emporix/site-settings/EmporixSiteSettingsApi';
import { PaymentMode } from '@/platform/services/model/payment';
import type { PaymentService } from '@/platform/services/payment/PaymentService';
import { LoggerService } from '../../logger/LoggerService';
import EmporixSiteService from './EmporixSiteService';

describe('EmporixSiteService', () => {
  let container: Container;
  let siteService: EmporixSiteService;
  let mockSiteSettingsApi: jest.Mocked<EmporixSiteSettingsApi>;
  let mockCountryApi: jest.Mocked<EmporixCountryApi>;
  let mockCurrencyApi: jest.Mocked<EmporixCurrencyApi>;
  let mockPaymentService: jest.Mocked<PaymentService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  const mockSite: EmporixSite = {
    code: 'main',
    name: 'Main Site',
    default: true,
    currency: 'USD',
    defaultLanguage: 'en',
    languages: ['en'],
    includesTax: false,
    cartCalculationScale: 2,
  };

  const mockCurrencies: EmporixCurrency[] = [
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
  ];

  const mockCountries: EmporixCountry[] = [
    { code: 'US', name: 'United States', active: true },
    { code: 'DE', name: 'Germany', active: true },
  ];

  const mockPaymentModes: PaymentMode[] = [{ id: 'credit-card', code: 'credit-card', active: true }];

  beforeEach(() => {
    delete (globalThis as Record<string, unknown>)['__emporix_site_cache'];
    container = new Container();
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Create mocks
    mockSiteSettingsApi = {
      getSites: jest.fn(),
      getSite: jest.fn(),
      getSiteCodes: jest.fn(),
    };

    mockCountryApi = {
      getCountries: jest.fn(),
      getCountry: jest.fn(),
      getRegions: jest.fn(),
      getRegion: jest.fn(),
    };

    mockCurrencyApi = {
      getCurrencies: jest.fn(),
      getCurrency: jest.fn(),
      getExchangeRates: jest.fn(),
      getExchangeRate: jest.fn(),
    };

    mockPaymentService = {
      getPaymentModes: jest.fn(),
      getPaymentMode: jest.fn(),
    };
    mockLoggerService = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    };

    // Register mocks
    container.bind<EmporixSiteSettingsApi>('EmporixSiteSettingsApi').toConstantValue(mockSiteSettingsApi);
    container.bind<EmporixCountryApi>('EmporixCountryApi').toConstantValue(mockCountryApi);
    container.bind<EmporixCurrencyApi>('EmporixCurrencyApi').toConstantValue(mockCurrencyApi);
    container.bind<PaymentService>('PaymentService').toConstantValue(mockPaymentService);
    container.bind<EmporixSiteService>('SiteService').to(EmporixSiteService);
    container.bind<LoggerService>('LoggerService').toConstantValue(mockLoggerService);

    // Get service instance
    siteService = container.get<EmporixSiteService>('SiteService');

    // Setup default mock responses
    mockCountryApi.getCountries.mockResolvedValue(mockCountries);
    mockCountryApi.getRegions.mockResolvedValue([]);
    mockCurrencyApi.getCurrencies.mockResolvedValue(mockCurrencies);
    mockPaymentService.getPaymentModes.mockResolvedValue(mockPaymentModes);
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_DEFAULT_SITE = 'main';
    process.env.NEXT_PUBLIC_DEFAULT_CURRENCY = 'EUR';
    process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE = 'en';
    process.env.NEXT_PUBLIC_DEFAULT_COUNTRY = 'DE';
    process.env.NEXT_PUBLIC_DEFAULT_REGION = 'Europe';
    process.env.NEXT_PUBLIC_EMPORIX_DEFAULT_UNIT_CODE = 'piece';
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('invalidateSiteCache', () => {
    it('should refetch Emporix after invalidating a site code', async () => {
      mockSiteSettingsApi.getSite.mockResolvedValue(mockSite);
      await siteService.getSite('main');
      expect(mockSiteSettingsApi.getSite).toHaveBeenCalledTimes(1);
      siteService.invalidateSiteCache('main');
      await siteService.getSite('main');
      expect(mockSiteSettingsApi.getSite).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSite - recursion prevention', () => {
    it('should prevent recursion when NEXT_PUBLIC_DEFAULT_SITE equals requested code', async () => {
      // Setup
      process.env.NEXT_PUBLIC_DEFAULT_SITE = 'invalid-site';
      mockSiteSettingsApi.getSite.mockResolvedValue(null);

      // Execute
      const result = await siteService.getSite('invalid-site');

      // Assert
      expect(result).toBeNull();
      expect(mockSiteSettingsApi.getSite).toHaveBeenCalledTimes(1);
      expect(mockSiteSettingsApi.getSite).toHaveBeenCalledWith('invalid-site');
    });

    it('should prevent recursion when default site has already been tried', async () => {
      // Setup
      process.env.NEXT_PUBLIC_DEFAULT_SITE = 'default-site';
      mockSiteSettingsApi.getSite.mockResolvedValue(null);

      // Execute - first call with invalid site, then with default site (hasTriedDefaultSite = true)
      const result = await siteService.getSite('invalid-site', true);

      // Assert
      expect(result).toBeNull();
      expect(mockSiteSettingsApi.getSite).toHaveBeenCalledTimes(1);
      expect(mockSiteSettingsApi.getSite).toHaveBeenCalledWith('invalid-site');
    });

    it('should return null when both requested and default sites fail', async () => {
      // Setup
      process.env.NEXT_PUBLIC_DEFAULT_SITE = 'default-site';
      mockSiteSettingsApi.getSite.mockResolvedValue(null);

      // Execute
      const result = await siteService.getSite('invalid-site');

      // Assert
      expect(result).toBeNull();
      // Should try invalid-site first, then default-site
      expect(mockSiteSettingsApi.getSite).toHaveBeenCalledTimes(2);
      expect(mockSiteSettingsApi.getSite).toHaveBeenNthCalledWith(1, 'invalid-site');
      expect(mockSiteSettingsApi.getSite).toHaveBeenNthCalledWith(2, 'default-site');
    });

    it('should successfully fall back to default site when requested site fails', async () => {
      // Setup
      process.env.NEXT_PUBLIC_DEFAULT_SITE = 'default-site';
      mockSiteSettingsApi.getSite
        .mockResolvedValueOnce(null) // First call for 'invalid-site'
        .mockResolvedValueOnce(mockSite); // Second call for 'default-site'

      // Execute
      const result = await siteService.getSite('invalid-site');

      // Assert
      expect(result).not.toBeNull();
      expect(result?.code).toBe('main');
      expect(mockSiteSettingsApi.getSite).toHaveBeenCalledTimes(2);
      expect(mockSiteSettingsApi.getSite).toHaveBeenNthCalledWith(1, 'invalid-site');
      expect(mockSiteSettingsApi.getSite).toHaveBeenNthCalledWith(2, 'default-site');
    });

    it('should work correctly when NEXT_PUBLIC_DEFAULT_SITE is undefined', async () => {
      // Setup
      delete process.env.NEXT_PUBLIC_DEFAULT_SITE;
      mockSiteSettingsApi.getSite.mockResolvedValue(null);

      // Execute
      const result = await siteService.getSite('invalid-site');

      // Assert
      expect(result).toBeNull();
      expect(mockSiteSettingsApi.getSite).toHaveBeenCalledTimes(1);
      expect(mockSiteSettingsApi.getSite).toHaveBeenCalledWith('invalid-site');
    });

    it('should work correctly when NEXT_PUBLIC_DEFAULT_SITE is empty string', async () => {
      // Setup
      process.env.NEXT_PUBLIC_DEFAULT_SITE = '';
      mockSiteSettingsApi.getSite.mockResolvedValue(null);

      // Execute
      const result = await siteService.getSite('invalid-site');

      // Assert
      expect(result).toBeNull();
      expect(mockSiteSettingsApi.getSite).toHaveBeenCalledTimes(1);
      expect(mockSiteSettingsApi.getSite).toHaveBeenCalledWith('invalid-site');
    });

    it('should not attempt fallback when requested site is found', async () => {
      // Setup
      process.env.NEXT_PUBLIC_DEFAULT_SITE = 'default-site';
      mockSiteSettingsApi.getSite.mockResolvedValue(mockSite);

      // Execute
      const result = await siteService.getSite('main');

      // Assert
      expect(result).not.toBeNull();
      expect(result?.code).toBe('main');
      expect(mockSiteSettingsApi.getSite).toHaveBeenCalledTimes(1);
      expect(mockSiteSettingsApi.getSite).toHaveBeenCalledWith('main');
    });
  });

  describe('getAvailableSites - bulk fetch', () => {
    const secondSite: EmporixSite = {
      code: 'us-branch',
      name: 'US Branch',
      default: false,
      currency: 'USD',
      defaultLanguage: 'en',
      languages: ['en'],
      includesTax: false,
    };

    beforeEach(() => {
      process.env.NEXT_PUBLIC_AVAILABLE_SITES = 'main,us-branch';
      process.env.NEXT_PUBLIC_DEFAULT_SITE = 'main';
    });

    it('should call getSites once instead of getSite per code', async () => {
      mockSiteSettingsApi.getSites.mockResolvedValue({ items: [mockSite, secondSite], total: 2 });

      const sites = await siteService.getAvailableSites();

      expect(mockSiteSettingsApi.getSites).toHaveBeenCalledTimes(1);
      expect(mockSiteSettingsApi.getSite).not.toHaveBeenCalled();
      expect(sites).toHaveLength(2);
      expect(sites.map((s) => s.code)).toEqual(['main', 'us-branch']);
    });

    it('should filter bulk results to configured codes only', async () => {
      const extraSite: EmporixSite = {
        code: 'other',
        name: 'Other',
        default: false,
        currency: 'EUR',
        languages: ['de'],
      };
      mockSiteSettingsApi.getSites.mockResolvedValue({ items: [mockSite, secondSite, extraSite], total: 3 });

      const sites = await siteService.getAvailableSites();

      expect(sites).toHaveLength(2);
      expect(sites.map((s) => s.code)).toEqual(['main', 'us-branch']);
    });

    it('should not poison getSite cache with incomplete Site objects', async () => {
      mockSiteSettingsApi.getSites.mockResolvedValue({ items: [mockSite], total: 1 });
      mockSiteSettingsApi.getSite.mockResolvedValue(mockSite);
      process.env.NEXT_PUBLIC_AVAILABLE_SITES = 'main';

      await siteService.getAvailableSites();
      const site = await siteService.getSite('main');

      expect(site).not.toBeNull();
      expect(site?.code).toBe('main');
      expect(site?.countries).toHaveLength(2);
      expect(mockSiteSettingsApi.getSite).toHaveBeenCalledWith('main');
    });

    it('should return lightweight sites with empty countries/regions/paymentModes', async () => {
      mockSiteSettingsApi.getSites.mockResolvedValue({ items: [mockSite], total: 1 });
      process.env.NEXT_PUBLIC_AVAILABLE_SITES = 'main';

      const sites = await siteService.getAvailableSites();

      expect(sites[0].countries).toEqual([]);
      expect(sites[0].regions).toEqual([]);
      expect(sites[0].paymentModes).toEqual([]);
      expect(sites[0].currencies).toBeDefined();
    });

    it('should handle empty bulk response gracefully', async () => {
      mockSiteSettingsApi.getSites.mockResolvedValue({ items: [], total: 0 });

      const sites = await siteService.getAvailableSites();

      expect(sites).toEqual([]);
    });

    it('should add default site to configured codes when missing', async () => {
      process.env.NEXT_PUBLIC_AVAILABLE_SITES = 'us-branch';
      process.env.NEXT_PUBLIC_DEFAULT_SITE = 'main';
      mockSiteSettingsApi.getSites.mockResolvedValue({ items: [mockSite, secondSite], total: 2 });

      const sites = await siteService.getAvailableSites();

      expect(sites).toHaveLength(2);
      expect(sites.map((s) => s.code)).toContain('main');
    });
  });
});
