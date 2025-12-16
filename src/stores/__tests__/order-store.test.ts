import { act, renderHook } from '@testing-library/react';
import { createOrderStore } from '../order-store';

// Mock the API calls
jest.mock('@/lib/client/orders', () => ({
  fetchOrders: jest.fn(),
}));

jest.mock('@/platform/integrations/emporix/common/util/common', () => ({
  buildSearchQuery: jest.fn((params) => ({
    query: `page=${params.page}&size=${params.size}`,
    body: JSON.stringify(params.criteria),
  })),
}));

const mockFetchOrders = require('@/lib/client/orders').fetchOrders;

describe('OrderStore', () => {
  let store: ReturnType<typeof createOrderStore>;

  beforeEach(() => {
    jest.clearAllMocks();
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
  });
});
