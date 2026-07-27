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

describe('GET /api/orders', () => {
  const orderService = {
    getCustomerOrdersPage: jest.fn(),
  };
  const logger = {
    error: jest.fn(),
  };

  beforeEach(() => {
    orderService.getCustomerOrdersPage.mockReset();
    logger.error.mockReset();

    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('OrderService', orderService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('uses defaults and forwards query alias to q', async () => {
    orderService.getCustomerOrdersPage.mockResolvedValueOnce({
      items: [{ id: 'order-1' }],
      totalCount: 1,
    });

    const response = await GET({ nextUrl: { searchParams: new URLSearchParams('query=status:CREATED') } } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([{ id: 'order-1' }]);
    expect(response.headers.get('x-total-count')).toBe('1');
    expect(orderService.getCustomerOrdersPage).toHaveBeenCalledWith(50, 1, undefined, 'status:CREATED');
  });

  it('forwards one-based pagination, raw sort and raw q', async () => {
    orderService.getCustomerOrdersPage.mockResolvedValueOnce({
      items: [{ id: 'order-2' }],
      totalCount: 23,
    });

    const response = await GET({
      nextUrl: {
        searchParams: new URLSearchParams({
          pageNumber: '2',
          pageSize: '10',
          sort: 'created:desc,id:asc',
          q: 'status:CREATED id:(order-1,order-2)',
        }),
      },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([{ id: 'order-2' }]);
    expect(response.headers.get('x-total-count')).toBe('23');
    expect(orderService.getCustomerOrdersPage).toHaveBeenCalledWith(
      10,
      2,
      'created:desc,id:asc',
      'status:CREATED id:(order-1,order-2)',
    );
  });

  it.each([
    ['pageNumber', '0', 'pageNumber must be >= 1'],
    ['pageSize', '0', 'pageSize must be >= 1'],
    ['pageSize', '61', 'pageSize must be <= 60'],
    ['pageNumber', 'abc', 'pageNumber must be a base-10 positive integer'],
    ['pageNumber', '1abc', 'pageNumber must be a base-10 positive integer'],
    ['pageNumber', '1e2', 'pageNumber must be a base-10 positive integer'],
    ['pageNumber', '+2', 'pageNumber must be a base-10 positive integer'],
    ['pageNumber', '9007199254740993', 'pageNumber must be a safe integer'],
  ])('returns 400 for invalid %s=%s', async (name, value, message) => {
    const response = await GET({
      nextUrl: {
        searchParams: new URLSearchParams({ [name]: value }),
      },
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: message });
    expect(orderService.getCustomerOrdersPage).not.toHaveBeenCalled();
  });

  it('returns 500 when upstream/service errors contain "must be" text', async () => {
    orderService.getCustomerOrdersPage.mockRejectedValueOnce(new Error('upstream says sort must be present'));

    const response = await GET({ nextUrl: { searchParams: new URLSearchParams() } } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch orders' });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
