import { useCallback, useEffect, useRef, useState } from 'react';
import { useClientFetchScope } from '@/hooks/common/useClientFetchScope';
import { useLogger } from '@/hooks/common/useLogger';
import { fetchProductById } from '@/lib/client/products';
import type { Product } from '@/platform/services/model/product';
import type { ProductFetchOptions } from '@/platform/services/product/ProductService';
import { useProductStore } from '@/providers/StoreProvider';

interface UseProductsResult {
  products: Product[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setAsCurrent: (index: number) => void;
}

/**
 * Builds the hook result after a fetch pass. A confirmed miss (id was requested and
 * not returned) is never filled from the id-keyed product store — that store is not
 * scoped by customer/mode (COP-4822).
 */
export function mergeProductFetchResults(
  productIds: Product['id'][],
  fetched: readonly (Product | null)[],
  getCached: (id: string) => Product | null | undefined,
  requestedIds: ReadonlySet<string>,
): Product[] {
  const fetchedById = new Map<string, Product>();
  for (const product of fetched) {
    if (product) {
      fetchedById.set(product.id, product);
    }
  }
  const merged: Product[] = [];
  for (const id of productIds) {
    const hit = fetchedById.get(id);
    if (hit) {
      merged.push(hit);
      continue;
    }
    if (requestedIds.has(id)) {
      continue;
    }
    const cached = getCached(id);
    if (cached) {
      merged.push(cached);
    }
  }
  return merged;
}

export function useProducts(productIds: Product['id'][] = [], fetchOptions?: ProductFetchOptions): UseProductsResult {
  const logger = useLogger();
  const clientDedupeScope = useClientFetchScope();
  const { getProduct, addProduct, addProducts, cacheGeneration } = useProductStore();
  const fetchOptionsKey = JSON.stringify({
    variants: fetchOptions?.variants ?? false,
    categories: fetchOptions?.categories ?? false,
    prices:
      typeof fetchOptions?.prices === 'object' && fetchOptions.prices !== null
        ? {
            siteCode: fetchOptions.prices.siteCode,
            currency: fetchOptions.prices.currency,
            country: fetchOptions.prices.country,
          }
        : (fetchOptions?.prices ?? false),
  });

  // Latest-value ref so `fetchProducts` reads the current options without having to list the
  // caller's (freshly allocated on every render) options object as a dependency. Kept in sync
  // from an effect rather than during render, and declared before the fetch effect below so the
  // ref is already updated by the time that effect runs for the same options change.
  const fetchOptionsRef = useRef<ProductFetchOptions | undefined>(fetchOptions);

  useEffect(() => {
    fetchOptionsRef.current = fetchOptions;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchOptionsKey is the value identity of fetchOptions
  }, [fetchOptionsKey]);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  // Monotonic fetch generation (COP-4822): a pass that resolves after a newer pass started
  // (products-mode / customer scope change, id-list change, refetch) is discarded — neither the
  // unscoped id-keyed store nor the returned list may be filled from a superseded scope.
  const fetchGeneration = useRef(0);

  const fetchProducts = useCallback(
    async (forceRefresh = false) => {
      const generation = ++fetchGeneration.current;
      const isStale = () => generation !== fetchGeneration.current;
      setLoading(true);
      setError(null);
      try {
        const pricesRequested = Boolean(fetchOptionsRef.current?.prices);
        const requestedPriceCurrency =
          typeof fetchOptionsRef.current?.prices === 'object' && fetchOptionsRef.current.prices !== null
            ? fetchOptionsRef.current.prices.currency
            : undefined;

        // Get products already in store (unless forceRefresh)
        const cachedProducts = forceRefresh
          ? []
          : (productIds
              .map((id) => {
                const cachedProduct = getProduct(id);
                if (!cachedProduct) {
                  return null;
                }

                if (pricesRequested && !cachedProduct.price) {
                  return null;
                }

                if (
                  requestedPriceCurrency &&
                  cachedProduct.price?.currency &&
                  cachedProduct.price.currency !== requestedPriceCurrency
                ) {
                  return null;
                }

                return cachedProduct;
              })
              .filter(Boolean) as Product[]);

        // Find IDs that need to be fetched
        const cachedIds = new Set(cachedProducts.map((p) => p.id));
        const idsToFetch = productIds.filter((id) => !cachedIds.has(id));
        const uniqueIdsToFetch = Array.from(new Set(idsToFetch));

        // Fetch missing products
        const fetchedProducts = await Promise.all(
          uniqueIdsToFetch.map(async (id) => {
            if (!id) return null;
            try {
              const fetched = await fetchProductById(id, fetchOptionsRef.current, clientDedupeScope);
              return fetched;
            } catch (_err) {
              logger.error(
                { productId: id, error: _err instanceof Error ? _err.message : String(_err) },
                `Failed to fetch product ${id}`,
              );
              return null;
            }
          }),
        );

        if (isStale()) {
          return;
        }

        // Add all fetched products to the store
        const validFetched = fetchedProducts.filter(Boolean) as Product[];
        if (validFetched.length > 0) {
          addProducts(validFetched);
        }
        for (const id of uniqueIdsToFetch) {
          if (id && !validFetched.some((product) => product.id === id)) {
            addProduct(id);
          }
        }

        setProducts(mergeProductFetchResults(productIds, fetchedProducts, getProduct, new Set(uniqueIdsToFetch)));
      } catch (err) {
        if (!isStale()) {
          setError(err as Error);
        }
      } finally {
        // The newest pass owns `loading`; a superseded one must not clear it early.
        if (!isStale()) {
          setLoading(false);
        }
      }
    },
    [productIds, getProduct, addProduct, addProducts, logger, clientDedupeScope],
  );

  const prevCacheGenRef = useRef(cacheGeneration);
  const prevClientDedupeScopeRef = useRef(clientDedupeScope);

  useEffect(() => {
    if (productIds && productIds.length > 0) {
      const generationChanged = prevCacheGenRef.current !== cacheGeneration;
      const scopeChanged = prevClientDedupeScopeRef.current !== clientDedupeScope;
      prevCacheGenRef.current = cacheGeneration;
      prevClientDedupeScopeRef.current = clientDedupeScope;
      fetchProducts(generationChanged || scopeChanged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIds.join(','), cacheGeneration, fetchOptionsKey, clientDedupeScope]);

  const refetch = useCallback(() => fetchProducts(true), [fetchProducts]);

  // ...setAsCurrent logic as before...

  return { products, loading, error, refetch, setAsCurrent: () => {} };
}
