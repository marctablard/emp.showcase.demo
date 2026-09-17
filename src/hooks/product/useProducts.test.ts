import { type ReactNode, createElement } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { fetchProductById } from '@/lib/client/products';
import type { Product } from '@/platform/services/model/product';
import { ProductStoreContext } from '@/providers/StoreProvider';
import { createProductStore } from '@/stores/products-store';
import { mergeProductFetchResults, useProducts } from './useProducts';

let mockClientFetchScope = 'all:main:cust-a';

jest.mock('@/hooks/common/useClientFetchScope', () => ({
  useClientFetchScope: () => mockClientFetchScope,
}));

jest.mock('@/hooks/common/useLogger', () => ({
  useLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

jest.mock('@/lib/client/products', () => ({
  fetchProductById: jest.fn(),
}));

const product = (id: string): Product => ({ id, name: id }) as Product;

describe('mergeProductFetchResults', () => {
  it('keeps cached products that were not requested in this pass', () => {
    const cached = product('cached');
    const fetched = product('fresh');

    expect(
      mergeProductFetchResults(
        ['cached', 'fresh'],
        [fetched],
        (id) => (id === 'cached' ? cached : null),
        new Set(['fresh']),
      ),
    ).toEqual([cached, fetched]);
  });

  it('drops a confirmed miss instead of reusing the id-keyed store entry', () => {
    const stale = product('stale');

    expect(
      mergeProductFetchResults(['stale'], [null], (id) => (id === 'stale' ? stale : null), new Set(['stale'])),
    ).toEqual([]);
  });
});

describe('useProducts scope race (COP-4822)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClientFetchScope = 'all:main:cust-a';
  });

  it('discards a response from a superseded scope instead of committing it to the list or the store', async () => {
    const store = createProductStore();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ProductStoreContext.Provider, { value: store }, children);

    let resolveStale: (value: Product | null) => void = () => {};
    (fetchProductById as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise<Product | null>((resolve) => {
            resolveStale = resolve;
          }),
      )
      // Refetch under the new (assigned) scope: the product is out of segment → 404 → null.
      .mockResolvedValueOnce(null);

    const ids = ['p-1'];
    const { result, rerender } = renderHook(() => useProducts(ids), { wrapper });

    await waitFor(() => expect(fetchProductById).toHaveBeenCalledTimes(1));
    expect(fetchProductById).toHaveBeenLastCalledWith('p-1', undefined, 'all:main:cust-a');

    // Mode / customer transition while the first request is still in flight.
    mockClientFetchScope = 'assigned:main:cust-a';
    await act(async () => {
      rerender();
    });

    await waitFor(() => expect(fetchProductById).toHaveBeenCalledTimes(2));
    expect(fetchProductById).toHaveBeenLastCalledWith('p-1', undefined, 'assigned:main:cust-a');
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products).toEqual([]);

    // The old-scope response resolves late: it must be ignored.
    await act(async () => {
      resolveStale(product('p-1'));
    });

    expect(result.current.products).toEqual([]);
    expect(store.getState().getProduct('p-1')).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('does not accept an id-keyed store entry from another scope on first assigned mount', async () => {
    mockClientFetchScope = 'assigned:main:cust-b';
    const store = createProductStore();
    store.getState().addProduct(product('p-foreign'));
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ProductStoreContext.Provider, { value: store }, children);

    (fetchProductById as jest.Mock).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useProducts(['p-foreign']), { wrapper });

    await waitFor(() => expect(fetchProductById).toHaveBeenCalledTimes(1));
    expect(fetchProductById).toHaveBeenCalledWith('p-foreign', undefined, 'assigned:main:cust-b');
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products).toEqual([]);
  });

  it('clears the list on scope change so CompareView cannot keep the previous scope while refetching', async () => {
    const store = createProductStore();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ProductStoreContext.Provider, { value: store }, children);

    (fetchProductById as jest.Mock)
      .mockResolvedValueOnce(product('p-1'))
      .mockImplementationOnce(() => new Promise<Product | null>(() => {}));

    const { result, rerender } = renderHook(() => useProducts(['p-1']), { wrapper });

    await waitFor(() => expect(result.current.products).toEqual([product('p-1')]));

    mockClientFetchScope = 'assigned:main:cust-a';
    await act(async () => {
      rerender();
    });

    expect(result.current.products).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(fetchProductById).toHaveBeenLastCalledWith('p-1', undefined, 'assigned:main:cust-a');
  });
});
