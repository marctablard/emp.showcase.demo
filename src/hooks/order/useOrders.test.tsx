import { renderHook, waitFor } from '@testing-library/react';
import { buildSearchQuery } from '@/platform/integrations/emporix/common/util/common';
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
  setOrders: jest.Mock<void, [string, Order[]]>;
  getLoading: jest.Mock<boolean, [string]>;
  getError: jest.Mock<Error | null, [string]>;
  fetchOrders: jest.Mock<Promise<Order[]>, [number, number, Record<string, any>, boolean, string?]>;
}

function createOrder(id: string): Order {
  return {
    id,
    status: 'CONFIRMED',
    createdAt: '2026-01-01T10:00:00.000Z',
    items: [],
  } as Order;
}

function createOrderQueryKey(
  page: number,
  size: number,
  filters: Record<string, any> = {},
  searchQuery?: string,
): string {
  const query = buildSearchQuery({
    page,
    size,
    criteria: filters,
  });

  return JSON.stringify({
    query: query.query,
    body: query.body,
    search: searchQuery ?? null,
  });
}

describe('useOrders', () => {
  let ordersByQuery: Record<string, Order[]>;
  let store: MockOrderStore;

  const canonicalQueryKey = createOrderQueryKey(1, 50);

  beforeEach(() => {
    ordersByQuery = {};

    store = {
      getOrders: jest.fn((query: string) => ordersByQuery[query]),
      setOrders: jest.fn((query: string, orders: Order[]) => {
        ordersByQuery[query] = orders;
      }),
      getLoading: jest.fn(() => false),
      getError: jest.fn(() => null),
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
      expect(store.setOrders).toHaveBeenCalledWith(canonicalQueryKey, ssrOrders);
    });

    expect(store.fetchOrders).not.toHaveBeenCalled();
  });

  it('allows a second consumer to read the fresh canonical orders from cache', async () => {
    const staleOrders = [createOrder('stale-order')];
    const ssrOrders = [createOrder('fresh-order')];
    ordersByQuery[canonicalQueryKey] = staleOrders;

    renderHook(() => useOrders({ initialOrders: ssrOrders }));

    await waitFor(() => {
      expect(store.setOrders).toHaveBeenCalledWith(canonicalQueryKey, ssrOrders);
    });

    const { result } = renderHook(() => useOrders());
    expect(result.current.orders).toEqual(ssrOrders);
    expect(store.fetchOrders).not.toHaveBeenCalled();
  });

  it('seeds an empty canonical cache from initialOrders without triggering a duplicate mount fetch', async () => {
    const ssrOrders = [createOrder('fresh-order')];

    renderHook(() => useOrders({ initialOrders: ssrOrders }));

    await waitFor(() => {
      expect(store.setOrders).toHaveBeenCalledWith(canonicalQueryKey, ssrOrders);
    });

    expect(store.setOrders).toHaveBeenCalledTimes(1);
    expect(store.fetchOrders).not.toHaveBeenCalled();
  });

  it('does not seed searched-query caches from initialOrders and performs the scoped search fetch once', async () => {
    const ssrOrders = [createOrder('fresh-order')];
    const searchQuery = 'order-9';
    const searchedQueryKey = createOrderQueryKey(1, 50, {}, searchQuery);

    renderHook(() => useOrders({ initialOrders: ssrOrders, query: searchQuery }));

    await waitFor(() => {
      expect(store.fetchOrders).toHaveBeenCalledWith(50, 1, {}, false, searchQuery);
    });

    expect(store.fetchOrders).toHaveBeenCalledTimes(1);
    expect(store.setOrders).not.toHaveBeenCalledWith(searchedQueryKey, ssrOrders);
  });
});
