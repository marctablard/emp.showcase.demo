import type { EmporixTaxConfiguration } from '../model/tax';

/**
 * Interface for the Emporix Tax API
 */
export interface EmporixTaxApi {
  /**
   * Get the tax configuration for a location (country code).
   * @param locationCode Country / location code as used by Tax Service
   * @returns Promise with the tax configuration, or null if not found
   */
  getTaxConfiguration(locationCode: string): Promise<EmporixTaxConfiguration | null>;
}
