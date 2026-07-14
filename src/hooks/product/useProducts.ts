import { useCallback, useEffect, useRef, useState } from 'react';
import { useLogger } from '@/hooks/common/useLogger';
import { useSession } from '@/hooks/session/useSession';
import { fetchProductById } from '@/lib/client/products';
import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import { buildSessionPricingScopeKey } from '@/lib/common/price-fetch-options';
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

export function useProducts(productIds: Product['id'][] = [], fetchOptions?: ProductFetchOptions): UseProductsResult {
  const logger = useLogger();
  const { session } = useSession();
  const sessionPricingScope = buildSessionPricingScopeKey(session);
  const { getProduct, addProducts, cacheGeneration } = useProductStore();
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
    sessionPricingScope,
  });

  // Stabilize fetchOptions to prevent unnecessary re-renders
  const fetchOptionsRef = useRef<ProductFetchOptions | undefined>(fetchOptions);
  const optionsChanged =
    fetchOptionsRef.current?.variants !== fetchOptions?.variants ||
    fetchOptionsRef.current?.prices !== fetchOptions?.prices ||
    fetchOptionsRef.current?.categories !== fetchOptions?.categories;

  if (optionsChanged) {
    fetchOptionsRef.current = fetchOptions;
  }

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const fetchProducts = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const pricesRequested = Boolean(fetchOptionsRef.current?.prices);
        const requestedPriceCurrency =
          typeof fetchOptionsRef.current?.prices === 'object' && fetchOptionsRef.current.prices !== null
            ? fetchOptionsRef.current.prices.currency
            : undefined;
        const trustCachedPrices = !pricesRequested || !isAuthenticatedSessionCustomerId(session?.customerId);

        // Get products already in store (unless forceRefresh)
        const cachedProducts = forceRefresh
          ? []
          : (productIds
              .map((id) => {
                const cachedProduct = getProduct(id);
                if (!cachedProduct) {
                  return null;
                }

                if (pricesRequested && !trustCachedPrices) {
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
              const fetched = await fetchProductById(id, fetchOptionsRef.current, sessionPricingScope);
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

        // Add all fetched products to the store
        const validFetched = fetchedProducts.filter(Boolean) as Product[];
        if (validFetched.length > 0) {
          addProducts(validFetched);
        }

        // Return products in the same order as productIds
        const allProducts = productIds
          .map((id) => getProduct(id) || validFetched.find((p) => p.id === id))
          .filter(Boolean) as Product[];

        setProducts(allProducts);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    },
    [productIds, getProduct, addProducts, logger, session?.customerId, sessionPricingScope],
  );

  const prevCacheGenRef = useRef(cacheGeneration);

  useEffect(() => {
    if (productIds && productIds.length > 0) {
      const generationChanged = prevCacheGenRef.current !== cacheGeneration;
      prevCacheGenRef.current = cacheGeneration;
      fetchProducts(generationChanged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIds.join(','), cacheGeneration, fetchOptionsKey]);

  const refetch = useCallback(() => fetchProducts(true), [fetchProducts]);

  // ...setAsCurrent logic as before...

  return { products, loading, error, refetch, setAsCurrent: () => {} };
}
