'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProductsMode } from '@/components/navigation/products-mode-context';
import { useClientFetchScope } from '@/hooks/common/useClientFetchScope';
import { useHistory } from '@/hooks/history/useHistory';
import { useSession } from '@/hooks/session/useSession';
import { useSite } from '@/hooks/site/useSite';
import { fetchProductById } from '@/lib/client/products';
import { buildSessionPricingScopeKey } from '@/lib/common/price-fetch-options';
import {
  isProductPriceDisplayableForPurchase,
  stripProductPriceIfNotDisplayableForShopContext,
} from '@/lib/common/product-price-site-context';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Product } from '@/platform/services/model/product';
import type { ProductFetchOptions } from '@/platform/services/product/ProductService';
import { useProductStore } from '@/providers/StoreProvider';

interface UseProductResult {
  currentProductId: string | null;
  product: Product | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setAsCurrent: (isCurrent?: boolean) => void;
}

function mergeRelatedItems(
  product: Product | null | undefined,
  ...fallbacks: (Product | null | undefined)[]
): Product | null | undefined {
  if (!product || product.relatedItems?.length) {
    return product;
  }

  for (const fallback of fallbacks) {
    if (fallback?.relatedItems?.length) {
      return { ...product, relatedItems: fallback.relatedItems };
    }
  }

  return product;
}

/** Hook argument is a Product object with an id (SSR / ATC / sticky-bar seed). */
function isSeededProductObject(productOrId?: string | Product): productOrId is Product {
  return typeof productOrId === 'object' && productOrId != null && Boolean(productOrId.id);
}

/** Last-known same-id product from local state or store (SSR seed / prior fetch). */
function resolvePriorSameIdProduct(
  productId: string,
  localProduct: Product | null,
  getCached: (id: string) => Product | undefined | null,
): Product | null {
  if (localProduct?.id === productId) {
    return localProduct;
  }
  const cached = getCached(productId);
  if (cached?.id === productId) {
    return cached;
  }
  return null;
}

function applyProductFetchMiss(
  productId: string,
  localProduct: Product | null,
  getCached: (id: string) => Product | undefined | null,
  setProduct: (product: Product | null) => void,
  setError: (error: Error | null) => void,
  failClosed: boolean,
  invalidateCached?: (id: string) => void,
): void {
  // Confirmed client miss (404 → null). Keep prior same-id product when present
  // so SSR-seeded PDPs do not become Not Found–eligible empty success; true
  // id-only fetches with no prior product still resolve to null.
  // COP-4822 AC4: in `assigned` mode a 404 must not keep an out-of-segment seed on screen.
  if (!failClosed) {
    const prior = resolvePriorSameIdProduct(productId, localProduct, getCached);
    if (prior) {
      setProduct(prior);
      setError(new Error('Product refetch returned no data'));
      return;
    }
  }
  invalidateCached?.(productId);
  setProduct(null);
}

function applyProductFetchError(
  productId: string,
  localProduct: Product | null,
  getCached: (id: string) => Product | undefined | null,
  setProduct: (product: Product | null) => void,
  setError: (error: Error | null) => void,
  err: unknown,
  failClosed: boolean,
  invalidateCached?: (id: string) => void,
): void {
  // Assigned-mode revalidation must fail closed: a 5xx / network error must not keep an
  // anonymous/ALL seed on screen (COP-4822). Other modes keep the prior same-id product.
  if (failClosed) {
    invalidateCached?.(productId);
    setProduct(null);
  } else {
    const prior = resolvePriorSameIdProduct(productId, localProduct, getCached);
    if (prior) {
      setProduct(prior);
    }
  }
  setError(err instanceof Error ? err : new Error('An unknown error occurred'));
  getLogger().error({ err }, 'Error fetching product');
}

