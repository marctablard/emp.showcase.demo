import { act, renderHook, waitFor } from '@testing-library/react';
import { createOrderRequestKey } from '@/lib/order/create-order-request-key';
import type { Order } from '@/platform/services/model/order/order';
// eslint-disable-next-line import/first, import/order
import { useOrders } from './useOrders';

const mockUseOrderStore = jest.fn();
const mockUseSession = jest.fn();

jest.mock('@/providers/StoreProvider', () => ({
  useOrderStore: () => mockUseOrderStore(),
}));

jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => mockUseSession(),
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
  reset: jest.Mock<void, []>;
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
      reset: jest.fn(() => {
        ordersByQuery = {};
      }),
    };

    mockUseOrderStore.mockReturnValue(store);
    mockUseSession.mockReturnValue({ session: { legalEntityId: 'entity-A' } });
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
      expect(store.setOrders).toHaveBeenCalledWith(canonicalQueryKey, ssrOrders, undefined);
    });

    expect(store.fetchOrders).not.toHaveBeenCalled();
  });

  it('allows a second consumer to read the fresh canonical orders from cache', async () => {
    const staleOrders = [createOrder('stale-order')];
    const ssrOrders = [createOrder('fresh-order')];
    ordersByQuery[canonicalQueryKey] = staleOrders;

    renderHook(() => useOrders({ initialOrders: ssrOrders }));

    await waitFor(() => {
      expect(store.setOrders).toHaveBeenCalledWith(canonicalQueryKey, ssrOrders, undefined);
    });

    const { result } = renderHook(() => useOrders());
    expect(result.current.orders).toEqual(ssrOrders);
    expect(store.fetchOrders).not.toHaveBeenCalled();
  });

  it('seeds an empty canonical cache from initialOrders without triggering a duplicate mount fetch', async () => {
    const ssrOrders = [createOrder('fresh-order')];

    renderHook(() => useOrders({ initialOrders: ssrOrders }));

    await waitFor(() => {
      expect(store.setOrders).toHaveBeenCalledWith(canonicalQueryKey, ssrOrders, undefined);
    });

    expect(store.setOrders).toHaveBeenCalledTimes(1);
    expect(store.fetchOrders).not.toHaveBeenCalled();
  });

  it('returns undefined totalCount when initialTotalCount is absent even if initialOrders exist', async () => {
    const ssrOrders = [createOrder('fresh-order')];

    const { result } = renderHook(() => useOrders({ initialOrders: ssrOrders }));

    await waitFor(() => {
      expect(store.setOrders).toHaveBeenCalledWith(canonicalQueryKey, ssrOrders, undefined);
    });

    expect(result.current.totalCount).toBeUndefined();
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

  it('does not auto-fetch when the current request key already has a stored error', async () => {
    const searchQuery = 'boom';
    const searchedQueryKey = createOrderRequestKey(50, 1, searchQuery);
    const storedError = new Error('failed to load orders');
    store.getError = jest.fn((query: string) => (query === searchedQueryKey ? storedError : null));

    const { result } = renderHook(() => useOrders({ query: searchQuery }));

    await waitFor(() => {
      expect(result.current.error).toBe(storedError);
    });

    expect(store.fetchOrders).not.toHaveBeenCalled();
  });

  it('still refetches explicitly for a request key that has a stored error', async () => {
    const searchQuery = 'boom';
    const storedError = new Error('failed to load orders');
    store.getError = jest.fn((_query: string) => storedError);

    const { result } = renderHook(() => useOrders({ query: searchQuery }));

    await waitFor(() => {
      expect(result.current.error).toBe(storedError);
    });

    await act(async () => {
      await result.current.refetchOrders();
    });

    expect(store.fetchOrders).toHaveBeenCalledWith(50, 1, false, searchQuery, undefined);
  });

  it('auto-fetches once for a new request key even when a different key has a stored error', async () => {
    const failedQuery = 'boom';
    const newQuery = 'fresh';
    const failedQueryKey = createOrderRequestKey(50, 1, failedQuery);
    const storedError = new Error('failed to load orders');
    store.getError = jest.fn((query: string) => (query === failedQueryKey ? storedError : null));

    renderHook(() => useOrders({ query: newQuery }));

    await waitFor(() => {
      expect(store.fetchOrders).toHaveBeenCalledWith(50, 1, false, newQuery, undefined);
    });
  });

  it('resets to page one synchronously when the query changes, never fetching {new query, old page}', async () => {
    const { result, rerender } = renderHook(({ query }: { query?: string }) => useOrders({ query }), {
      initialProps: { query: undefined as string | undefined },
    });

    await waitFor(() => {
      expect(store.fetchOrders).toHaveBeenCalledWith(50, 1, false, undefined, undefined);
    });
    store.fetchOrders.mockClear();

    act(() => {
      result.current.setPageNumber(3);
    });
    expect(result.current.pageNumber).toBe(3);

    rerender({ query: 'boom' });

    expect(result.current.pageNumber).toBe(1);

    const staleCall = store.fetchOrders.mock.calls.find(([, page, , q]) => q === 'boom' && page === 3);
    expect(staleCall).toBeUndefined();

    await waitFor(() => {
      expect(store.fetchOrders).toHaveBeenCalledWith(50, 1, false, 'boom', undefined);
    });
  });

  it('does not trigger an extra page-one transition when the same query is passed again', async () => {
    const { result, rerender } = renderHook(({ query }: { query?: string }) => useOrders({ query }), {
      initialProps: { query: 'same' },
    });

    await waitFor(() => {
      expect(result.current.pageNumber).toBe(1);
    });

    act(() => {
      result.current.setPageNumber(2);
    });
    expect(result.current.pageNumber).toBe(2);

    rerender({ query: 'same' });

    expect(result.current.pageNumber).toBe(2);
  });

  it('resets the order store and force-refreshes when the session legal entity id changes after mount', async () => {
    mockUseSession.mockReturnValue({ session: { legalEntityId: 'entity-A' } });
    const { rerender } = renderHook(() => useOrders());

    await waitFor(() => {
      expect(store.fetchOrders).toHaveBeenCalledWith(50, 1, false, undefined, undefined);
    });
    expect(store.reset).not.toHaveBeenCalled();

    mockUseSession.mockReturnValue({ session: { legalEntityId: 'entity-B' } });
    rerender();

    await waitFor(() => {
      expect(store.reset).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(store.fetchOrders).toHaveBeenCalledWith(50, 1, true, undefined, undefined);
    });
  });

  it('does not reset the order store on rerender when legal entity id is unchanged', async () => {
    mockUseSession.mockReturnValue({ session: { legalEntityId: 'entity-A' } });
    const { rerender } = renderHook(() => useOrders());

    await waitFor(() => {
      expect(store.fetchOrders).toHaveBeenCalledWith(50, 1, false, undefined, undefined);
    });

    rerender();
    rerender();

    expect(store.reset).not.toHaveBeenCalled();
  });

  it('resets to page one synchronously when clearing query, never fetching {empty query, old page}', async () => {
    const { result, rerender } = renderHook(({ query }: { query?: string }) => useOrders({ query }), {
      initialProps: { query: 'status:CREATED' as string | undefined },
    });

    await waitFor(() => {
      expect(store.fetchOrders).toHaveBeenCalledWith(50, 1, false, 'status:CREATED', undefined);
    });
    store.fetchOrders.mockClear();

    act(() => {
      result.current.setPageNumber(4);
    });
    expect(result.current.pageNumber).toBe(4);

    rerender({ query: undefined });

    expect(result.current.pageNumber).toBe(1);

    const staleCall = store.fetchOrders.mock.calls.find(([, page, , q]) => q === undefined && page === 4);
    expect(staleCall).toBeUndefined();

    await waitFor(() => {
      expect(store.fetchOrders).toHaveBeenCalledWith(50, 1, false, undefined, undefined);
    });
  });
});
