'use client';

import { type ReactNode, createContext, useContext, useMemo } from 'react';
import type { ProductsMode } from '@/platform/services/products-mode/ProductsModeService';

/**
 * Client-side view of the server-resolved products mode (COP-4822). Seeded once per request by
 * the nav-shell layout from `getProductsModeContext`; never derives identity or segments itself.
 */
export interface ProductsModeContextValue {
  mode: ProductsMode;
  /** `true` only in `assigned` mode; `all` is unscoped like `anonymous` / `unsegmented`. */
  isSegmented: boolean;
  /** `NEXT_PUBLIC_ALLOW_SEGMENTS_OVERRIDE` on AND segmented (any engine) — the "all products" toggle may render. */
  canToggleAllProducts: boolean;
}

export const ANONYMOUS_PRODUCTS_MODE: ProductsModeContextValue = {
  mode: 'anonymous',
  isSegmented: false,
  canToggleAllProducts: false,
};

const ProductsModeContext = createContext<ProductsModeContextValue>(ANONYMOUS_PRODUCTS_MODE);

export function ProductsModeProvider({
  value,
  children,
}: Readonly<{ value: ProductsModeContextValue; children: ReactNode }>) {
  const { mode, isSegmented, canToggleAllProducts } = value;
  const memoised = useMemo<ProductsModeContextValue>(
    () => ({ mode, isSegmented, canToggleAllProducts }),
    [mode, isSegmented, canToggleAllProducts],
  );
  return <ProductsModeContext.Provider value={memoised}>{children}</ProductsModeContext.Provider>;
}

/** Products mode of the current page, or the anonymous default outside a `ProductsModeProvider`. */
export function useProductsMode(): ProductsModeContextValue {
  return useContext(ProductsModeContext);
}
