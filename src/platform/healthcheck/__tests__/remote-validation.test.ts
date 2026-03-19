import type { EmporixCurrencyApi } from '@/platform/integrations/emporix/currency/EmporixCurrencyApi';
import type { EmporixCurrency } from '@/platform/integrations/emporix/model/currency';
import type { EmporixSite } from '@/platform/integrations/emporix/model/site-settings';
import type { EmporixSiteSettingsApi } from '@/platform/integrations/emporix/site-settings/EmporixSiteSettingsApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { validateRemoteConfig } from '../remote-validation';

function createMockLogger(): jest.Mocked<LoggerService> {
  return {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(),
  } as unknown as jest.Mocked<LoggerService>;
}

function createMockSiteSettingsApi(
  siteMap: Record<string, EmporixSite | null>,
): jest.Mocked<Pick<EmporixSiteSettingsApi, 'getSite'>> {
  return {
    getSite: jest.fn((code: string) => Promise.resolve(siteMap[code] ?? null)),
  };
}

function createMockCurrencyApi(currencies: EmporixCurrency[]): jest.Mocked<Pick<EmporixCurrencyApi, 'getCurrencies'>> {
  return {
    getCurrencies: jest.fn(() => Promise.resolve(currencies)),
  };
}

const EUR: EmporixCurrency = { code: 'EUR', name: 'Euro' };
const USD: EmporixCurrency = { code: 'USD', name: 'US Dollar' };

const mainSite: EmporixSite = {
  code: 'main',
  currency: 'EUR',
  languages: ['en', 'de'],
};

const secondarySite: EmporixSite = {
  code: 'secondary',
  currency: 'USD',
  languages: ['en'],
};

