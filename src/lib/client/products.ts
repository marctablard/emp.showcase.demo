/**
 * Shared API layer for product-related data fetching
 * Can be used by both server and client components
 */
import { cache } from 'react';
import { Product } from '@/platform/services/model/product';
import { ProductFetchOptions } from '@/platform/services/product/ProductService';

/**
 * Fetch a product by ID
 * Uses React's cache() to deduplicate requests within the same render cycle
 */
export const fetchProductById = cache(async (id: string, options?: ProductFetchOptions): Promise<Product> => {
  try {
    // Build query parameters
    const searchParams = new URLSearchParams();
    if (options?.variants) {
      searchParams.set('variants', 'true');
    }
    if (options?.prices) {
      searchParams.set('prices', 'true');
    }

    const queryString = searchParams.toString();
    const url = `/api/products/${id}${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      // This makes the request work in both client and server environments
      cache: 'no-store',
      next: { tags: [`product-${id}`] },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
    throw error;
  }
});

/**
 * Fetch variants for a product by parent ID
 * Uses React's cache() to deduplicate requests within the same render cycle
 */
export const fetchProductVariants = cache(async (parentId: string): Promise<Product[]> => {
  try {
    const response = await fetch(`/api/products/${parentId}/variants`, {
      cache: 'no-store',
      next: { tags: [`product-variants-${parentId}`] },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product variants: ${response.statusText}`);
    }

    const data = await response.json();
    return data.variants;
  } catch (error) {
    console.error(`Error fetching variants for product ${parentId}:`, error);
    throw error;
  }
});
