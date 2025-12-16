'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { ModifyCartItemResult } from '@/platform/services/cart/CartService';
import { Cart } from '@/platform/services/model/cart/cart';
import { useCartStore } from '@/providers/StoreProvider';

interface UseCart {
  // Cart data
  cart: Cart | null | undefined;
  cartId: string | null;
  totalItems: number;

  // Status
  loading: boolean;
  error: Error | null;

  // Operations
  addItem: (productId: string, quantity: number) => Promise<ModifyCartItemResult>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  updateShippingInfo: (countryCode?: string, zipCode?: string) => Promise<void>;
  clearCart: () => void;
  loadCart: (cartId: string, type?: string) => Promise<Cart | null | undefined>;

  // Utility
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
    error,
    addToCart,
    updateItemQuantity,
    removeItem,
    updateShippingInfo,
    clearCart,
    fetchCart,
    setCurrentCart,
    loadCart,
    validateCart,
  } = useCartStore();

  useEffect(() => {
    // Initialize with initialCart if provided and cart is undefined
    if (initialCart !== undefined) {
      setCurrentCart(initialCart);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCart]);

  const { status: sessionStatus } = useSession();
  useEffect(() => {
    validateCart(sessionStatus);
  }, [sessionStatus, validateCart]);

  return {
    cart,
    cartId: cart?.id || null,
    totalItems: cart?.items?.reduce((total, item) => total + item.quantity, 0) || 0,
    loading,
    error,
    // Map store functions to the expected hook interface
    addItem: addToCart,
    updateItemQuantity,
    removeItem,
    updateShippingInfo,
    clearCart,
    refetch: async () => {
      await fetchCart(false);
    },
    loadCart,
  };
};
