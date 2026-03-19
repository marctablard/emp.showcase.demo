import { create } from 'zustand/react';
import { Product } from '@/platform/services/model/product';

// src/stores/counter-store.ts
// re-export for convenience
export { useProductStore } from '@/providers/StoreProvider';

export type ProductState = {
  currentProductId: string | null;
  products: {
    [id: string]: Product | null;
  };
  variantsByParentId: Record<string, Product[]>;
};

export type ProductActions = {
  getProduct: (id: string) => Product | null;
  getProducts: (ids: string[]) => Product[];
  getCurrentProduct: () => Product | null;
  setCurrentProduct: (product: Product | null) => void;
  addProduct: (product: Product | string) => void;
  addProducts: (products: Product[]) => void;
  getVariants: (parentId: string) => Product[] | undefined;
  setVariants: (parentId: string, variants: Product[]) => void;
};

export type ProductStore = ProductState & ProductActions;

const defaultState: ProductState = {
  currentProductId: null,
  products: {},
  variantsByParentId: {},
};

export const createProductStore = (initState: ProductState = defaultState) => {
  return create<ProductStore>()((set, get) => ({
    ...initState,
    setCurrentProduct: (product: Product | null) =>
      set((state) => {
        if (product?.id == state.currentProductId) {
          return state;
        }
        if (product) {
          return { currentProductId: product.id, products: { ...state.products, [product.id]: product } };
        }
        return { currentProductId: null };
      }),
    addProduct: (product: Product | string) =>
      set((state) => {
        if (product) {
          if (typeof product === 'string') {
            state.products = {
              ...state.products,
              [product]: null,
            };
          } else {
            state.products = {
              ...state.products,
              [product.id]: product,
            };
          }
        }
        return state;
      }),
    addProducts: (products: Product[]) =>
      set((state) => {
        const newProducts = { ...state.products };
        products.forEach((product) => {
          if (typeof product === 'string') {
            newProducts[product] = null;
          } else {
            newProducts[product.id] = product;
          }
        });
        return { ...state, products: newProducts };
      }),
    getCurrentProduct: () => {
      const state = get();
      return state.currentProductId ? state.products[state.currentProductId] : null;
    },
    getProduct: (id: string) => {
      const state = get();
      return state.products[id] || null;
    },
    getProducts: (ids: string[]) => {
      const state = get();
      return ids.map((id) => state.products[id]).filter(Boolean) as Product[];
    },
    getVariants: (parentId: string) => {
      return get().variantsByParentId[parentId];
    },
    setVariants: (parentId: string, variants: Product[]) =>
      set((state) => ({
        variantsByParentId: { ...state.variantsByParentId, [parentId]: variants },
      })),
  }));
};
