'use client';

import { useCallback, useEffect, useState } from 'react';
import { useHistory } from '@/hooks/history/useHistory';
import { fetchProductById } from '@/lib/client/products';
import { getLogger } from '@/lib/logger/use-logger-client';
import { Product } from '@/platform/services/model/product';
import { ProductFetchOptions } from '@/platform/services/product/ProductService';
import { useProductStore } from '@/providers/StoreProvider';

interface UseProductResult {
  currentProductId: string | null;
  product: Product | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setAsCurrent: (isCurrent?: boolean) => void;
}

export const useProduct = (productOrId?: string | Product, options?: ProductFetchOptions): UseProductResult => {
  const { getProduct, setCurrentProduct, addProduct, currentProductId } = useProductStore();

  let id: string | undefined;
  if (!productOrId) {
    id = currentProductId || undefined;
  } else {
    if ((productOrId as Product).id) {
      addProduct(productOrId as Product);
      id = (productOrId as Product).id;
    } else {
      id = productOrId as string;
    }
  }
  const [loading, setLoading] = useState<boolean>(typeof productOrId === 'string' ? true : false);
  const [error, setError] = useState<Error | null>(null);
  const [product, setProduct] = useState<Product | null>(id ? getProduct(id) : null);

  const fetchProduct = useCallback(
    async (forceRefresh = false) => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        // Check if product exists in store first (unless forceRefresh is true)
        if (!forceRefresh) {
          const cachedProduct = getProduct(id);
          if (cachedProduct) {
            setProduct(cachedProduct);
            setLoading(false);
            return;
          }
        }

        // Fetch from API if not in store using our shared API layer
        const data = await fetchProductById(id, options);
        if (data) {
          // Add to store
          addProduct(data);
        }
        setProduct(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred'));
        getLogger().error({ err }, 'Error fetching product');
      } finally {
        setLoading(false);
      }
    },
    [id, getProduct, addProduct, options],
  );

  const refetch = () => fetchProduct(true);

  const { addLastSeenProduct } = useHistory();

  const setAsCurrent = useCallback(
    (isCurrent: boolean = true) => {
      if (product && isCurrent) {
        setCurrentProduct(product);
      } else {
        setCurrentProduct(null);
      }
    },
    [product, setCurrentProduct],
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

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id, fetchProduct]);

  return {
    currentProductId,
    product,
    loading,
    error,
    refetch,
    setAsCurrent,
  };
};
