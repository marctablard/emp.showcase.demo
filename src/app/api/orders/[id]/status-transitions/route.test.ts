import EmporixOrderApi from '@/platform/integrations/emporix/order/impl/EmporixOrderApi';
import EmporixOrderService from '@/platform/services/order/impl/EmporixOrderService';
import { GET } from './route';

jest.mock('@/platform/server', () => {
  const services = new Map<string, unknown>();
  return {
    __esModule: true,
    default: {
      get: jest.fn((id: string) => services.get(id)),
      __services: services,
    },
  };
});

const mockedServer = jest.requireMock('@/platform/server') as {
  default: { get: jest.Mock; __services: Map<string, unknown> };
};

type MockLogger = {
  error: jest.Mock;
};

type MockApiClient = {
  authenticatedFetch: jest.Mock;
};

describe('GET /api/orders/[id]/status-transitions', () => {
  let logger: MockLogger;
  let apiClient: MockApiClient;

  beforeEach(() => {
    logger = {
      error: jest.fn(),
    };

    apiClient = {
      authenticatedFetch: jest.fn(),
    };

    const orderApi = new EmporixOrderApi(apiClient as never, { tenant: 'tenant-code' } as never);
    const orderService = new EmporixOrderService(
      orderApi,
      { mapToService: jest.fn() } as never,
      { getCurrent: jest.fn() } as never,
    );

    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('OrderService', orderService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it.each([401, 403])(
    'returns the upstream %s status for customer order status transition permission failures',
    async (status) => {
      apiClient.authenticatedFetch.mockResolvedValueOnce({
        ok: false,
        status,
        statusText: status === 401 ? 'Unauthorized' : 'Forbidden',
        text: jest.fn().mockResolvedValue(JSON.stringify({ status, message: 'Access denied' })),
      });

      const response = await GET({} as never, { params: Promise.resolve({ id: 'order-123' }) });

      expect(apiClient.authenticatedFetch).toHaveBeenCalledWith(
        '/order-v2/tenant-code/orders/order-123/transitions',
        { method: 'GET' },
        'session',
        undefined,
        expect.any(Object),
      );
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({
        error: "You don't have permission to view this order.",
      });
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining(
            'Failed to get order status transitions: Failed to get customer order status transitions:',
          ),
          orderId: 'order-123',
          path: '/api/orders/order-123/status-transitions',
          method: 'GET',
        }),
        'Error fetching status transitions for order order-123',
      );
    },
  );
});
