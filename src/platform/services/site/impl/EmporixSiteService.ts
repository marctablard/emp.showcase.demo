import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCountryApi } from '@/platform/integrations/emporix/country/EmporixCountryApi';
import type { EmporixCurrencyApi } from '@/platform/integrations/emporix/currency/EmporixCurrencyApi';
import { EmporixCountry, EmporixRegion } from '@/platform/integrations/emporix/model/country';
import { EmporixCurrency, EmporixExchangeRate } from '@/platform/integrations/emporix/model/currency';
import { EmporixSite } from '@/platform/integrations/emporix/model/site-settings';
import type { EmporixSiteSettingsApi } from '@/platform/integrations/emporix/site-settings/EmporixSiteSettingsApi';
import { Address, Country, Currency, ExchangeRate, Region } from '@/platform/services/model/common';
import type { LoggerService } from '../../logger/LoggerService';
import { PaymentMode } from '../../model';
import { Site } from '../../model/common/site';
import type { PaymentService } from '../../payment/PaymentService';
import { SiteService } from '../SiteService';

/**
 * Implementation of SiteService for Emporix platform
 * Combines functionality from Country, Currency, Shipping, and Payment APIs
 */
@injectable('SiteService', 'Singleton')
class EmporixSiteService implements SiteService {
  constructor(
    @inject('EmporixCountryApi') private countryApi: EmporixCountryApi,
    @inject('EmporixCurrencyApi') private currencyApi: EmporixCurrencyApi,
    @inject('EmporixSiteSettingsApi') private siteSettingsApi: EmporixSiteSettingsApi,
    @inject('PaymentService') private paymentService: PaymentService,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  async getSite(code?: string, hasTriedDefaultSite: boolean = false): Promise<Site | null> {
    if (!code) {
      const sites = await this.siteSettingsApi.getSites({}, false);
      // TODO we could be faster, by using this result below
      const defaultSite = sites.items.find((site: EmporixSite) => site.default === true);
      code = defaultSite?.code;
    }
    if (!code) {
      return null;
    }
    try {
      const [emporixSite, currencies, countries, regions, paymentModes] = await Promise.all([
        this.siteSettingsApi.getSite(code),
        this.getCurrencies(),
        this.getCountries(true),
        this.getRegions(),
        this.paymentService.getPaymentModes(),
      ]);
      // Get Default Site as fallback
      if (!emporixSite) {
        const defaultSite = process.env.NEXT_PUBLIC_DEFAULT_SITE;

        // Prevent infinite recursion:
        // 1. Don't recurse if we've already tried the default site
        // 2. Don't recurse if the current code is already the default site
        // 3. Don't recurse if default site is undefined or empty
        if (defaultSite && code !== defaultSite && !hasTriedDefaultSite) {
          this.logger.warn(`Site '${code}' not found, attempting fallback to default site '${defaultSite}'`);
          const fallbackSite = await this.getSite(defaultSite, true);
          if (!fallbackSite) {
            this.logger.error(`Failed to get site '${code}' and fallback to default site '${defaultSite}' also failed`);
          }
          return fallbackSite;
        }

        // If we've already tried default or it's the same code, return null
        if (defaultSite && code === defaultSite) {
          this.logger.error(`Site '${code}' not found and it is the configured default site`);
        } else if (hasTriedDefaultSite) {
          this.logger.error(`Site '${code}' not found and default site fallback has already been attempted`);
        } else if (!defaultSite) {
          this.logger.error(`Site '${code}' not found and no default site is configured`);
        }
        return null;
      }

      return this.mapSite(emporixSite, currencies, countries, regions, paymentModes);
    } catch (error) {
      this.logger.error({ err: error instanceof Error ? error : String(error), code }, 'Error getting site');
      return null;
    }
  }

  async getAvailableSites(): Promise<Site[]> {
    try {
      const config = process.env.NEXT_PUBLIC_AVAILABLE_SITES?.split(',') || [];
      const defaultSite = process.env.NEXT_PUBLIC_DEFAULT_SITE || undefined;
      if (defaultSite && (config.length === 0 || !config.includes(defaultSite))) {
        config.push(defaultSite);
      }
      const sites = await Promise.all(config.map(async (code) => this.getSite(code)));
      return sites.filter((site) => site !== null) as Site[];
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
      defaultLanguage: emporixSite.defaultLanguage || 'en',
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
  private mapCountry(emporixCountry: EmporixCountry): Country {
    return {
      code: emporixCountry.code,
      name: typeof emporixCountry.name === 'string' ? emporixCountry.name : Object.values(emporixCountry.name)[0] || '',
      regions: emporixCountry.regions,
    };
  }

  // Map EmporixRegion to Region
  private mapRegion(emporixRegion: EmporixRegion): Region {
    return {
      code: emporixRegion.code,
      name: typeof emporixRegion.name === 'string' ? emporixRegion.name : Object.values(emporixRegion.name)[0] || '',
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
