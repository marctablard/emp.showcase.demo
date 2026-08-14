import type { NextRequest } from 'next/server';
import { GET } from './route';

/**
 * Route-level tests for `GET /api/products/[id]`. Focus: catalog identity
 * comes from SearchService.getCatalogProductById with parsed options only
 * (no locale/site query params; session fallback lives on the service).
 */

// Mock the DI container BEFORE importing the route module so the route's
// `server.get<…>()` calls return our controlled service stubs.
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

type MockService = { [method: string]: jest.Mock };

function createRequest(url: string): NextRequest {
  return { url } as unknown as NextRequest;
}

describe('GET /api/products/[id]', () => {
  let searchService: MockService;
  let productService: MockService;
  let logger: MockService;

  beforeEach(() => {
    searchService = {
      getCatalogProductById: jest.fn(),
    };
    productService = {
      getProductById: jest.fn(),
    };
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
    };

    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('SearchService', searchService);
    mockedServer.default.__services.set('ProductService', productService);
    mockedServer.default.__services.set('LoggerService', logger);
    // Re-prime the `get` mock implementation — platform setup's
    // `jest.resetAllMocks()` clears it between tests.
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('calls SearchService.getCatalogProductById with id and parsed options only', async () => {
    const product = { id: 'sku-123', name: { en: 'Widget' } };
    searchService.getCatalogProductById.mockResolvedValue(product);

    const response = await GET(
      createRequest(
        'http://localhost/api/products/sku-123?variants=true&prices=true&categories=true&locale=en&site=main',
      ),
      { params: Promise.resolve({ id: 'sku-123' }) },
    );

    expect(searchService.getCatalogProductById).toHaveBeenCalledTimes(1);
    expect(searchService.getCatalogProductById).toHaveBeenCalledWith('sku-123', {
      variants: true,
      prices: true,
      categories: true,
    });
    expect(productService.getProductById).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(product);
  });

  it('returns 404 JSON when getCatalogProductById returns undefined', async () => {
    searchService.getCatalogProductById.mockResolvedValue(undefined);

    const response = await GET(createRequest('http://localhost/api/products/missing'), {
      params: Promise.resolve({ id: 'missing' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Product with ID missing not found' });
    expect(productService.getProductById).not.toHaveBeenCalled();
  });

  it('logs with context object first and returns 500 when the service throws', async () => {
    searchService.getCatalogProductById.mockRejectedValue(new Error('boom'));

    const response = await GET(createRequest('http://localhost/api/products/sku-123'), {
      params: Promise.resolve({ id: 'sku-123' }),
    });

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'boom',
        path: '/api/products/sku-123',
        method: 'GET',
        productId: 'sku-123',
      }),
      'Error fetching product',
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch product' });
  });
});
