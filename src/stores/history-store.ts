import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { create } from 'zustand/react';
import type { Product } from '@/platform/services/model/product';

// re-export for convenience
export { useHistoryStore } from '@/providers/StoreProvider';

export type HistoryState = {
  lastSeenProducts: Product[];
  searchHistory: string[];
};

export type HistoryActions = {
  addLastSeenProduct: (product: Product) => void;
  addSearchQuery: (query: string) => void;
  clearLastSeenProducts: () => void;
  clearSearchHistory: () => void;
  getLastSeenProducts: () => Product[];
  getSearchHistory: () => string[];
};

export type HistoryStore = HistoryState & HistoryActions;

const defaultState: HistoryState = {
  lastSeenProducts: [],
  searchHistory: [],
};

/**
 * Generic function to add an item to a history array with a maximum size
 * @param array The array to add the item to
 * @param item The item to add
 * @param maxSize The maximum size of the array
 * @param compareFn Optional function to compare items for equality (defaults to strict equality)
 */
function addToHistoryArray<T>(array: T[], item: T, maxSize: number, compareFn?: (a: T, b: T) => boolean): void {
  // Check if item already exists in the array
  const existingIndex = compareFn
    ? array.findIndex((existing) => compareFn(existing, item))
    : array.indexOf(item as any);

  // If it exists, remove it
  if (existingIndex !== -1) {
    array.splice(existingIndex, 1);
  }

  // Add the item to the end of the array
  array.push(item);

  // If the array exceeds the maximum size, remove the oldest item (FIFO)
  if (array.length > maxSize) {
    array.shift();
  }
}

export const createHistoryStore = (initState: HistoryState = defaultState) => {
  const MAX_SEARCH_HISTORY = parseInt(process.env.NEXT_PUBLIC_MAX_SEARCH_HISTORY || '10', 10);
  const MAX_LAST_SEEN_PRODUCTS = parseInt(process.env.NEXT_PUBLIC_MAX_LAST_SEEN_PRODUCTS || '10', 10);
  const HISTORY_STORAGE_NAME = process.env.NEXT_PUBLIC_HISTORY_STORAGE_NAME || 'history-storage';

  return create<HistoryStore>()(
    persist(
      immer((set, get) => ({
        ...initState,
        addLastSeenProduct: (product: Product) =>
          set((state) => {
            addToHistoryArray(
              state.lastSeenProducts,
              product,
              MAX_LAST_SEEN_PRODUCTS,
              (a, b) => a.id.trim() === b.id.trim(),
            );
          }),
        addSearchQuery: (query: string) =>
          set((state) => {
            if (!query.trim()) return;
            addToHistoryArray(state.searchHistory, query, MAX_SEARCH_HISTORY);
          }),
        clearLastSeenProducts: () =>
          set((state) => {
            state.lastSeenProducts = [];
          }),
        clearSearchHistory: () =>
          set((state) => {
            state.searchHistory = [];
          }),
        getLastSeenProducts: () => get().lastSeenProducts,
        getSearchHistory: () => get().searchHistory,
      })),
      {
        name: HISTORY_STORAGE_NAME, // unique name for localStorage
      },
    ),
  );
};
