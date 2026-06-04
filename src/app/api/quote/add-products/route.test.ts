import { POST } from './route';

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

function createRequest(body: unknown): { json: () => Promise<unknown> } {
  return {
    json: jest.fn().mockResolvedValue(body),
  };
}

describe('POST /api/quote/add-products', () => {
  let customerService: { getCustomer: jest.Mock };
  let quoteService: { getQuote: jest.Mock };
  let tokenManager: { getCustomerToken: jest.Mock };
  let logger: { error: jest.Mock };
  const originalFetch = global.fetch;

  beforeEach(() => {
    customerService = {
      getCustomer: jest.fn().mockResolvedValue({ id: 'customer-1' }),
    };
    quoteService = {
      getQuote: jest.fn().mockResolvedValue({ id: 'Q-1000', status: 'OPEN' }),
    };
    tokenManager = {
      getCustomerToken: jest.fn().mockResolvedValue({ accessToken: 'customer-token-123' }),
    };
    logger = { error: jest.fn() };

    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('CustomerService', customerService);
    mockedServer.default.__services.set('QuoteService', quoteService);
    mockedServer.default.__services.set('EmporixConfig', { tenant: 'tenant-1', clientId: 'client-1' });
    mockedServer.default.__services.set('EmporixTokenManager', tokenManager);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify({ QUOTE_ADDITEM_NOTIFICATIONS_ID: 'notification-id-1' })),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('returns 400 when quoteId is missing', async () => {
    const response = await POST(createRequest({ items: [{ productId: 'battery', quantity: 1 }] }) as never);
    expect(response.status).toBe(400);
  });

  it('returns 401 when customer is not authenticated', async () => {
    customerService.getCustomer.mockResolvedValue(null);

    const response = await POST(
      createRequest({
        quoteId: 'Q-1000',
        items: [{ productId: 'battery', quantity: 2 }],
      }) as never,
    );

    expect(response.status).toBe(401);
  });

  it('returns 409 when quote is not open', async () => {
    quoteService.getQuote.mockResolvedValue({ id: 'Q-1000', status: 'ACCEPTED' });

    const response = await POST(
      createRequest({
        quoteId: 'Q-1000',
        items: [{ productId: 'battery', quantity: 2 }],
      }) as never,
    );

    expect(response.status).toBe(409);
  });

  it('posts each item to the webhook with customer access token', async () => {
    const response = await POST(
      createRequest({
        quoteId: 'Q-1000',
        items: [
          { productId: 'battery', quantity: 2 },
          { productId: 'motor', quantity: 1 },
        ],
      }) as never,
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      accepted: true,
      requests: [
        { productId: 'battery', notificationId: 'notification-id-1' },
        { productId: 'motor', notificationId: 'notification-id-1' },
      ],
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('hook.emporix-cop.integromat.celonis.com'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: 'Q-1000',
          productId: 'battery',
          quantity: '2',
          customerAccessToken: 'customer-token-123',
        }),
      }),
    );
  });

  it('returns 502 when webhook succeeds without notification id', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('Accepted'),
    }) as unknown as typeof fetch;

    const response = await POST(
      createRequest({
        quoteId: 'Q-1000',
        items: [{ productId: 'battery', quantity: 1 }],
      }) as never,
    );

    expect(response.status).toBe(502);
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns 502 when webhook call fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: jest.fn().mockResolvedValue('error'),
    }) as unknown as typeof fetch;

    const response = await POST(
      createRequest({
        quoteId: 'Q-1000',
        items: [{ productId: 'battery', quantity: 1 }],
      }) as never,
    );

    expect(response.status).toBe(502);
    expect(logger.error).toHaveBeenCalled();
  });
});
