import { createOrderStore } from '../order-store';

// Mock the API calls
jest.mock('@/lib/client/orders', () => ({
  fetchOrders: jest.fn(),
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

jest.mock('@/platform/integrations/emporix/common/util/common', () => ({
  buildSearchQuery: jest.fn(),
}));

const mockFetchOrders = require('@/lib/client/orders').fetchOrders;
const { buildSearchQuery: mockBuildSearchQuery } = require('@/platform/integrations/emporix/common/util/common');
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
    mockFetchOrders.mockClear();
    Object.values(mockLogger).forEach((fn) => fn.mockClear());
    mockGetLogger.mockReset();
    mockGetLogger.mockReturnValue(mockLogger);
    mockBuildSearchQuery.mockImplementation(
      (params: { page: number; size: number; criteria: Record<string, unknown> }) => ({
        query: `page=${params.page}&size=${params.size}`,
        body: JSON.stringify(params.criteria),
      }),
    );
    store = createOrderStore();
  });

  it('should prevent duplicate fetches for the same query', async () => {
    const mockOrders = [
      { id: '1', status: 'CREATED', total: { amount: 100, currency: 'EUR' } },
      { id: '2', status: 'CONFIRMED', total: { amount: 200, currency: 'EUR' } },
    ];

    mockFetchOrders.mockResolvedValue(mockOrders);

    // Start two concurrent fetches with the same parameters
    const promise1 = store.getState().fetchOrders(10, 1, {});
    const promise2 = store.getState().fetchOrders(10, 1, {});

    // Both should resolve to the same result
    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(result1).toEqual(mockOrders);
    expect(result2).toEqual(mockOrders);

    // But the API should only be called once
    expect(mockFetchOrders).toHaveBeenCalledTimes(1);
  });

  it('should handle different queries separately', async () => {
    const mockOrders1 = [{ id: '1', status: 'CREATED', total: { amount: 100, currency: 'EUR' } }];
    const mockOrders2 = [{ id: '2', status: 'CONFIRMED', total: { amount: 200, currency: 'EUR' } }];

    mockFetchOrders.mockResolvedValueOnce(mockOrders1).mockResolvedValueOnce(mockOrders2);

    // Fetch with different parameters
    const promise1 = store.getState().fetchOrders(10, 1, {});
    const promise2 = store.getState().fetchOrders(20, 1, {});

    await Promise.all([promise1, promise2]);

    // API should be called twice for different queries
    expect(mockFetchOrders).toHaveBeenCalledTimes(2);
  });

  it('should return cached data when available', async () => {
    const mockOrders = [{ id: '1', status: 'CREATED', total: { amount: 100, currency: 'EUR' } }];

    mockFetchOrders.mockResolvedValue(mockOrders);

    // First fetch
    await store.getState().fetchOrders(10, 1, {});

    // Second fetch should return cached data without API call
    const cachedResult = await store.getState().fetchOrders(10, 1, {});

    expect(cachedResult).toEqual(mockOrders);
    expect(mockFetchOrders).toHaveBeenCalledTimes(1);
  });

  it('should handle errors properly', async () => {
    const error = new Error('API Error');
    mockFetchOrders.mockRejectedValue(error);

    await expect(store.getState().fetchOrders(10, 1, {})).rejects.toThrow('API Error');

    // Check that error state is set
    const queryKey = 'page=1&size=10{}';
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

    mockFetchOrders.mockResolvedValueOnce(mockOrders).mockResolvedValueOnce(updatedOrders);

    // First fetch populates cache
    await store.getState().fetchOrders(10, 1, {});
    expect(mockFetchOrders).toHaveBeenCalledTimes(1);

    // Second fetch with forceRefresh should call API again
    const result = await store.getState().fetchOrders(10, 1, {}, true);

    expect(mockFetchOrders).toHaveBeenCalledTimes(2);
    expect(result).toEqual(updatedOrders);
  });

  it('should still deduplicate concurrent forceRefresh calls', async () => {
    const mockOrders = [{ id: '1', status: 'CREATED', total: { amount: 100, currency: 'EUR' } }];

    mockFetchOrders.mockResolvedValue(mockOrders);

    // Start two concurrent forceRefresh fetches with the same parameters
    const promise1 = store.getState().fetchOrders(10, 1, {}, true);
    const promise2 = store.getState().fetchOrders(10, 1, {}, true);

    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(result1).toEqual(mockOrders);
    expect(result2).toEqual(mockOrders);

    // API should only be called once due to ongoingFetches deduplication
    expect(mockFetchOrders).toHaveBeenCalledTimes(1);
  });
});
