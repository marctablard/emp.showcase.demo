/**
 * Shared API layer for product-related data fetching
 * Can be used by both server and client components
 */
import { appendSiteQuery, requestSiteFromClientDedupeScope } from '@/lib/client/client-fetch-scope';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Product } from '@/platform/services/model/product';
import type { ProductFetchOptions } from '@/platform/services/product/ProductService';

const _productInflight = new Map<string, Promise<Product | null>>();
const _variantInflight = new Map<string, Promise<Product[]>>();

function priceFetchSiteCode(options?: ProductFetchOptions): string | undefined {
  return typeof options?.prices === 'object' && options.prices !== null ? options.prices.siteCode : undefined;
}

function appendPriceSearchParams(
  searchParams: URLSearchParams,
  prices: NonNullable<ProductFetchOptions['prices']>,
): void {
  searchParams.set('prices', 'true');
  if (typeof prices !== 'object' || prices === null) {
    return;
  }
  searchParams.set('priceSiteCode', prices.siteCode);
  if (prices.currency) {
    searchParams.set('priceCurrency', prices.currency);
  }
  if (prices.country) {
    searchParams.set('priceCountry', prices.country);
  }
}

function buildProductByIdUrl(id: string, options: ProductFetchOptions | undefined, clientDedupeScope: string): string {
  const searchParams = new URLSearchParams();
  if (options?.variants) {
    searchParams.set('variants', 'true');
  }
  if (options?.prices) {
    appendPriceSearchParams(searchParams, options.prices);
  }
  const requestSite =
    priceFetchSiteCode(options) || options?.siteCode || requestSiteFromClientDedupeScope(clientDedupeScope);
  const queryString = searchParams.toString();
  const productPath = queryString ? `/api/products/${id}?${queryString}` : `/api/products/${id}`;
  return appendSiteQuery(productPath, requestSite);
}

async function readProductByIdResponse(id: string, url: string): Promise<Product | null> {
  const response = await fetch(url, {
    cache: 'no-store',
    next: { tags: [`product-${id}`] },
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch product: ${response.statusText}`);
  }
  return (await response.json()) as Product;
}

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
  const cacheKey = `${id}:${clientDedupeScope}:${options?.variants ?? false}:${pricesCacheKey}:${options?.siteCode ?? ''}`;
  const existing = _productInflight.get(cacheKey);
  if (existing) return existing;

  const promise = readProductByIdResponse(id, buildProductByIdUrl(id, options, clientDedupeScope));

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
 * Fetch variant-family products for an opened product ID.
 * The service GET-first remaps classic PARENT_VARIANT / VARIANT and DYNAMIC_VARIANT trees.
 * Uses module-level in-flight map to deduplicate concurrent requests.
 */
export async function fetchProductVariants(productId: string, clientDedupeScope = ''): Promise<Product[]> {
  const cacheKey = `${productId}:${clientDedupeScope}`;
  const existing = _variantInflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const response = await fetch(
      appendSiteQuery(`/api/products/${productId}/variants`, requestSiteFromClientDedupeScope(clientDedupeScope)),
      {
        cache: 'no-store',
        next: { tags: [`product-variants-${productId}`] },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch product variants: ${response.statusText}`);
    }

    const data = await response.json();
    return data.variants;
  })();

  _variantInflight.set(cacheKey, promise);
  void promise.finally(() => {
    if (_variantInflight.get(cacheKey) === promise) {
      _variantInflight.delete(cacheKey);
    }
  });

  try {
    return await promise;
  } catch (error) {
    getLogger().error({ err: error, productId }, 'Error fetching product variants');
    throw error;
  }
}
