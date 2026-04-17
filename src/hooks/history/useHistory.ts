'use client';

import type { Product } from '@/platform/services/model/product';
import { useHistoryStore } from '@/providers/StoreProvider';

interface UseHistoryResult {
  lastSeenProducts: Product[];
  searchHistory: string[];
  addLastSeenProduct: (product: Product) => void;
  addSearchQuery: (query: string) => void;
  clearLastSeenProducts: () => void;
  clearSearchHistory: () => void;
}

/**
 * User History hook that allows to manage user history
 * (basically a wrapper around the underlying persistance layer)
 * @returns UserHistoryResult
 */
export const useHistory = (): UseHistoryResult => {
  const {
    lastSeenProducts,
    searchHistory,
    addLastSeenProduct,
    addSearchQuery,
    clearLastSeenProducts,
    clearSearchHistory,
  } = useHistoryStore();

  return {
    lastSeenProducts,
    searchHistory,
    addLastSeenProduct,
    addSearchQuery,
    clearLastSeenProducts,
    clearSearchHistory,
  };
};

export default useHistory;
