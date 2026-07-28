'use client';

import { create } from 'zustand';
import {
  type MoveWishlistItemToCartResult,
  addItemToWishlist as apiAddItemToWishlist,
  fetchCurrentWishlist as apiFetchCurrentWishlist,
  moveWishlistItemToCart as apiMoveWishlistItemToCart,
  removeWishlistItem as apiRemoveWishlistItem,
  updateWishlistItemQuantity as apiUpdateWishlistItemQuantity,
} from '@/lib/client/wishlist';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Wishlist } from '@/platform/services/model/wishlist/wishlist';

export interface WishlistState {
  // null = no wishlist, undefined = unknown / not fetched yet
  currentWishlist: Wishlist | null | undefined;
  loading: boolean;
  error: Error | null;
}

interface WishlistActions {
  setCurrentWishlist: (wishlist: Wishlist | null | undefined) => void;
  fetchWishlist: () => Promise<Wishlist | null | undefined>;
  addItem: (productId: string, quantity: number) => Promise<Wishlist>;
  updateItemQuantity: (productId: string, quantity: number) => Promise<Wishlist>;
  removeItem: (productId: string) => Promise<Wishlist | null>;
  moveItemToCart: (productId: string) => Promise<MoveWishlistItemToCartResult>;
  clearWishlist: () => void;
}

export type WishlistStore = WishlistState & WishlistActions;

const defaultState: WishlistState = {
  currentWishlist: undefined,
  loading: false,
  error: null,
};

export const createWishlistStore = (initState: WishlistState = defaultState) => {
  /** Dedupes concurrent `fetchWishlist` calls; kept outside state to avoid re-renders. */
  let _fetchPromise: Promise<Wishlist | null | undefined> | null = null;

  return create<WishlistStore>()((set, get) => ({
    ...initState,

    setCurrentWishlist: (wishlist) => {
      if (wishlist === get().currentWishlist) return;
      set({ currentWishlist: wishlist, loading: false });
    },

    fetchWishlist: async () => {
      if (_fetchPromise) return _fetchPromise;

      let thisPromise: Promise<Wishlist | null | undefined> | null = null;
      const currentPromise = (async () => {
        try {
          set({ loading: true, error: null });
          const wishlist = await apiFetchCurrentWishlist();
          set({ currentWishlist: wishlist, loading: false });
          return wishlist;
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to fetch wishlist');
          set({ currentWishlist: null, loading: false, error });
          getLogger().error({ err }, 'Error fetching wishlist');
          return null;
        } finally {
          if (_fetchPromise === thisPromise) _fetchPromise = null;
        }
      })();
      thisPromise = currentPromise;
      _fetchPromise = currentPromise;
      return currentPromise;
    },

    addItem: async (productId, quantity) => {
      try {
        set({ loading: true, error: null });
        const wishlist = await apiAddItemToWishlist(productId, quantity);
        set({ currentWishlist: wishlist, loading: false });
        return wishlist;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to add item to wishlist');
        set({ error, loading: false });
        getLogger().error({ err }, 'Error adding item to wishlist');
        throw err;
      }
    },

    updateItemQuantity: async (productId, quantity) => {
      try {
        set({ loading: true, error: null });
        const wishlist = await apiUpdateWishlistItemQuantity(productId, quantity);
        set({ currentWishlist: wishlist, loading: false });
        return wishlist;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update wishlist item');
        set({ error, loading: false });
        getLogger().error({ err }, 'Error updating wishlist item');
        throw err;
      }
    },

    removeItem: async (productId) => {
      try {
        set({ loading: true, error: null });
        const wishlist = await apiRemoveWishlistItem(productId);
        set({ currentWishlist: wishlist, loading: false });
        return wishlist;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to remove wishlist item');
        set({ error, loading: false });
        getLogger().error({ err }, 'Error removing wishlist item');
        throw err;
      }
    },

    moveItemToCart: async (productId) => {
      try {
        set({ loading: true, error: null });
        const result = await apiMoveWishlistItemToCart(productId);
        set({ currentWishlist: result.wishlist, loading: false });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to move wishlist item to cart');
        set({ error, loading: false });
        getLogger().error({ err }, 'Error moving wishlist item to cart');
        throw err;
      }
    },

    clearWishlist: () => {
      _fetchPromise = null;
      set({ currentWishlist: null, loading: false, error: null });
    },
  }));
};
