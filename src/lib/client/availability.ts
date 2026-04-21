/**
 * Shared API layer for product availability data fetching (client-oriented).
 * Avoid React `cache()` here: memoization key is only `id` and can serve the wrong site after navigation.
 */
import { getLogger } from '@/lib/logger/use-logger-client';
import type { StockAvailability } from '@/platform/services/model/common';

export async function fetchProductAvailability(id: string): Promise<StockAvailability> {
  try {
    const response = await fetch(`/api/products/${id}/availability`, {
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
}
