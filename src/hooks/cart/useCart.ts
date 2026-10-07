'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import type {
  CartShippingAddress,
  CartShippingMethodSelection,
  ModifyCartItemResult,
} from '@/platform/services/cart/CartService';
import type { Cart } from '@/platform/services/model/cart/cart';
import { useCartStore } from '@/providers/StoreProvider';

interface UseCart {
  cart: Cart | null | undefined;
  cartId: string | null;
  totalItems: number;

  loading: boolean;
  /** True while a cart write is queued or in flight (including promo apply/remove). */
  mutating: boolean;
  error: Error | null;

  addItem: (productId: string, quantity: number) => Promise<ModifyCartItemResult>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<{ leftoverCouponsCleared: boolean }>;
  updateShippingInfo: (shippingAddress: CartShippingAddress, billingAddress?: CartShippingAddress) => Promise<void>;
  updateShippingMethod: (method: CartShippingMethodSelection) => Promise<void>;
  applyDiscount: (code: string) => Promise<void>;
  removeDiscount: (discountIndex: number) => Promise<void>;
  clearCart: (options?: { deleteCart?: boolean; clearSession?: boolean }) => void;
  loadCart: (cartId: string, type?: string) => Promise<Cart | null | undefined>;

  refetch: () => Promise<void>;
}

/**
 * Hook for interacting with the shopping cart
 * This is now a simple pass-through to the cart store
 *
 * @param initialCart Optional initial cart state
 * @returns Cart data and operations
 */
export const useCart = (initialCart?: Cart | null): UseCart => {
  const {
    currentCart: cart,
    loading,
    mutating,
    error,
    addToCart,
    updateItemQuantity,
    removeItem,
    updateShippingInfo,
    updateShippingMethod,
    applyDiscount,
    removeDiscount,
    clearCart,
    fetchCart,
    setCurrentCart,
    loadCart,
    validateCart,
  } = useCartStore();

  useEffect(() => {
    if (cart === undefined) {
      // Cart state is unknown — either hydrate from SSR prop or fetch
      if (initialCart !== undefined) {
        setCurrentCart(initialCart);
      } else {
        fetchCart(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, initialCart]);

  // Track authentication status changes to refresh cart
  const { status: sessionStatus } = useSession();
  useEffect(() => {
    validateCart(sessionStatus);
  }, [sessionStatus, validateCart]);

  // NOTE: Currency sync and site validation effects have been moved to
  // store-level subscriptions in src/stores/sync/store-synchronizer.ts
  // This eliminates duplicate API calls when multiple components use useCart.

  return {
    cart,
    cartId: cart?.id || null,
    totalItems: cart?.items?.reduce((total, item) => total + item.quantity, 0) || 0,
    loading,
    mutating,
    error,
    // Map store functions to the expected hook interface
    addItem: addToCart,
    updateItemQuantity,
    removeItem,
    updateShippingInfo,
    updateShippingMethod,
    applyDiscount,
    removeDiscount,
    clearCart,
    refetch: async () => {
      await fetchCart(false);
    },
    loadCart,
  };
};
