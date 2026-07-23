import { renderHook, waitFor } from '@testing-library/react';
import { createOrderRequestKey } from '@/lib/order/create-order-request-key';
import type { Order } from '@/platform/services/model/order/order';
import { useOrders } from './useOrders';

const mockUseOrderStore = jest.fn();

jest.mock('@/providers/StoreProvider', () => ({
  useOrderStore: () => mockUseOrderStore(),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  }),
}));

interface MockOrderStore {
  getOrders: jest.Mock<Order[] | undefined, [string]>;
  getTotalCount: jest.Mock<number | undefined, [string]>;
  setOrders: jest.Mock<void, [string, Order[], number?]>;
  getLoading: jest.Mock<boolean, [string]>;
  getError: jest.Mock<Error | null, [string]>;
  fetchOrders: jest.Mock<Promise<Order[]>, [number, number, boolean, string?, string?]>;
}

function createOrder(id: string): Order {
  return {
    id,
    status: 'CONFIRMED',
    createdAt: '2026-01-01T10:00:00.000Z',
    items: [],
  } as Order;
}

describe('useOrders', () => {
  let ordersByQuery: Record<string, Order[]>;
  let store: MockOrderStore;

  const canonicalQueryKey = createOrderRequestKey(50, 1);

  beforeEach(() => {
    ordersByQuery = {};

    store = {
      getOrders: jest.fn((query: string) => ordersByQuery[query]),
      getTotalCount: jest.fn((_query: string) => undefined),
      setOrders: jest.fn((query: string, orders: Order[]) => {
        ordersByQuery[query] = orders;
      }),
      getLoading: jest.fn((_query: string) => false),
      getError: jest.fn((_query: string) => null),
      fetchOrders: jest.fn().mockResolvedValue([]),
    };

    mockUseOrderStore.mockReturnValue(store);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('replaces stale canonical cached orders with initialOrders and does not call client fetch', async () => {
    const staleOrders = [createOrder('stale-order')];
    const ssrOrders = [createOrder('fresh-order')];
    ordersByQuery[canonicalQueryKey] = staleOrders;

    renderHook(() => useOrders({ initialOrders: ssrOrders }));

    await waitFor(() => {
      expect(store.setOrders).toHaveBeenCalledWith(canonicalQueryKey, ssrOrders, ssrOrders.length);
    });

    expect(store.fetchOrders).not.toHaveBeenCalled();
  });

  it('allows a second consumer to read the fresh canonical orders from cache', async () => {
    const staleOrders = [createOrder('stale-order')];
    const ssrOrders = [createOrder('fresh-order')];
    ordersByQuery[canonicalQueryKey] = staleOrders;

    renderHook(() => useOrders({ initialOrders: ssrOrders }));

    await waitFor(() => {
      expect(store.setOrders).toHaveBeenCalledWith(canonicalQueryKey, ssrOrders, ssrOrders.length);
    });

    const { result } = renderHook(() => useOrders());
    expect(result.current.orders).toEqual(ssrOrders);
    expect(store.fetchOrders).not.toHaveBeenCalled();
  });

  it('seeds an empty canonical cache from initialOrders without triggering a duplicate mount fetch', async () => {
    const ssrOrders = [createOrder('fresh-order')];

    renderHook(() => useOrders({ initialOrders: ssrOrders }));

    await waitFor(() => {
      expect(store.setOrders).toHaveBeenCalledWith(canonicalQueryKey, ssrOrders, ssrOrders.length);
    });

    expect(store.setOrders).toHaveBeenCalledTimes(1);
    expect(store.fetchOrders).not.toHaveBeenCalled();
  });

  it('does not seed searched-query caches from initialOrders and performs the scoped search fetch once', async () => {
    const ssrOrders = [createOrder('fresh-order')];
    const searchQuery = 'order-9';
    const searchedQueryKey = createOrderRequestKey(50, 1, searchQuery);

    renderHook(() => useOrders({ initialOrders: ssrOrders, query: searchQuery }));

    await waitFor(() => {
      expect(store.fetchOrders).toHaveBeenCalledWith(50, 1, false, searchQuery, undefined);
    });

    expect(store.fetchOrders).toHaveBeenCalledTimes(1);
    expect(store.setOrders).not.toHaveBeenCalledWith(searchedQueryKey, ssrOrders);
  });

  it('forwards sort to server fetch and uses it in request keying', async () => {
    const searchQuery = 'status:CREATED';
    const sort = 'created:desc';

    renderHook(() => useOrders({ query: searchQuery, sort }));

    await waitFor(() => {
      expect(store.fetchOrders).toHaveBeenCalledWith(50, 1, false, searchQuery, sort);
    });
  });

  it('hydrates from SSR initialRequest with initialTotalCount and avoids duplicate client fetch', async () => {
    const initialOrders = [createOrder('order-1')];
    const initialRequestKey = createOrderRequestKey(5, 1, undefined, 'created:DESC');

    renderHook(() =>
      useOrders({
        initialOrders,
        initialTotalCount: 14,
        pageSize: 5,
        pageNumber: 1,
        sort: 'created:DESC',
        initialRequest: {
          pageSize: 5,
          pageNumber: 1,
          sort: 'created:DESC',
          query: undefined,
        },
      }),
    );

    await waitFor(() => {
      expect(store.setOrders).toHaveBeenCalledWith(initialRequestKey, initialOrders, 14);
    });

    expect(store.fetchOrders).not.toHaveBeenCalled();
  });
});
