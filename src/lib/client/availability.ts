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

export async function fetchProductAvailabilities(productIds: string[]): Promise<Record<string, StockAvailability>> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return {};
  }

  try {
    const response = await fetch('/api/products/availability/batch', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productIds: uniqueIds }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product availabilities: ${response.statusText}`);
    }

    const data = (await response.json()) as { availabilities?: Record<string, StockAvailability> };
    return data.availabilities ?? {};
  } catch (error) {
    getLogger().error({ err: error, productIds: uniqueIds }, 'Error fetching batch product availability');
    throw error;
  }
}
