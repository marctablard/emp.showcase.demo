import { inject } from 'inversify';
import { getPublicDefaultLanguage, getPublicDefaultSite } from '@/lib/common/public-default-env';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCountryApi } from '@/platform/integrations/emporix/country/EmporixCountryApi';
import type { EmporixCurrencyApi } from '@/platform/integrations/emporix/currency/EmporixCurrencyApi';
import type { EmporixCountry, EmporixRegion } from '@/platform/integrations/emporix/model/country';
import type { EmporixCurrency, EmporixExchangeRate } from '@/platform/integrations/emporix/model/currency';
import type { EmporixSite } from '@/platform/integrations/emporix/model/site-settings';
import type { EmporixSiteSettingsApi } from '@/platform/integrations/emporix/site-settings/EmporixSiteSettingsApi';
import type { Address, Country, Currency, ExchangeRate, Region } from '@/platform/services/model/common';
import type { LoggerService } from '../../logger/LoggerService';
import type { PaymentMode } from '../../model';
import type { Site } from '../../model/common/site';
import type { PaymentService } from '../../payment/PaymentService';
import type { SiteService } from '../SiteService';

interface TenantReferenceData {
  currencies: Currency[];
  countries: Country[];
  regions: Region[];
  paymentModes: PaymentMode[];
}

interface SiteSharedCache {
  refData: { data: TenantReferenceData; expiresAt: number } | null;
  refDataInflight: Promise<TenantReferenceData> | null;
  site: Map<string, { data: Site; expiresAt: number }>;
  siteInflight: Map<string, Promise<Site | null>>;
}

const SITE_CACHE_KEY = '__emporix_site_cache' as const;

function getSharedSiteCache(): SiteSharedCache {
  const g = globalThis as unknown as Record<string, SiteSharedCache>;
  if (!g[SITE_CACHE_KEY]) {
    g[SITE_CACHE_KEY] = {
      refData: null,
      refDataInflight: null,
      site: new Map(),
      siteInflight: new Map(),
    };
  }
  return g[SITE_CACHE_KEY];
}

/**
 * Implementation of SiteService for Emporix platform
 * Combines functionality from Country, Currency, Shipping, and Payment APIs
 */
@injectable('SiteService', 'Singleton')
class EmporixSiteService implements SiteService {
  private static readonly REF_DATA_TTL_MS = 30_000;
  private static readonly SITE_TTL_MS = 30_000;

  private get _refDataCache() {
    return getSharedSiteCache().refData;
  }
  private set _refDataCache(v: SiteSharedCache['refData']) {
    getSharedSiteCache().refData = v;
  }
  private get _refDataInflight() {
    return getSharedSiteCache().refDataInflight;
  }
  private set _refDataInflight(v: SiteSharedCache['refDataInflight']) {
    getSharedSiteCache().refDataInflight = v;
  }
  private get _siteCache() {
    return getSharedSiteCache().site;
  }
  private get _siteInflight() {
    return getSharedSiteCache().siteInflight;
  }

