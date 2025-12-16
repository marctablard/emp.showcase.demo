import { ShippingMethod } from '../model/shipping';

/**
 * Service for shipping operations
 */
export interface ShippingService {
  /**
   * Get shipping methods for a country and postal code
   * @param countryCode The country code
   * @param postalCode The postal code
   */
  getShippingMethods(
    countryCode: string,
    postalCode: string,
    orderValue?: { amount: number; currency: string },
  ): Promise<ShippingMethod[]>;

  /**
   * Get a shipping method by ID
   * @param methodId The method ID
   * @param zoneId The zone ID
   */
  getShippingMethod(methodId: string, zoneId: string): Promise<ShippingMethod | null>;
}
