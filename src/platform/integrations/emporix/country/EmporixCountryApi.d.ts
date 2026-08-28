import { EmporixCountry, EmporixRegion } from '../model/country';

/**
 * Interface for the Emporix Country API
 */
export interface EmporixCountryApi {
  /**
   * Get all countries. Always requests Country Service with pageSize 300
   * (`DEFAULT_COUNTRIES_PAGE_SIZE`).
   * @param active Optional filter; when provided, included as the `active` query parameter
   * @returns Promise with array of countries
   */
  getCountries(active?: boolean): Promise<EmporixCountry[]>;

  /**
   * Get a specific country by code
   * @param countryCode ISO country code
   * @returns Promise with country or null if not found
   */
  getCountry(countryCode: string): Promise<EmporixCountry | null>;

  /**
   * Get all regions
   * @returns Promise with array of regions
   */
  getRegions(): Promise<EmporixRegion[]>;

  /**
   * Get a specific region by code
   * @param regionCode Region code
   * @returns Promise with region or null if not found
   */
  getRegion(regionCode: string): Promise<EmporixRegion | null>;
}
