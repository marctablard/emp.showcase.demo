/**
 * Mapped tax class used by the storefront (code + percent rate only).
 */
export type TaxClassRate = { code: string; rate: number };

/**
 * Service for tax rate lookups by destination country and tax class code.
 */
export interface TaxService {
  /**
   * Resolve the tax rate (percent number) for a tax class in a country.
   * @param countryCode Destination country / location code
   * @param taxCode Tax class `code` from Tax Service
   * @returns The class rate, or undefined if the country or class is missing
   */
  getTaxRate(countryCode: string, taxCode: string): Promise<number | undefined>;

  /**
   * List tax classes for a destination country.
   * @param countryCode Destination country / location code
   * @returns Mapped `{ code, rate }` entries, or `[]` when the country/config is missing
   */
  getTaxClasses(countryCode: string): Promise<TaxClassRate[]>;
}