describe('validateRemoteConfig', () => {
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  it('should return no warnings when all sites exist, currencies match, and languages match', async () => {
    const siteSettingsApi = createMockSiteSettingsApi({ main: mainSite, secondary: secondarySite });
    const currencyApi = createMockCurrencyApi([EUR, USD]);

    const result = await validateRemoteConfig({
      siteSettingsApi: siteSettingsApi as unknown as EmporixSiteSettingsApi,
      currencyApi: currencyApi as unknown as EmporixCurrencyApi,
      configuredSites: ['main', 'secondary'],
      defaultCurrency: 'EUR',
      configuredLocales: ['en', 'de'],
      logger: mockLogger,
    });

    expect(result.tier).toBe('remote');
    expect(result.hasErrors).toBe(false);
    expect(result.hasWarnings).toBe(false);
    expect(result.items.every((i) => i.passed)).toBe(true);
  });

  it('should return an error when a site does not exist (getSite returns null)', async () => {
    const siteSettingsApi = createMockSiteSettingsApi({ main: mainSite, missing: null });
    const currencyApi = createMockCurrencyApi([EUR, USD]);

    const result = await validateRemoteConfig({
      siteSettingsApi: siteSettingsApi as unknown as EmporixSiteSettingsApi,
      currencyApi: currencyApi as unknown as EmporixCurrencyApi,
      configuredSites: ['main', 'missing'],
      defaultCurrency: 'EUR',
      configuredLocales: ['en', 'de'],
      logger: mockLogger,
    });

    expect(result.hasErrors).toBe(true);
    const missingItem = result.items.find((i) => i.name === 'site:missing');
    expect(missingItem).toBeDefined();
    expect(missingItem!.passed).toBe(false);
    expect(missingItem!.severity).toBe('error');
    expect(missingItem!.message).toContain('not found');
  });

  it('should return an error when default currency is not in tenant currencies', async () => {
    const siteSettingsApi = createMockSiteSettingsApi({ main: mainSite });
    const currencyApi = createMockCurrencyApi([EUR]);

    const result = await validateRemoteConfig({
      siteSettingsApi: siteSettingsApi as unknown as EmporixSiteSettingsApi,
      currencyApi: currencyApi as unknown as EmporixCurrencyApi,
      configuredSites: ['main'],
      defaultCurrency: 'GBP',
      configuredLocales: ['en', 'de'],
      logger: mockLogger,
    });

    expect(result.hasErrors).toBe(true);
    const currencyItem = result.items.find((i) => i.name === 'currency:GBP');
    expect(currencyItem).toBeDefined();
    expect(currencyItem!.passed).toBe(false);
    expect(currencyItem!.severity).toBe('error');
    expect(currencyItem!.message).toContain('not found');
  });

  it('should return an error when site currency is not in tenant currencies', async () => {
    const siteWithBadCurrency: EmporixSite = { code: 'bad', currency: 'GBP', languages: ['en'] };
    const siteSettingsApi = createMockSiteSettingsApi({ bad: siteWithBadCurrency });
    const currencyApi = createMockCurrencyApi([EUR, USD]);

    const result = await validateRemoteConfig({
      siteSettingsApi: siteSettingsApi as unknown as EmporixSiteSettingsApi,
      currencyApi: currencyApi as unknown as EmporixCurrencyApi,
      configuredSites: ['bad'],
      defaultCurrency: 'EUR',
      configuredLocales: ['en'],
      logger: mockLogger,
    });

    expect(result.hasErrors).toBe(true);
    const item = result.items.find((i) => i.name === 'site:bad:currency');
    expect(item).toBeDefined();
    expect(item!.passed).toBe(false);
    expect(item!.severity).toBe('error');
    expect(item!.message).toContain('GBP');
    expect(item!.message).toContain('not found');
  });

  it('should return an error when site language is not in i18n locales', async () => {
    const siteWithExtraLang: EmporixSite = { code: 'main', currency: 'EUR', languages: ['en', 'de', 'fr'] };
    const siteSettingsApi = createMockSiteSettingsApi({ main: siteWithExtraLang });
    const currencyApi = createMockCurrencyApi([EUR]);

    const result = await validateRemoteConfig({
      siteSettingsApi: siteSettingsApi as unknown as EmporixSiteSettingsApi,
      currencyApi: currencyApi as unknown as EmporixCurrencyApi,
      configuredSites: ['main'],
      defaultCurrency: 'EUR',
      configuredLocales: ['en', 'de'],
      logger: mockLogger,
    });

    expect(result.hasErrors).toBe(true);
    const langItem = result.items.find((i) => i.name === 'site:main:languages');
    expect(langItem).toBeDefined();
    expect(langItem!.passed).toBe(false);
    expect(langItem!.severity).toBe('error');
    expect(langItem!.message).toContain('fr');
  });

  it('should handle API errors gracefully with a single warning about unreachable API', async () => {
    const siteSettingsApi = createMockSiteSettingsApi({});
    const currencyApi: jest.Mocked<Pick<EmporixCurrencyApi, 'getCurrencies'>> = {
      getCurrencies: jest.fn(() => Promise.reject(new Error('Network error'))),
    };

    const result = await validateRemoteConfig({
      siteSettingsApi: siteSettingsApi as unknown as EmporixSiteSettingsApi,
      currencyApi: currencyApi as unknown as EmporixCurrencyApi,
      configuredSites: ['main'],
      defaultCurrency: 'EUR',
      configuredLocales: ['en', 'de'],
      logger: mockLogger,
    });

    expect(result.hasWarnings).toBe(true);
    expect(result.hasErrors).toBe(false);
    const apiItem = result.items.find((i) => i.name === 'api-connectivity');
    expect(apiItem).toBeDefined();
    expect(apiItem!.passed).toBe(false);
    expect(apiItem!.message).toContain('API unreachable');
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });

  it('should return no site checks and no errors when configuredSites is empty', async () => {
    const siteSettingsApi = createMockSiteSettingsApi({});
    const currencyApi = createMockCurrencyApi([EUR]);

    const result = await validateRemoteConfig({
      siteSettingsApi: siteSettingsApi as unknown as EmporixSiteSettingsApi,
      currencyApi: currencyApi as unknown as EmporixCurrencyApi,
      configuredSites: [],
      defaultCurrency: 'EUR',
      configuredLocales: ['en', 'de'],
      logger: mockLogger,
    });

    expect(result.hasErrors).toBe(false);
    expect(result.hasWarnings).toBe(false);
    // Only the default currency check should be present
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('currency:EUR');
    expect(result.items[0].passed).toBe(true);
  });

  it('should report multiple failures individually', async () => {
    const siteSettingsApi = createMockSiteSettingsApi({ main: null, secondary: null });
    const currencyApi = createMockCurrencyApi([EUR]);

    const result = await validateRemoteConfig({
      siteSettingsApi: siteSettingsApi as unknown as EmporixSiteSettingsApi,
      currencyApi: currencyApi as unknown as EmporixCurrencyApi,
      configuredSites: ['main', 'secondary'],
      defaultCurrency: 'GBP',
      configuredLocales: ['en'],
      logger: mockLogger,
    });

    expect(result.hasErrors).toBe(true);
    const failedItems = result.items.filter((i) => !i.passed);
    // GBP not in currencies + main not found + secondary not found = 3 failures
    expect(failedItems).toHaveLength(3);
    expect(failedItems.every((i) => i.severity === 'error')).toBe(true);
    expect(failedItems.map((i) => i.name)).toEqual(
      expect.arrayContaining(['currency:GBP', 'site:main', 'site:secondary']),
    );
  });
});
