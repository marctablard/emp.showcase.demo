import type { ProductPrice } from '../model/price/price';

export interface PriceFetchOptions {
  // if supplied, this is mandatory, because the other attributes can be infered from this
  siteCode: string;
  currency?: string;
  country?: string;
  /** B2B company context — includes price lists assigned to this legal entity. */
  legalEntityId?: string;
}

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
    params?: PriceFetchOptions,
  ): Promise<ProductPrice | null>;

  /**
   * Batch-match prices for multiple products in a single API call.
   * Results are keyed by product ID; missing prices map to null.
   * Arrays larger than 200 items are automatically chunked.
   */
  getProductPrices(
    productIds: string[],
    quantity?: number,
    unitCode?: string,
    params?: PriceFetchOptions,
  ): Promise<Map<string, ProductPrice | null>>;
}
