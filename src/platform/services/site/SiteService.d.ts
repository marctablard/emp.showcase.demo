import { Country, Currency, ExchangeRate, Region } from '@/platform/services/model/common';
import { Site } from '@/platform/services/model/common/site';

/**
 * Service for site-related operations including countries, regions, currencies, shipping, and payment
 */
export interface SiteService {
  /**
   * Get a specific site by code
   * @param code Site code
   * @returns Site information or null if not found
   */
  getSite(code?: string): Promise<Site | null>;

  /**
   * Drop in-process cached site (and optional tenant ref data) so the next getSite refetches Emporix.
   * @param code When set, evicts that site code only; when omitted, clears all cached sites and tenant reference data.
   */
  invalidateSiteCache(code?: string): void;

  /**
   * Get all available sites
   * @returns List of available sites
   */
  getAvailableSites(): Promise<Site[]>;

  /**
   * Get all countries
   * @returns List of countries
   */
  getCountries(active?: boolean): Promise<Country[]>;

  /**
   * Get a specific country by code
   * @param countryCode ISO country code
   * @returns Country information or null if not found
   */
  getCountry(countryCode: string): Promise<Country | null>;

  /**
   * Get all regions
   * @returns List of regions
   */
  getRegions(): Promise<Region[]>;

  /**
   * Get a specific region by code
   * @param regionCode Region code
   * @returns Region information or null if not found
   */
  getRegion(regionCode: string): Promise<Region | null>;

  /**
   * Get all currencies
   * @returns List of currencies
   */
  getCurrencies(): Promise<Currency[]>;

  /**
   * Get a specific currency by code
   * @param currencyCode Currency code
   * @returns Currency information or undefined if not found
   */
  getCurrency(currencyCode: string): Promise<Currency | undefined>;

  /**
   * Get all exchange rates
   * @returns List of exchange rates
   */
  getExchangeRates(): Promise<ExchangeRate[]>;

  /**
   * Get a specific exchange rate
   * @param sourceCurrency Source currency code
   * @param targetCurrency Target currency code
   * @returns Exchange rate information or undefined if not found
   */
  getExchangeRate(sourceCurrency: string, targetCurrency: string): Promise<ExchangeRate | undefined>;
}
