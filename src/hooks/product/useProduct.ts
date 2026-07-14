'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export const useProduct = (productOrId?: string | Product, options?: ProductFetchOptions): UseProductResult => {
  const { session, loading: sessionLoading } = useSession();
  const { site } = useSite();
  const { getProduct, setCurrentProduct, addProduct, currentProductId } = useProductStore();

  const sessionPricingContext = useMemo(
    () => (session != null ? { currency: session.currency, siteCode: session.siteCode } : session),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional narrow slice: pricing helpers only use currency + siteCode
    [session?.currency, session?.siteCode],
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

  const [loading, setLoading] = useState<boolean>(() => {
    if (!id) return false;
    if (productOrId && typeof productOrId === 'object' && (productOrId as Product).id) {
      return false;
    }
    return true;
  });
  const [error, setError] = useState<Error | null>(null);
  const [product, setProduct] = useState<Product | null>(() => {
    if (!id) return null;
    if (productOrId && typeof productOrId === 'object' && (productOrId as Product).id) {
      return productOrId as Product;
    }
    return getProduct(id);
  });

  // Seed the product store with an SSR-provided product so the cache-check effect below
  // can reuse it instead of clearing local state and refetching once the session resolves.
  useEffect(() => {
    if (productOrId && typeof productOrId === 'object' && (productOrId as Product).id) {
      addProduct(productOrId as Product);
    }
  }, [productOrId, addProduct]);

  const fetchProduct = useCallback(
    async (forceRefresh = false, clientDedupeScope = '') => {
      if (!id) return;

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

        if (forceRefresh) {
          setProduct(null);
        } else {
          setProduct((p) => (p && p.id !== id ? null : p));
        }

        const data = await fetchProductById(id, options, clientDedupeScope);
        const next =
          data && sessionPricingContext?.currency
            ? stripProductPriceIfNotDisplayableForShopContext(data, sessionPricingContext, site)
            : data;
        const merged = mergeRelatedItems(next, initialProductObject);
        if (merged) {
          addProduct(merged);
        }
        setProduct(merged ?? null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred'));
        getLogger().error({ err }, 'Error fetching product');
      } finally {
        setLoading(false);
      }
    },
    [id, getProduct, addProduct, options, sessionPricingContext, site, productOrId],
  );

  const refetch = useCallback(async () => {
    const scope = buildSessionPricingScopeKey(session);
    await fetchProduct(true, scope);
  }, [session, fetchProduct]);

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
  // so ProductDetail can show an error/retry state instead of infinite loading.
  useEffect(() => {
    if (!id) return;
    if (session?.siteCode && session?.currency) return;
    if (session === undefined) return;
    if (loading && session === null && !sessionLoading) {
      setLoading(false);
      setError(new Error('Session unavailable — unable to load product pricing'));
    }
  }, [id, session, loading, sessionLoading]);

  const sessionPricingKey = buildSessionPricingScopeKey(session);
  const prevSessionPricingKeyRef = useRef<string | null>(null);
  const prevProductIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (prevProductIdRef.current !== id) {
      prevProductIdRef.current = id;
      prevSessionPricingKeyRef.current = null;
    }
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }
    if (!sessionPricingKey) {
      return;
    }

    if (prevSessionPricingKeyRef.current === null) {
      prevSessionPricingKeyRef.current = sessionPricingKey;
      const cached = getProduct(id);
      const reuseCache =
        !!cached &&
        !!cached.price?.currency &&
        isProductPriceDisplayableForPurchase(cached.price.currency, sessionPricingContext, site);
      void fetchProduct(!reuseCache, sessionPricingKey);
      return;
    }

    if (prevSessionPricingKeyRef.current !== sessionPricingKey) {
      prevSessionPricingKeyRef.current = sessionPricingKey;
      void fetchProduct(true, sessionPricingKey);
    }
  }, [id, sessionPricingKey, fetchProduct, getProduct, site, sessionPricingContext]);

  return {
    currentProductId,
    product: productForUi,
    loading,
    error,
    refetch,
    setAsCurrent,
  };
};