  constructor(
    @inject('EmporixCountryApi') private countryApi: EmporixCountryApi,
    @inject('EmporixCurrencyApi') private currencyApi: EmporixCurrencyApi,
    @inject('EmporixSiteSettingsApi') private siteSettingsApi: EmporixSiteSettingsApi,
    @inject('PaymentService') private paymentService: PaymentService,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  invalidateSiteCache(code?: string): void {
    if (code !== undefined && code !== '') {
      this._siteCache.delete(code);
      this._siteInflight.delete(code);
      return;
    }
    this._siteCache.clear();
    this._siteInflight.clear();
    this._refDataCache = null;
    this._refDataInflight = null;
  }

  private async getTenantReferenceData(): Promise<TenantReferenceData> {
    const now = Date.now();
    if (this._refDataCache && now < this._refDataCache.expiresAt) {
      return this._refDataCache.data;
    }
    if (this._refDataInflight) {
      return this._refDataInflight;
    }
    this._refDataInflight = this._fetchTenantReferenceData(now);
    try {
      return await this._refDataInflight;
    } finally {
      this._refDataInflight = null;
    }
  }

  private async _fetchTenantReferenceData(now: number): Promise<TenantReferenceData> {
    const [currencies, countries, regions, paymentModes] = await Promise.all([
      this.getCurrencies(),
      this.getCountries(true),
      this.getRegions(),
      this.paymentService.getPaymentModes(),
    ]);
    const data = { currencies, countries, regions, paymentModes };
    this._refDataCache = { data, expiresAt: now + EmporixSiteService.REF_DATA_TTL_MS };
    return data;
  }

  async getSite(
    code?: string,
    hasTriedDefaultSite: boolean = false,
    refData?: TenantReferenceData,
  ): Promise<Site | null> {
    if (!code) {
      const sites = await this.siteSettingsApi.getSites({}, false);
      // TODO we could be faster, by using this result below
      const defaultSite = sites.items.find((site: EmporixSite) => site.default === true);
      code = defaultSite?.code;
    }
    if (!code) {
      return null;
    }

    const now = Date.now();
    const cached = this._siteCache.get(code);
    if (cached && now < cached.expiresAt) {
      return cached.data;
    }

    const inflight = this._siteInflight.get(code);
    if (inflight) {
      return inflight;
    }

    const promise = this._fetchSite(code, hasTriedDefaultSite, refData, now);
    this._siteInflight.set(code, promise);
    try {
      return await promise;
    } finally {
      this._siteInflight.delete(code);
    }
  }

  private async _fetchSite(
    code: string,
    hasTriedDefaultSite: boolean,
    refData: TenantReferenceData | undefined,
    now: number,
  ): Promise<Site | null> {
    try {
      const [emporixSite, { currencies, countries, regions, paymentModes }] = await Promise.all([
        this.siteSettingsApi.getSite(code),
        refData ? Promise.resolve(refData) : this.getTenantReferenceData(),
      ]);
      if (!emporixSite) {
        const defaultSite = process.env.NEXT_PUBLIC_DEFAULT_SITE;

        if (defaultSite && code !== defaultSite && !hasTriedDefaultSite) {
          this.logger.warn(`Site '${code}' not found, attempting fallback to default site '${defaultSite}'`);
          const fallbackSite = await this.getSite(defaultSite, true, refData);
          if (!fallbackSite) {
            this.logger.error(`Failed to get site '${code}' and fallback to default site '${defaultSite}' also failed`);
          }
          return fallbackSite;
        }

        if (defaultSite && code === defaultSite) {
          this.logger.error(`Site '${code}' not found and it is the configured default site`);
        } else if (hasTriedDefaultSite) {
          this.logger.error(`Site '${code}' not found and default site fallback has already been attempted`);
        } else if (!defaultSite) {
          this.logger.error(`Site '${code}' not found and no default site is configured`);
        }
        return null;
      }

      const site = this.mapSite(emporixSite, currencies, countries, regions, paymentModes);
      this._siteCache.set(code, { data: site, expiresAt: now + EmporixSiteService.SITE_TTL_MS });
      return site;
    } catch (error) {
      this.logger.error({ err: error instanceof Error ? error : String(error), code }, 'Error getting site');
      return null;
    }
  }

  async getAvailableSites(): Promise<Site[]> {
    try {
      const configuredCodes = process.env.NEXT_PUBLIC_AVAILABLE_SITES?.split(',') || [];
      const defaultSite = getPublicDefaultSite();
      if (defaultSite && (configuredCodes.length === 0 || !configuredCodes.includes(defaultSite))) {
        configuredCodes.push(defaultSite);
      }
      const codeSet = new Set(configuredCodes);

      const [bulkResponse, currencies] = await Promise.all([
        this.siteSettingsApi.getSites({}, false),
        this.getCurrencies(),
      ]);

      const matchedEmporixSites = bulkResponse.items.filter((s: EmporixSite) => codeSet.has(s.code));

      // Stable sort: default site first, then preserve configuredCodes order
      const codeOrder = new Map(configuredCodes.map((code, idx) => [code, idx]));
      matchedEmporixSites.sort((a: EmporixSite, b: EmporixSite) => {
        if (a.code === defaultSite) return -1;
        if (b.code === defaultSite) return 1;
        return (codeOrder.get(a.code) ?? Infinity) - (codeOrder.get(b.code) ?? Infinity);
      });

      const sites: Site[] = matchedEmporixSites.map((emporixSite: EmporixSite) => {
        return this.mapSite(emporixSite, currencies, [], [], []);
      });

      return sites;
    } catch (error) {
      this.logger.error({ err: error instanceof Error ? error : String(error) }, 'Error getting available sites');
      return [];
    }
  }
  // Map EmporixSite to Site
  private mapSite(
    emporixSite: EmporixSite,
    currencies: Currency[],
    countries: Country[],
    regions: Region[],
    paymentModes: PaymentMode[],
  ): Site {
    const address: Address = emporixSite.homeBase?.address || {};
    address.geoLocation = emporixSite.homeBase?.location;
    let availableCurrencies =
      emporixSite.availableCurrencies?.map((currency) => currencies.find((c) => c.id === currency)) || undefined;
    if (!availableCurrencies) {
      // TODO is empty on Emporix side
      availableCurrencies = [currencies.find((c) => c.id === emporixSite.currency)];
    }
    // TODO use what the site returns
    const availablePaymentModes = paymentModes;
    return {
      code: emporixSite.code,
      name: emporixSite.name || emporixSite.code,
      // TODO Emporix should supply a separate field for the commercial default country,
      // currently it is in the address
      defaultCountry: address.country,
      defaultLanguage: emporixSite.defaultLanguage || getPublicDefaultLanguage(),
      defaultCurrency: currencies.find((c) => c.id === emporixSite.currency) || currencies[0],
      countries: countries,
      shipToCountries:
        emporixSite.shipToCountries?.map((countryCode) => countries.find((c) => c.code === countryCode)) || [],
      address: address,
      currencies: availableCurrencies,
      languages: emporixSite.languages || [],
      regions: regions,
      paymentModes: availablePaymentModes,
      includesTax: emporixSite.includesTax || false,
      decimals: emporixSite.cartCalculationScale || 2,
    };
  }

  // Map EmporixCountry to Country
  // Pass the raw name through so callers receive either a plain string or a
  // LocalizedString map, allowing UI rendering to honor the active locale
  // via `l10n(country.name, locale)` instead of flattening to the first value.
  private mapCountry(emporixCountry: EmporixCountry): Country {
    return {
      code: emporixCountry.code,
      name: emporixCountry.name,
      regions: emporixCountry.regions,
    };
  }

  // Map EmporixRegion to Region
  private mapRegion(emporixRegion: EmporixRegion): Region {
    return {
      code: emporixRegion.code,
      name: emporixRegion.name,
    };
  }

  // Country methods
  async getCountries(active?: boolean): Promise<Country[]> {
    try {
      const emporixCountries = await this.countryApi.getCountries(active);
      return emporixCountries.map((country) => this.mapCountry(country));
    } catch (error) {
      this.logger.error({ err: error instanceof Error ? error : String(error), active }, 'Error getting countries');
      return [];
    }
  }

  async getCountry(countryCode: string): Promise<Country | null> {
    const emporixCountry = await this.countryApi.getCountry(countryCode);
    return emporixCountry ? this.mapCountry(emporixCountry) : null;
  }

  async getRegions(): Promise<Region[]> {
    try {
      const emporixRegions = await this.countryApi.getRegions();
      return emporixRegions.map((region) => this.mapRegion(region));
    } catch (error) {
      this.logger.error({ err: error instanceof Error ? error : String(error) }, 'Error getting regions');
      return [];
    }
  }

  async getRegion(regionCode: string): Promise<Region | null> {
    const emporixRegion = await this.countryApi.getRegion(regionCode);
    return emporixRegion ? this.mapRegion(emporixRegion) : null;
  }

  // Map EmporixCurrency to Currency
  private mapCurrency(emporixCurrency: EmporixCurrency): Currency {
    return {
      // Map code to id for the existing Currency interface
      id: emporixCurrency.code,
      // Add the enhanced properties
      code: emporixCurrency.code,
      name:
        typeof emporixCurrency.name === 'string' ? emporixCurrency.name : Object.values(emporixCurrency.name)[0] || '',
      // EmporixCurrency doesn't have active, so default to true
      active: true,
    };
  }

  // Map EmporixExchangeRate to ExchangeRate
  private mapExchangeRate(emporixRate: EmporixExchangeRate): ExchangeRate {
    return {
      sourceCurrency: emporixRate.sourceCurrency,
      targetCurrency: emporixRate.targetCurrency,
      rate: parseFloat(emporixRate.rate as unknown as string),
    };
  }

  // Currency methods
  async getCurrencies(site?: string): Promise<Currency[]> {
    try {
      let emporixCurrencies = await this.currencyApi.getCurrencies();
      if (site) {
        const siteCurrencies = await this.siteSettingsApi.getSite(site);
        if (!siteCurrencies) {
          return emporixCurrencies.map((currency) => this.mapCurrency(currency));
        }
        emporixCurrencies = emporixCurrencies.filter((c) => siteCurrencies.availableCurrencies?.includes(c.code));
      }
      return emporixCurrencies.map((currency) => this.mapCurrency(currency));
    } catch (error) {
      this.logger.error({ err: error instanceof Error ? error : String(error) }, 'Error getting currencies');
      return [];
    }
  }

  async getCurrency(currencyCode: string): Promise<Currency | undefined> {
    try {
      const emporixCurrency = await this.currencyApi.getCurrency(currencyCode);
      return emporixCurrency ? this.mapCurrency(emporixCurrency) : undefined;
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          currencyCode,
        },
        'Error getting currency',
      );
      return undefined;
    }
  }

  async getExchangeRates(): Promise<ExchangeRate[]> {
    try {
      const emporixRates = await this.currencyApi.getExchangeRates();
      return emporixRates.map((rate) => this.mapExchangeRate(rate));
    } catch (error) {
      this.logger.error({ err: error instanceof Error ? error : String(error) }, 'Error getting exchange rates');
      return [];
    }
  }

  async getExchangeRate(sourceCurrency: string, targetCurrency: string): Promise<ExchangeRate | undefined> {
    try {
      const emporixRate = await this.currencyApi.getExchangeRate(sourceCurrency, targetCurrency);
      return emporixRate ? this.mapExchangeRate(emporixRate) : undefined;
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          sourceCurrency,
          targetCurrency,
        },
        'Error getting exchange rate',
      );
      return undefined;
    }
  }
}

export default EmporixSiteService;
