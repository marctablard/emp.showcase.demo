import type { ProductPrice } from '../model/price/price';

/**
 * Interface for price service.
 * Defines methods for price operations.
 */
export interface PriceService {
  /**
   * Match prices for products based on the given criteria
   * @param productId The product ID to match prices for
   * @param quantity Optional quantity for price matching
   * @param unitCode Optional unit code for price matching
   * @param params Optional parameters for price matching
   * @returns Array of matched prices or null if no prices found
   */
  getProductPrice(
    productId: string,
    quantity?: number,
    unitCode?: string,
    params?: { currency?: string; country?: string; siteCode?: string },
  ): Promise<ProductPrice | null>;
}
