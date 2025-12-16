'use client';

import { create } from 'zustand';
import {
  addItemToCart as apiAddItemToCart,
  fetchCurrentCart as apiFetchCurrentCart,
  removeCartItem as apiRemoveCartItem,
  updateCartItemQuantity as apiUpdateCartItemQuantity,
  updateShippingInfo as apiUpdateShippingInfo,
  loadSavedCart,
} from '@/lib/client/carts';
import { ModifyCartItemResult } from '@/platform/services/cart/CartService';
import { Cart } from '@/platform/services/model/cart/cart';

export interface CartState {
  // Cart data, null means no cart, undefined means unknown state
  currentCart: Cart | null | undefined;
  loading: boolean;
  error: Error | null;
  // Track last shipping update to prevent duplicates
  lastShippingUpdate: {
    countryCode?: string;
    zipCode?: string;
    timestamp: number;
  } | null;
  sessionStatus: string | null;
}

interface CartActions {
  // Cart state operations
  setCurrentCart: (cart: Cart | null | undefined) => void;
  getCurrentCart: () => Cart | null | undefined;
  setLoading: (loading: boolean) => void;
  getLoading: () => boolean;
  setError: (error: Error | null) => void;
  loadCart: (cartId: string, type?: string) => Promise<Cart | null | undefined>;

  validateCart: (sessionStatus: string) => Promise<void>;

  // Cart API operations
  fetchCart: (createCurrent?: boolean) => Promise<Cart | null | undefined>;
  addToCart: (productId: string, quantity: number) => Promise<ModifyCartItemResult>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  updateShippingInfo: (countryCode?: string, zipCode?: string) => Promise<void>;
  clearCart: () => void;
}
export type CartStore = CartState & CartActions;

// default state explicitly 'undefined' since it means, we don't know the cart's state
const defaultState: CartState = {
  currentCart: undefined,
  loading: false,
  error: null,
  lastShippingUpdate: null,
  sessionStatus: null,
};

export const createCartStore = (initState: CartState = defaultState) => {
  return create<CartStore>()((set, get) => ({
    ...initState,
    validateCart: async (newSessionStatus: string) => {
      const { sessionStatus } = get();
      if (sessionStatus !== newSessionStatus) {
        set({ sessionStatus: newSessionStatus });
        await get().fetchCart(false);
      }
    },
    // State setters
    setCurrentCart: (cart: Cart | null | undefined) => {
      if (cart === get().currentCart) {
        return;
      }
      set({ currentCart: cart, loading: false });
    },
    getCurrentCart: () => get().currentCart,
    setLoading: (loading: boolean) => set({ loading }),
    getLoading: () => get().loading,
    setError: (error: Error | null) => set({ error }),

    // Cart API operations
    fetchCart: async (createCurrent: boolean = false) => {
      try {
        set({ loading: true, error: null });

        // Try to fetch existing cart
        try {
          const cartData = await apiFetchCurrentCart(createCurrent);
          set({ currentCart: cartData, loading: false });
          return cartData;
        } catch (_err) {
          // Silent error when cart is gone
          set({ currentCart: null, loading: false });
          return null;
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch cart');
        set({ error, loading: false });
        console.error('Error fetching cart:', err);
        return undefined;
      }
    },

    loadCart: async (cartId: string, type: string = 'shopping') => {
      try {
        set({ loading: true, error: null });

        // Try to fetch existing cart
        try {
          const cartData = await loadSavedCart(cartId, type);
          set({ currentCart: cartData, loading: false });
          return cartData;
        } catch (_err) {
          // Silent error when cart is gone
          set({ currentCart: null, loading: false });
          return null;
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch cart');
        set({ error, loading: false });
        console.error('Error fetching cart:', err);
        return undefined;
      }
    },

    addToCart: async (productId: string, quantity: number) => {
      const { currentCart } = get();
      set({ loading: true, error: null });

      try {
        let cartId;
        if (!currentCart) {
          const newCart = await get().fetchCart(true);
          if (newCart) {
            cartId = newCart.id;
          } else {
            throw new Error('No cart available');
          }
        } else {
          cartId = currentCart.id;
        }

        // Call API to add item
        const result = await apiAddItemToCart(cartId, productId, quantity);

        // Update cart state with the result
        if (result.cart) {
          set({ currentCart: result.cart, loading: false });
        } else {
          // Refetch cart to get updated state if result doesn't include cart
          await get().fetchCart();
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to add item to cart');
        set({ error, loading: false });
        console.error('Error adding item to cart:', err);
        throw err;
      }
    },

    updateItemQuantity: async (itemId: string, quantity: number) => {
      const { currentCart } = get();
      if (!currentCart) {
        await get().fetchCart();
        const updatedCart = get().currentCart;
        if (!updatedCart) throw new Error('No cart available');
      }

      try {
        set({ loading: true, error: null });
        const cart = get().currentCart;
        if (!cart) throw new Error('No cart available');

        // Call API to update item
        await apiUpdateCartItemQuantity(cart.id, itemId, quantity);

        // Refetch cart to get updated state
        await get().fetchCart();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update cart item');
        set({ error, loading: false });
        console.error('Error updating cart item:', err);
      }
    },

    removeItem: async (itemId: string) => {
      const { currentCart } = get();
      if (!currentCart) {
        await get().fetchCart();
        const updatedCart = get().currentCart;
        if (!updatedCart) throw new Error('No cart available');
      }

      try {
        set({ loading: true, error: null });
        const cart = get().currentCart;
        if (!cart) throw new Error('No cart available');

        // Call API to remove item
        await apiRemoveCartItem(cart.id, itemId);

        // Refetch cart to get updated state
        await get().fetchCart();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to remove cart item');
        set({ error, loading: false });
        console.error('Error removing cart item:', err);
      }
    },

    updateShippingInfo: async (countryCode?: string, zipCode?: string) => {
      try {
        // Check if we've recently updated with the same values to prevent duplicate calls to avoid conflict error
        const { lastShippingUpdate } = get();
        const now = Date.now();
        const DEBOUNCE_TIME = 2000;

        if (
          lastShippingUpdate &&
          lastShippingUpdate.countryCode === countryCode &&
          lastShippingUpdate.zipCode === zipCode &&
          now - lastShippingUpdate.timestamp < DEBOUNCE_TIME
        ) {
          return;
        }

        set({
          loading: true,
          error: null,
          lastShippingUpdate: {
            countryCode,
            zipCode,
            timestamp: now,
          },
        });

        const { currentCart } = get();
        if (!currentCart) {
          await get().fetchCart();
          const updatedCart = get().currentCart;
          if (!updatedCart) return;
        }

        const cart = get().currentCart;
        if (!cart) return;

        // Call API to update shipping info
        await apiUpdateShippingInfo(cart.id, countryCode, zipCode);

        // Refetch cart to get updated state
        await get().fetchCart();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update shipping info');
        set({ error, loading: false });
        console.error('Error updating shipping info:', err);
      }
    },

    clearCart: () => {
      // Reset all cart-related state to ensure proper cleanup
      set({
        currentCart: null,
        loading: false,
        error: null,
        lastShippingUpdate: null,
      });
    },
  }));
};
