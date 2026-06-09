'use client';

import { useComparisonStore } from '@/providers/StoreProvider';
import { MAX_COMPARISON_PRODUCTS } from '@/stores/comparison-store';

interface UseComparisonResult {
  productIds: string[];
  count: number;
  addProduct: (productId: string) => boolean;
  removeProduct: (productId: string) => void;
  toggleProduct: (productId: string) => void;
  isInComparison: (productId: string) => boolean;
  clearComparison: () => void;
  isFull: boolean;
}

export const useComparison = (): UseComparisonResult => {
  const store = useComparisonStore();

  const toggleProduct = (productId: string): void => {
    if (store.isInComparison(productId)) {
      store.removeProduct(productId);
    } else {
      store.addProductId(productId);
    }
  };

  return {
    productIds: store.productIds,
    count: store.getCount(),
    addProduct: store.addProductId,
    removeProduct: store.removeProduct,
    toggleProduct,
    isInComparison: store.isInComparison,
    clearComparison: store.clearComparison,
    isFull: store.productIds.length >= MAX_COMPARISON_PRODUCTS,
  };
};

export default useComparison;
