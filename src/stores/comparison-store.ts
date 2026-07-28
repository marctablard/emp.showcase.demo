import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { create } from 'zustand/react';

// re-export for convenience
export { useComparisonStore } from '@/providers/StoreProvider';

export const MAX_COMPARISON_PRODUCTS = 4;

export type ComparisonState = {
  productIds: string[];
};

export type ComparisonActions = {
  addProductId: (productId: string) => boolean;
  removeProduct: (productId: string) => void;
  isInComparison: (productId: string) => boolean;
  clearComparison: () => void;
  getCount: () => number;
};

export type ComparisonStore = ComparisonState & ComparisonActions;

const defaultState: ComparisonState = {
  productIds: [],
};

export const createComparisonStore = (initState?: ComparisonState, storageKey?: string) => {
  const name = storageKey || process.env.NEXT_PUBLIC_COMPARISON_STORAGE_NAME || 'comparison-storage';

  return create<ComparisonStore>()(
    persist(
      immer((set, get) => ({
        ...(initState ?? defaultState),
        addProductId: (productId: string): boolean => {
          const state = get();
          if (state.productIds.includes(productId)) {
            return false;
          }
          if (state.productIds.length >= MAX_COMPARISON_PRODUCTS) {
            return false;
          }
          set((draft) => {
            draft.productIds.push(productId);
          });
          return true;
        },
        removeProduct: (productId: string) =>
          set((state) => {
            state.productIds = state.productIds.filter((id) => id !== productId);
          }),
        isInComparison: (productId: string): boolean => {
          return get().productIds.includes(productId);
        },
        clearComparison: () =>
          set((state) => {
            state.productIds = [];
          }),
        getCount: (): number => get().productIds.length,
      })),
      {
        name,
      },
    ),
  );
};