export const useProduct = (productOrId?: string | Product, options?: ProductFetchOptions): UseProductResult => {
  const { session, loading: sessionLoading } = useSession();
  const { site } = useSite();
  const { getProduct, setCurrentProduct, addProduct, currentProductId } = useProductStore();
  const { mode: productsMode } = useProductsMode();
  const mustRevalidateAssignedSeed = productsMode === 'assigned';

  // Read out of `session` once: optional-chained member expressions in a dependency array
  // cannot be tracked as stable dependencies.
  const sessionCurrency = session?.currency;
  const sessionSiteCode = session?.siteCode;
  const clientDedupeScope = useClientFetchScope(buildSessionPricingScopeKey(session) || sessionCurrency);

  const sessionPricingContext = useMemo(
    () => (session != null ? { currency: session.currency, siteCode: session.siteCode } : session),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional narrow slice: pricing helpers only use currency + siteCode
    [sessionCurrency, sessionSiteCode],
  );

  let id: string | undefined;
  if (!productOrId) {
    id = currentProductId || undefined;
  } else {
    if ((productOrId as Product).id) {
      id = (productOrId as Product).id;
    } else {
      id = productOrId as string;
    }
  }

  const seededProductObject = isSeededProductObject(productOrId);

  const [loading, setLoading] = useState<boolean>(() => {
    if (!id) return false;
    if (seededProductObject && !mustRevalidateAssignedSeed) {
      return false;
    }
    return true;
  });
  const [error, setError] = useState<Error | null>(null);
  const [product, setProduct] = useState<Product | null>(() => {
    if (!id) return null;
    if (seededProductObject) {
      return productOrId;
    }
    return getProduct(id);
  });
  // Keep a sync ref so async fetch handlers can preserve last-known same-id product
  // without relying on stale closures or post-await setState updater timing.
  const productRef = useRef<Product | null>(product);

  useEffect(() => {
    productRef.current = product;
  }, [product]);

  // Seed the product store with an SSR-provided product so the cache-check effect below
  // can reuse it instead of clearing local state and refetching once the session resolves.
  useEffect(() => {
    if (seededProductObject) {
      addProduct(productOrId);
    }
  }, [seededProductObject, productOrId, addProduct]);

  // Monotonic fetch generation (COP-4822): a response that resolves after a newer fetch started
  // (products-mode / customer scope change, id change, explicit refetch) is discarded instead of
  // being committed to local state or the unscoped id-keyed store — otherwise an `all`-mode
  // product resolving late could re-render an out-of-scope PDP in `assigned` mode.
  const fetchGeneration = useRef(0);

  const fetchProduct = useCallback(
    async (forceRefresh: boolean, clientDedupeScope: string) => {
      if (!id) return;
      const generation = ++fetchGeneration.current;
      const isStale = () => generation !== fetchGeneration.current;

      const initialProductObject =
        productOrId && typeof productOrId === 'object' ? (productOrId as Product) : undefined;

      try {
        setLoading(true);
        setError(null);

        if (!forceRefresh) {
          const cachedProduct = getProduct(id);
          if (
            cachedProduct?.price?.currency &&
            isProductPriceDisplayableForPurchase(cachedProduct.price.currency, sessionPricingContext, site)
          ) {
            setProduct((current) => mergeRelatedItems(cachedProduct, current, initialProductObject) ?? cachedProduct);
            setLoading(false);
            return;
          }
        }

        // Preserve known same-id product during session-driven pricing/enrichment refetch.
        // Only clear when switching to a different product id.
        setProduct((p) => (p && p.id !== id ? null : p));

        const data = await fetchProductById(id, options, clientDedupeScope);
        if (isStale()) {
          return;
        }
        const next =
          data && sessionPricingContext?.currency
            ? stripProductPriceIfNotDisplayableForShopContext(data, sessionPricingContext, site)
            : data;
        const merged = mergeRelatedItems(next, initialProductObject);
        if (merged) {
          addProduct(merged);
          setProduct(merged);
        } else {
          applyProductFetchMiss(
            id,
            productRef.current,
            getProduct,
            setProduct,
            setError,
            mustRevalidateAssignedSeed,
            addProduct,
          );
        }
      } catch (err) {
        if (isStale()) {
          return;
        }
        applyProductFetchError(
          id,
          productRef.current,
          getProduct,
          setProduct,
          setError,
          err,
          mustRevalidateAssignedSeed,
          addProduct,
        );
      } finally {
        // The newest fetch owns `loading`; a superseded one must not clear it early.
        if (!isStale()) {
          setLoading(false);
        }
      }
    },
    [id, getProduct, addProduct, options, sessionPricingContext, site, mustRevalidateAssignedSeed, productOrId],
  );

  const refetch = useCallback(async () => {
    await fetchProduct(true, clientDedupeScope);
  }, [clientDedupeScope, fetchProduct]);

  const productForUi = useMemo(() => {
    if (!product) {
      return product;
    }
    return stripProductPriceIfNotDisplayableForShopContext(product, session ?? null, site);
  }, [product, session, site]);

  const { addLastSeenProduct } = useHistory();

  const setAsCurrent = useCallback(
    (isCurrent: boolean = true) => {
      if (productForUi && isCurrent) {
        setCurrentProduct(productForUi);
      } else {
        setCurrentProduct(null);
      }
    },
    [productForUi, setCurrentProduct],
  );

  useEffect(() => {
    if (currentProductId) {
      const product = getProduct(currentProductId);
      if (product) {
        // Add to last seen products when setting as current
        addLastSeenProduct(product);
      }
    }
  }, [currentProductId, addLastSeenProduct, getProduct]);

  // Fail-safe: when session recovery fails (null + not loading), unblock the spinner
  // so ProductDetail can show an error/retry state instead of infinite loading. Adjusted during
  // render rather than from an effect; once `loading` is false the condition no longer holds.
  if (id && session === null && !sessionLoading && loading) {
    setLoading(false);
    setError(new Error('Session unavailable — unable to load product pricing'));
  }

  const sessionPricingKey = sessionSiteCode && sessionCurrency ? `${sessionSiteCode}|${sessionCurrency}` : '';
  const prevClientDedupeScopeRef = useRef<string | null>(null);
  const prevProductIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (prevProductIdRef.current !== id) {
      prevProductIdRef.current = id;
      prevClientDedupeScopeRef.current = null;
    }
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }
    if (!sessionPricingKey) {
      return;
    }

    // Skip catalog refetch iff the hook argument is a Product object with an id.
    // ProductStore cache hit is not a skip. Catalog copy is not currency-dependent.
    if (seededProductObject && !mustRevalidateAssignedSeed) {
      prevClientDedupeScopeRef.current = clientDedupeScope;
      return;
    }

    if (prevClientDedupeScopeRef.current !== clientDedupeScope) {
      prevClientDedupeScopeRef.current = clientDedupeScope;
      fetchProduct(true, clientDedupeScope).catch((err: unknown) => {
        getLogger().error({ err }, 'Product refetch after scope change failed');
      });
    }
  }, [id, sessionPricingKey, clientDedupeScope, fetchProduct, seededProductObject, mustRevalidateAssignedSeed]);

  return {
    currentProductId,
    product: productForUi,
    loading,
    error,
    refetch,
    setAsCurrent,
  };
};
