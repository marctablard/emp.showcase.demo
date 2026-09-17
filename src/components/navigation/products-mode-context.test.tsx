/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { type ProductsModeContextValue, ProductsModeProvider, useProductsMode } from './products-mode-context';

describe('useProductsMode', () => {
  it('returns the anonymous default outside a ProductsModeProvider', () => {
    const { result } = renderHook(() => useProductsMode());

    expect(result.current).toEqual({ mode: 'anonymous', isSegmented: false, canToggleAllProducts: false });
  });

  it('returns the provided value inside a ProductsModeProvider', () => {
    const value: ProductsModeContextValue = { mode: 'assigned', isSegmented: true, canToggleAllProducts: true };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ProductsModeProvider value={value}>{children}</ProductsModeProvider>
    );

    const { result } = renderHook(() => useProductsMode(), { wrapper });

    expect(result.current).toEqual(value);
  });

  it('keeps a stable value reference across rerenders with unchanged fields', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ProductsModeProvider value={{ mode: 'all', isSegmented: false, canToggleAllProducts: true }}>
        {children}
      </ProductsModeProvider>
    );

    const { result, rerender } = renderHook(() => useProductsMode(), { wrapper });
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });
});
