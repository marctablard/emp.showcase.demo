/**
 * Shared API layer for product price data fetching
 * Can be used by both server and client components
 */
import { cache } from 'react';
import type { ProductPrice } from '@/platform/services/model/price/price';

/**
 * Fetch a product price by ID
 * Uses React's cache() to deduplicate requests within the same render cycle
 *
 * @param id Product ID
 * @param quantity Optional quantity
 * @param unitCode Optional unit code
 * @returns ProductPrice object or null if not found
 */
export const fetchProductPrice = cache(
  async (id: string, quantity?: number, unitCode?: string): Promise<ProductPrice | null> => {
    try {
      // Build URL with query parameters
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
        // This makes the request work in both client and server environments
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
      console.error(`Error fetching price for product ${id}:`, error);
      throw error;
    }
  },
);
