import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixConfig } from '../../config';

/**
 * Utility class for common Emporix operations
 */
@injectable('EmporixCommonUtil', 'Singleton')
class EmporixCommonUtil {
  protected config: EmporixConfig;

  constructor(@inject('EmporixConfig') config: EmporixConfig) {
    this.config = config;
  }

  /**
   * Generates a YRN (Yaas Resource Name) for a product
   * @param productId The product ID
   * @returns The YRN for the product
   */
  generateProductYrn(productId: string): string {
    return `urn:yaas:saasag:caasproduct:product:${this.config.tenant};${productId}`;
  }

  /**
   * Generates a YRN (Yaas Resource Name) for a cart
   * @param cartId The cart ID
   * @returns The YRN for the cart
   */
  generateCartYrn(cartId: string): string {
    return `urn:yaas:hybris:cart:cart:${this.config.tenant};${cartId}`;
  }

  /**
   * Generates a YRN (Yaas Resource Name) for a cart item
   * @param cartId The cart ID
   * @param itemId The item ID
   * @returns The YRN for the cart item
   */
  generateCartItemYrn(cartId: string, itemId: string): string {
    return `urn:yaas:hybris:cart:cart-item:${this.config.tenant};${cartId}:${itemId}`;
  }

  /**
   * Generates a YRN (Yaas Resource Name) for a price
   * @param priceId The price ID
   * @returns The YRN for the price
   */
  generatePriceYrn(priceId: string): string {
    return `urn:yaas:saasag:caasprice:price:${this.config.tenant};${priceId}`;
  }

  /**
   * Generates a YRN (Yaas Resource Name) for a fee
   * @param feeId The fee ID
   * @returns The YRN for the fee
   */
  generateFeeYrn(feeId: string): string {
    return `urn:yaas:saasag:fee:fee:${this.config.tenant};${feeId}`;
  }

  /**
   * Extracts an ID from a YRN
   * @param yrn The YRN to extract from
   * @returns The extracted ID
   */
  extractIdFromYrn(yrn: string): string {
    const parts = yrn.split(';');
    return parts[parts.length - 1];
  }

  /**
   * Adds object fields to a query string, encoding values as needed
   * @param queryObject The object containing query parameters
   * @param baseQueryString The base query string to append to
   * @param excludeFields Optional array of field names to exclude from processing
   * @returns The updated query string with all parameters added
   */
  addObjectFieldsToQuery(queryObject: Record<string, any>, baseQueryString: string): string {
    let queryParams = baseQueryString;

    // Process all fields in the object, encoding all values
    Object.keys(queryObject).forEach((field) => {
      // Skip excluded fields and undefined/null values
      if (queryObject[field] === undefined || queryObject[field] === null) {
        return;
      }

      // Add the field to the query string with proper encoding
      queryParams += `&${field}=${encodeURIComponent(queryObject[field])}`;
    });

    return queryParams;
  }
}

export default EmporixCommonUtil;
