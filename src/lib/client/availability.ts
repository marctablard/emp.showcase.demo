/**
 * Shared API layer for product availability data fetching
 * Can be used by both server and client components
 */
import { cache } from 'react';
import { StockAvailability } from '@/platform/services/stock/StockService';

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
    console.error(`Error fetching availability for product ${id}:`, error);
    throw error;
  }
});
