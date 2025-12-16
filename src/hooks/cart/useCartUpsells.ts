import { useMemo } from 'react';
import { Product } from '@/platform/services/model/product';
import { useProducts } from '../product/useProducts';
import { useCart } from './useCart';

/**
 * Hook to extract and fetch upsell products from cart items
 * @returns Object containing upsell products, loading state, and error
 */
export function useCartUpsells() {
  const { cart } = useCart();

  // Extract all unique upsell refIds from cart items
  const upsellRefIds = useMemo(() => {
    if (!cart || !cart.items || cart.items.length === 0) {
      return [];
    }

    // Get product IDs from cart items
    const productIds = cart.items.map((item) => item.product?.id).filter((id): id is string => !!id);

    // We need to fetch full product data to get relatedItems
    // For now, return empty array - we'll fetch products in the component
    return productIds;
  }, [cart]);

  // Fetch full product data for cart items to get their relatedItems
  const { products: cartProducts, loading: cartProductsLoading } = useProducts(upsellRefIds, {
    prices: true,
  });

  // Extract upsell refIds from the fetched products
  const upsellProductIds = useMemo(() => {
    if (!cartProducts || cartProducts.length === 0) {
      return [];
    }

    const upsellIds = new Set<string>();
    cartProducts.forEach((product) => {
      if (product.relatedItems) {
        product.relatedItems.forEach((item) => {
          if (item.type === 'Upsell' && item.refId) {
            upsellIds.add(item.refId);
          }
        });
      }
    });

    return Array.from(upsellIds);
  }, [cartProducts]);

  // Fetch the actual upsell products
  const { products: upsellProducts, loading: upsellProductsLoading } = useProducts(upsellProductIds, {
    prices: true,
  });

  return {
    upsellProducts: upsellProducts || [],
    loading: cartProductsLoading || upsellProductsLoading,
  };
}
