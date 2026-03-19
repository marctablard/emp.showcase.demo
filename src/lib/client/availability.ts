/**
 * Shared API layer for product availability data fetching
 * Can be used by both server and client components
 */
import { cache } from 'react';
import { getLogger } from '@/lib/logger/use-logger-client';
import { StockAvailability } from '@/platform/services/model/common';

/**
 * Fetch product availability by product ID
 * Uses React's cache() to deduplicate requests within the same render cycle
 */
export const fetchProductAvailability = cache(async (id: string): Promise<StockAvailability> => {
  try {
    const response = await fetch(`/api/products/${id}/availability`, {
      // This makes the request work in both client and server environments
      cache: 'no-store',
      next: { tags: [`product-availability-${id}`] },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product availability: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    getLogger().error({ err: error, productId: id }, 'Error fetching product availability');
    throw error;
  }
});
