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

function createRequest(url: string): { url: string } {
  return { url };
}

describe('GET /api/products/search', () => {
  let productService: { searchProductsByName: jest.Mock };
  let customerService: { getCustomer: jest.Mock };
  let logger: { error: jest.Mock };

  beforeEach(() => {
    productService = {
      searchProductsByName: jest.fn().mockResolvedValue({
        items: [{ id: 'battery', name: 'Battery' }],
        page: 0,
        pageSize: 12,
        total: 1,
      }),
    };
    customerService = {
      getCustomer: jest.fn().mockResolvedValue({ id: 'customer-1' }),
    };
    logger = { error: jest.fn() };

    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('ProductService', productService);
    mockedServer.default.__services.set('CustomerService', customerService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('returns 400 when query is missing', async () => {
    const response = await GET(createRequest('https://example.test/api/products/search') as never);
    expect(response.status).toBe(400);
  });

  it('searches products by name via ProductService', async () => {
    const response = await GET(
      createRequest('https://example.test/api/products/search?query=battery&locale=en') as never,
    );

    expect(response.status).toBe(200);
    expect(productService.searchProductsByName).toHaveBeenCalledWith('battery', {
      page: 0,
      pageSize: 12,
      locale: 'en',
      prices: true,
      variants: false,
      categories: false,
      customerSegments: true,
    });
  });
});
