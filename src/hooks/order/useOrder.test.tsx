import { renderHook, waitFor } from '@testing-library/react';
import {
  OrderAccessDeniedError,
  fetchOrderById as apiFetchOrderById,
  fetchOrderStatusTransitions as apiFetchOrderStatusTransitions,
} from '@/lib/client/orders';
import type { Order } from '@/platform/services/model/order/order';
import { useOrder } from './useOrder';

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

jest.mock('@/lib/client/orders', () => ({
  OrderAccessDeniedError: class OrderAccessDeniedError extends Error {
    readonly status: number;

    constructor(status: number) {
      super("You don't have permission to view this order.");
      this.name = 'OrderAccessDeniedError';
      this.status = status;
    }
  },
  isOrderAccessDeniedError: (error: unknown) => error instanceof Error && error.name === 'OrderAccessDeniedError',
  fetchOrderById: jest.fn(),
  fetchOrderStatusTransitions: jest.fn(),
  postCustomerOrderDecline: jest.fn(),
}));

const mockFetchOrderById = apiFetchOrderById as jest.MockedFunction<typeof apiFetchOrderById>;
const mockFetchStatusTransitions = apiFetchOrderStatusTransitions as jest.MockedFunction<
  typeof apiFetchOrderStatusTransitions
>;

const mockOrder = {
  id: 'real-order-123',
  status: 'CREATED',
  customerEmail: 'shopper@example.com',
} as unknown as Order;

describe('useOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchOrderById.mockResolvedValue(mockOrder);
    mockFetchStatusTransitions.mockResolvedValue(['DECLINED']);
  });

  it('does not call order or transition APIs when orderId is undefined (sentinel guarded)', async () => {
    const { result } = renderHook(() =>
      useOrder({
        orderId: undefined,
        initialOrder: null,
        autoFetchStatusTransitions: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchOrderById).not.toHaveBeenCalled();
    expect(mockFetchStatusTransitions).not.toHaveBeenCalled();
    expect(result.current.order).toBeNull();
    expect(result.current.statusTransitions).toEqual([]);
  });

  it('does not call order or transition APIs when autoFetchStatusTransitions is false and order is provided', async () => {
    const { result } = renderHook(() =>
      useOrder({
        orderId: undefined,
        initialOrder: null,
        autoFetchStatusTransitions: false,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchOrderById).not.toHaveBeenCalled();
    expect(mockFetchStatusTransitions).not.toHaveBeenCalled();
  });

  it('fetches order details when a real orderId is provided and no initialOrder is set', async () => {
    const { result } = renderHook(() =>
      useOrder({
        orderId: 'real-order-123',
        autoFetchStatusTransitions: false,
      }),
    );

    await waitFor(() => {
      expect(result.current.order).toEqual(mockOrder);
    });

    expect(mockFetchOrderById).toHaveBeenCalledWith('real-order-123');
    expect(mockFetchStatusTransitions).not.toHaveBeenCalled();
  });

  it('fetches status transitions for a real orderId when autoFetchStatusTransitions is true', async () => {
    const { result } = renderHook(() =>
      useOrder({
        orderId: 'real-order-123',
        initialOrder: mockOrder,
        autoFetchStatusTransitions: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.statusTransitions).toEqual(['DECLINED']);
    });

    expect(mockFetchStatusTransitions).toHaveBeenCalledWith('real-order-123');
    expect(mockFetchOrderById).not.toHaveBeenCalled();
  });

  it('preserves access denied errors from order fetches', async () => {
    mockFetchOrderById.mockRejectedValueOnce(new OrderAccessDeniedError(403));

    const { result } = renderHook(() =>
      useOrder({
        orderId: 'real-order-123',
        autoFetchStatusTransitions: false,
      }),
    );

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(OrderAccessDeniedError);
    });

    expect(result.current.error?.message).toBe("You don't have permission to view this order.");
  });

  it('preserves access denied errors when order and status transition fetches fail concurrently', async () => {
    mockFetchOrderById.mockRejectedValueOnce(new OrderAccessDeniedError(403));
    mockFetchStatusTransitions.mockRejectedValueOnce(new Error('Failed to fetch status transitions'));

    const { result } = renderHook(() =>
      useOrder({
        orderId: 'real-order-123',
        autoFetchStatusTransitions: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(OrderAccessDeniedError);
    });

    expect(mockFetchOrderById).toHaveBeenCalledWith('real-order-123');
    expect(mockFetchStatusTransitions).toHaveBeenCalledWith('real-order-123');
    expect(result.current.error?.message).toBe("You don't have permission to view this order.");
  });
});
