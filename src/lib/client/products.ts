/**
 * Shared API layer for product-related data fetching
 * Can be used by both server and client components
 */
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Product } from '@/platform/services/model/product';
import type { ProductFetchOptions } from '@/platform/services/product/ProductService';

const _productInflight = new Map<string, Promise<Product | null>>();
const _variantInflight = new Map<string, Promise<Product[]>>();

/**
 * Fetch a product by ID.
 * Uses module-level in-flight map to deduplicate concurrent requests for the same product.
 */
export async function fetchProductById(
  id: string,
  options?: ProductFetchOptions,
  /** Separates in-flight dedupe per shop session so a site switch does not reuse the previous site's response. */
  clientDedupeScope = '',
): Promise<Product | null> {
  const pricesCacheKey =
    typeof options?.prices === 'object' && options.prices !== null
      ? JSON.stringify({
          siteCode: options.prices.siteCode,
          currency: options.prices.currency,
          country: options.prices.country,
        })
      : String(options?.prices ?? false);
  const cacheKey = `${id}:${clientDedupeScope}:${options?.variants ?? false}:${pricesCacheKey}`;
  const existing = _productInflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const searchParams = new URLSearchParams();
    if (options?.variants) {
      searchParams.set('variants', 'true');
    }
    if (options?.prices) {
      searchParams.set('prices', 'true');
      if (typeof options.prices === 'object' && options.prices !== null) {
        searchParams.set('priceSiteCode', options.prices.siteCode);
        if (options.prices.currency) {
          searchParams.set('priceCurrency', options.prices.currency);
        }
        if (options.prices.country) {
          searchParams.set('priceCountry', options.prices.country);
        }
      }
    }

    const queryString = searchParams.toString();
    const url = `/api/products/${id}${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      cache: 'no-store',
      next: { tags: [`product-${id}`] },
    });

    if (!response.ok) {
      if (response.status == 404) {
        return null;
      }
      throw new Error(`Failed to fetch product: ${response.statusText}`);
    }

    return await response.json();
  })();

  _productInflight.set(cacheKey, promise);
  void promise.finally(() => {
    if (_productInflight.get(cacheKey) === promise) {
      _productInflight.delete(cacheKey);
    }
  });

  try {
    return await promise;
  } catch (error) {
    getLogger().error({ err: error, productId: id }, 'Error fetching product');
    throw error;
  }
}

/**
 * Fetch variants for a product by parent ID.
 * Uses module-level in-flight map to deduplicate concurrent requests.
 */
export async function fetchProductVariants(parentId: string): Promise<Product[]> {
  const existing = _variantInflight.get(parentId);
  if (existing) return existing;

  const promise = (async () => {
    const response = await fetch(`/api/products/${parentId}/variants`, {
      cache: 'no-store',
      next: { tags: [`product-variants-${parentId}`] },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product variants: ${response.statusText}`);
    }

    const data = await response.json();
    return data.variants;
  })();

  _variantInflight.set(parentId, promise);
  void promise.finally(() => {
    if (_variantInflight.get(parentId) === promise) {
      _variantInflight.delete(parentId);
    }
  });

  try {
    return await promise;
  } catch (error) {
    getLogger().error({ err: error, parentId }, 'Error fetching product variants');
    throw error;
  }
}
