import { createOrderRequestKey } from '@/lib/order/create-order-request-key';
import { createOrderStore } from '../order-store';

// Mock the API calls
jest.mock('@/lib/client/orders', () => ({
  fetchOrdersPage: jest.fn(),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: jest.fn(() => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  })),
}));

const mockFetchOrdersPage = require('@/lib/client/orders').fetchOrdersPage;
const { getLogger: mockGetLogger } = require('@/lib/logger/use-logger-client');
const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
};

describe('OrderStore', () => {
  let store: ReturnType<typeof createOrderStore>;

  beforeEach(() => {
    mockFetchOrdersPage.mockClear();
    Object.values(mockLogger).forEach((fn) => fn.mockClear());
    mockGetLogger.mockReset();
    mockGetLogger.mockReturnValue(mockLogger);
    store = createOrderStore();
  });

  it('should prevent duplicate fetches for the same query', async () => {
    const mockOrders = [
      { id: '1', status: 'CREATED', total: { amount: 100, currency: 'EUR' } },
      { id: '2', status: 'CONFIRMED', total: { amount: 200, currency: 'EUR' } },
    ];

    mockFetchOrdersPage.mockResolvedValue({ items: mockOrders, totalCount: 2 });

    // Start two concurrent fetches with the same parameters
    const promise1 = store.getState().fetchOrders(10, 1);
    const promise2 = store.getState().fetchOrders(10, 1);

    // Both should resolve to the same result
    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(result1).toEqual(mockOrders);
    expect(result2).toEqual(mockOrders);

    // But the API should only be called once
    expect(mockFetchOrdersPage).toHaveBeenCalledTimes(1);
  });

  it('should handle different queries separately', async () => {
    const mockOrders1 = [{ id: '1', status: 'CREATED', total: { amount: 100, currency: 'EUR' } }];
    const mockOrders2 = [{ id: '2', status: 'CONFIRMED', total: { amount: 200, currency: 'EUR' } }];

    mockFetchOrdersPage
      .mockResolvedValueOnce({ items: mockOrders1, totalCount: 1 })
      .mockResolvedValueOnce({ items: mockOrders2, totalCount: 1 });

    // Fetch with different parameters
    const promise1 = store.getState().fetchOrders(10, 1);
    const promise2 = store.getState().fetchOrders(20, 1);

    await Promise.all([promise1, promise2]);

    // API should be called twice for different queries
    expect(mockFetchOrdersPage).toHaveBeenCalledTimes(2);
  });

  it('should return cached data when available', async () => {
    const mockOrders = [{ id: '1', status: 'CREATED', total: { amount: 100, currency: 'EUR' } }];

    mockFetchOrdersPage.mockResolvedValue({ items: mockOrders, totalCount: 1 });

    // First fetch
    await store.getState().fetchOrders(10, 1);

    // Second fetch should return cached data without API call
    const cachedResult = await store.getState().fetchOrders(10, 1);

    expect(cachedResult).toEqual(mockOrders);
    expect(mockFetchOrdersPage).toHaveBeenCalledTimes(1);
  });

  it('should handle errors properly', async () => {
    const error = new Error('API Error');
    mockFetchOrdersPage.mockRejectedValue(error);

    await expect(store.getState().fetchOrders(10, 1)).rejects.toThrow('API Error');

    // Check that error state is set
    const queryKey = createOrderRequestKey(10, 1);
    expect(store.getState().getError(queryKey)).toEqual(error);
    expect(store.getState().getLoading(queryKey)).toBe(false);

    expect(mockLogger.error).toHaveBeenCalledWith({ err: error }, 'Error fetching orders');
  });

  it('should bypass cache and re-fetch when forceRefresh is true', async () => {
    const mockOrders = [{ id: '1', status: 'CREATED', total: { amount: 100, currency: 'EUR' } }];
    const updatedOrders = [
      { id: '1', status: 'SHIPPED', total: { amount: 100, currency: 'EUR' } },
      { id: '2', status: 'CREATED', total: { amount: 50, currency: 'EUR' } },
    ];

    mockFetchOrdersPage
      .mockResolvedValueOnce({ items: mockOrders, totalCount: 1 })
      .mockResolvedValueOnce({ items: updatedOrders, totalCount: 2 });

    // First fetch populates cache
    await store.getState().fetchOrders(10, 1);
    expect(mockFetchOrdersPage).toHaveBeenCalledTimes(1);

    // Second fetch with forceRefresh should call API again
    const result = await store.getState().fetchOrders(10, 1, true);

    expect(mockFetchOrdersPage).toHaveBeenCalledTimes(2);
    expect(result).toEqual(updatedOrders);
  });

  it('should still deduplicate concurrent forceRefresh calls', async () => {
    const mockOrders = [{ id: '1', status: 'CREATED', total: { amount: 100, currency: 'EUR' } }];

    mockFetchOrdersPage.mockResolvedValue({ items: mockOrders, totalCount: 1 });

    // Start two concurrent forceRefresh fetches with the same parameters
    const promise1 = store.getState().fetchOrders(10, 1, true);
    const promise2 = store.getState().fetchOrders(10, 1, true);

    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(result1).toEqual(mockOrders);
    expect(result2).toEqual(mockOrders);

    // API should only be called once due to ongoingFetches deduplication
    expect(mockFetchOrdersPage).toHaveBeenCalledTimes(1);
  });

  it('stores total count per request key', async () => {
    const mockOrders = [{ id: '1', status: 'CREATED', total: { amount: 100, currency: 'EUR' } }];
    mockFetchOrdersPage.mockResolvedValue({ items: mockOrders, totalCount: 42 });

    await store.getState().fetchOrders(10, 2, false, 'status:CREATED', 'created:desc');

    const queryKey = createOrderRequestKey(10, 2, 'status:CREATED', 'created:desc');

    expect(store.getState().getTotalCount(queryKey)).toBe(42);
  });
});
