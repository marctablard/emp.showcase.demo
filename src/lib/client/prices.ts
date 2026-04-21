/**
 * Shared API layer for product price data fetching (client-oriented).
 * Do not wrap in React `cache()`: the memo key is only `(id, …)` and would return a prior site's
 * currency after multi-site navigation until a full remount.
 */
import { getLogger } from '@/lib/logger/use-logger-client';
import type { ProductPrice } from '@/platform/services/model/price/price';

/**
 * Fetch a product price by ID
 *
 * @param id Product ID
 * @param quantity Optional quantity
 * @param unitCode Optional unit code
 * @returns ProductPrice object or null if not found
 */
export async function fetchProductPrice(
  id: string,
  quantity?: number,
  unitCode?: string,
): Promise<ProductPrice | null> {
  try {
    let url = `/api/products/${id}/price`;
    const params = new URLSearchParams();

    if (quantity !== undefined) {
      params.append('quantity', quantity.toString());
    }

    if (unitCode !== undefined) {
      params.append('unitCode', unitCode);
    }

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await fetch(url, {
      cache: 'no-store',
      next: { tags: [`product-price-${id}`] },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch product price: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    getLogger().error({ err: error, productId: id }, 'Error fetching product price');
    throw error;
  }
}
