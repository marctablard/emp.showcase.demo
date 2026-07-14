import { useMemo } from 'react';
import { useProducts } from '@/hooks/product/useProducts';
import type { Product } from '@/platform/services/model/product';

/**
 * Keeps a product list's prices in sync with the authenticated session.
 * Use for SSR-provided product grids/cards where `product.price` would otherwise
 * stay frozen at the anonymous shopper context until a full page reload.
 */
export function useSessionPricedProducts(initialProducts: Product[]) {
  const productIds = useMemo(() => initialProducts.map((product) => product.id).filter(Boolean), [initialProducts]);

  const { products: refreshedProducts, loading } = useProducts(productIds, { prices: true });

  const products = useMemo(() => {
    if (refreshedProducts.length === 0) {
      return initialProducts;
    }

    const refreshedById = new Map(refreshedProducts.map((product) => [product.id, product]));
    return initialProducts.map((product) => refreshedById.get(product.id) ?? product);
  }, [initialProducts, refreshedProducts]);

  return { products, loading };
}
