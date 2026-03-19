import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { HistoryStoreContext, StoreProvider, useHistoryStore } from '@/providers/StoreProvider';
import { createHistoryStore } from '@/stores/history-store';
import { useHistory } from './useHistory';

const mockProduct1 = {
  id: 'test-product-1',
  name: 'Test Product 1',
  description: 'This is test product 1',
  price: {
    amount: 99.99,
    currency: 'USD',
  },
  images: [{ url: 'https://example.com/image1.jpg' }],
  purchasable: true,
};

const mockProduct2 = {
  id: 'test-product-2',
  name: 'Test Product 2',
  description: 'This is test product 2',
  price: {
    amount: 149.99,
    currency: 'USD',
  },
  images: [{ url: 'https://example.com/image2.jpg' }],
  purchasable: true,
};

const originalEnv = process.env;

const wrapper = ({ children }: { children: ReactNode }) => <StoreProvider>{children}</StoreProvider>;

describe('useUserHistory hook', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    window.localStorage.clear();
    jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  test('should add a product to lastSeenProducts', async () => {
    const { result } = renderHook(() => useHistory(), { wrapper });
    expect(result.current.lastSeenProducts).toEqual([]);
    await act(async () => {
      result.current.addLastSeenProduct(mockProduct1);
    });
    expect(result.current.lastSeenProducts).toHaveLength(1);
    expect(result.current.lastSeenProducts[0]).toEqual(mockProduct1);
  });

  test('should add a search query to searchHistory', async () => {
    const { result } = renderHook(() => useHistory(), { wrapper });
    expect(result.current.searchHistory).toEqual([]);
    await act(async () => {
      result.current.addSearchQuery('test query');
    });

    expect(result.current.searchHistory).toHaveLength(1);
    expect(result.current.searchHistory[0]).toEqual('test query');
  });

  test('should not add duplicate products to lastSeenProducts', async () => {
    const { result } = renderHook(() => useHistory(), { wrapper });
    await act(async () => {
      result.current.addLastSeenProduct(mockProduct1);
      result.current.addLastSeenProduct(mockProduct1);
    });
    expect(result.current.lastSeenProducts).toHaveLength(1);
    expect(result.current.lastSeenProducts[0]).toEqual(mockProduct1);
  });

  test('should reorder products when adding an existing product', async () => {
    const { result } = renderHook(() => useHistory(), { wrapper });
    await act(async () => {
      result.current.addLastSeenProduct(mockProduct1);
      result.current.addLastSeenProduct(mockProduct2);
    });
    expect(result.current.lastSeenProducts).toHaveLength(2);
    expect(result.current.lastSeenProducts[0]).toEqual(mockProduct1);
    expect(result.current.lastSeenProducts[1]).toEqual(mockProduct2);
    await act(async () => {
      result.current.addLastSeenProduct(mockProduct1);
    });
    expect(result.current.lastSeenProducts).toHaveLength(2);
    expect(result.current.lastSeenProducts[0]).toEqual(mockProduct2);
    expect(result.current.lastSeenProducts[1]).toEqual(mockProduct1);
  });

  test('should clear lastSeenProducts', async () => {
    const { result } = renderHook(() => useHistory(), { wrapper });
    await act(async () => {
      result.current.addLastSeenProduct(mockProduct1);
      result.current.addLastSeenProduct(mockProduct2);
    });
    expect(result.current.lastSeenProducts).toHaveLength(2);
    await act(async () => {
      result.current.clearLastSeenProducts();
    });
    expect(result.current.lastSeenProducts).toHaveLength(0);
  });

  test('should clear searchHistory', async () => {
    const { result } = renderHook(() => useHistory(), { wrapper });

    await act(async () => {
      result.current.addSearchQuery('query 1');
      result.current.addSearchQuery('query 2');
    });

    expect(result.current.searchHistory).toHaveLength(2);

    await act(async () => {
      result.current.clearSearchHistory();
    });

    expect(result.current.searchHistory).toHaveLength(0);
  });

  test('should integrate with the store correctly', async () => {
    const sharedStore = createHistoryStore();

    const customWrapper = ({ children }: { children: ReactNode }) => (
      <HistoryStoreContext.Provider value={sharedStore}>{children}</HistoryStoreContext.Provider>
    );

    const { result: historyHookResult } = renderHook(() => useHistory(), { wrapper: customWrapper });
    const { result: storeResult } = renderHook(() => useHistoryStore(), { wrapper: customWrapper });

    await act(async () => {
      historyHookResult.current.addLastSeenProduct(mockProduct1);
    });

    expect(storeResult.current.lastSeenProducts).toHaveLength(1);
    expect(storeResult.current.lastSeenProducts[0]).toEqual(mockProduct1);

    await act(async () => {
      historyHookResult.current.addSearchQuery('test query');
    });

    expect(storeResult.current.searchHistory).toHaveLength(1);
    expect(storeResult.current.searchHistory[0]).toEqual('test query');
  });
});
