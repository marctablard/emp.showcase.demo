import { NextRequest } from 'next/server';
import { PRODUCTS_MODE_COOKIE_NAME } from '@/lib/common/products-mode-cookie';
import type { ProductsModeContext } from '@/platform/services/products-mode/ProductsModeService';
import { GET } from './route';

/**
 * Route-level tests for `GET /api/products/[id]`. Focus: catalog identity
 * comes from SearchService.getCatalogProductById with parsed options plus
 * the effective site as the 4th argument (BatteryIncluded reads site there), and
 * the products mode (COP-4822) is resolved server-side through
 * ProductsModeService — `segmentIds` is never taken from the request.
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

function createRequest(url: string, options: { cookie?: string } = {}): NextRequest {
  const headers = new Headers();
  if (options.cookie) {
    headers.set('cookie', `${PRODUCTS_MODE_COOKIE_NAME}=${options.cookie}`);
  }
  return new NextRequest(url, { method: 'GET', headers });
}

function modeContext(overrides: Partial<ProductsModeContext> = {}): ProductsModeContext {
  return {
    mode: 'unsegmented',
    segmentIds: [],
    canToggleAllProducts: false,
    engine: 'batteryincluded',
    siteCode: 'main',
    customerId: 'cust-42',
    ...overrides,
  };
}

const BASE_OPTIONS = { variants: false, prices: false, categories: false };

describe('GET /api/products/[id]', () => {
  let searchService: MockService;
  let productService: MockService;
  let productsModeService: MockService;
  let logger: MockService;

  beforeEach(() => {
    searchService = {
      getCatalogProductById: jest.fn(),
    };
    productService = {
      getProductById: jest.fn(),
    };
    productsModeService = {
      resolve: jest.fn().mockResolvedValue(modeContext()),
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
    mockedServer.default.__services.set('ProductsModeService', productsModeService);
    mockedServer.default.__services.set('LoggerService', logger);
    // Re-prime the `get` mock implementation — platform setup's
    // `jest.resetAllMocks()` clears it between tests.
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('calls SearchService.getCatalogProductById with id, parsed options and the request site', async () => {
    const product = { id: 'sku-123', name: { en: 'Widget' } };
    searchService.getCatalogProductById.mockResolvedValue(product);

    const response = await GET(
      createRequest(
        'http://localhost/api/products/sku-123?variants=true&prices=true&categories=true&locale=en&site=main',
      ),
      { params: Promise.resolve({ id: 'sku-123' }) },
    );

    expect(searchService.getCatalogProductById).toHaveBeenCalledTimes(1);
    expect(searchService.getCatalogProductById).toHaveBeenCalledWith(
      'sku-123',
      {
        variants: true,
        prices: true,
        categories: true,
      },
      undefined,
      'main',
    );
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

  describe('products mode (COP-4822)', () => {
    it('assigned → getCatalogProductById receives segmentIds and the response is private, no-store', async () => {
      productsModeService.resolve.mockResolvedValue(modeContext({ mode: 'assigned', segmentIds: ['seg-1', 'seg-2'] }));
      const product = { id: 'sku-123' };
      searchService.getCatalogProductById.mockResolvedValue(product);

      const response = await GET(createRequest('http://localhost/api/products/sku-123?variants=true'), {
        params: Promise.resolve({ id: 'sku-123' }),
      });

      expect(searchService.getCatalogProductById).toHaveBeenCalledWith(
        'sku-123',
        {
          ...BASE_OPTIONS,
          variants: true,
          segmentIds: ['seg-1', 'seg-2'],
          siteCode: 'main',
        },
        undefined,
        'main',
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      await expect(response.json()).resolves.toEqual(product);
    });

    it('assigned + context without siteCode → membership site falls back to the request ?site', async () => {
      productsModeService.resolve.mockResolvedValue(
        modeContext({ mode: 'assigned', segmentIds: ['seg-1'], siteCode: undefined }),
      );
      searchService.getCatalogProductById.mockResolvedValue({ id: 'sku-123' });

      await GET(createRequest('http://localhost/api/products/sku-123?site=us'), {
        params: Promise.resolve({ id: 'sku-123' }),
      });

      expect(searchService.getCatalogProductById).toHaveBeenCalledWith(
        'sku-123',
        {
          ...BASE_OPTIONS,
          segmentIds: ['seg-1'],
          siteCode: 'us',
        },
        undefined,
        'us',
      );
    });

    it('resolve failure → 500 with private, no-store and no product lookup (fail closed on caching)', async () => {
      productsModeService.resolve.mockRejectedValue(new Error('mode down'));

      const response = await GET(createRequest('http://localhost/api/products/sku-123'), {
        params: Promise.resolve({ id: 'sku-123' }),
      });

      expect(searchService.getCatalogProductById).not.toHaveBeenCalled();
      expect(response.status).toBe(500);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch product' });
    });

    it('assigned + out-of-scope product (undefined) → 404, still private, no-store', async () => {
      productsModeService.resolve.mockResolvedValue(modeContext({ mode: 'assigned', segmentIds: ['seg-1'] }));
      searchService.getCatalogProductById.mockResolvedValue(undefined);

      const response = await GET(createRequest('http://localhost/api/products/outside'), {
        params: Promise.resolve({ id: 'outside' }),
      });

      expect(response.status).toBe(404);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      await expect(response.json()).resolves.toEqual({ error: 'Product with ID outside not found' });
    });

    it('assigned + segmentIds: [] (failed lookup) → forwarded verbatim, service 404 stays private, no-store', async () => {
      productsModeService.resolve.mockResolvedValue(modeContext({ mode: 'assigned', segmentIds: [] }));
      searchService.getCatalogProductById.mockResolvedValue(undefined);

      const response = await GET(createRequest('http://localhost/api/products/sku-123'), {
        params: Promise.resolve({ id: 'sku-123' }),
      });

      expect(searchService.getCatalogProductById).toHaveBeenCalledWith(
        'sku-123',
        {
          ...BASE_OPTIONS,
          segmentIds: [],
          siteCode: 'main',
        },
        undefined,
        'main',
      );
      expect(response.status).toBe(404);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    });

    it('unsegmented → options without segmentIds and no Cache-Control set by the handler', async () => {
      productsModeService.resolve.mockResolvedValue(modeContext({ mode: 'unsegmented' }));
      searchService.getCatalogProductById.mockResolvedValue({ id: 'sku-123' });

      const response = await GET(createRequest('http://localhost/api/products/sku-123'), {
        params: Promise.resolve({ id: 'sku-123' }),
      });

      expect(searchService.getCatalogProductById).toHaveBeenCalledWith('sku-123', BASE_OPTIONS, undefined, 'main');
      expect(searchService.getCatalogProductById.mock.calls[0][1]).not.toHaveProperty('segmentIds');
      expect(response.headers.get('cache-control')).toBeNull();
    });

    it('anonymous → options without segmentIds and no Cache-Control set by the handler', async () => {
      productsModeService.resolve.mockResolvedValue(modeContext({ mode: 'anonymous', customerId: undefined }));
      searchService.getCatalogProductById.mockResolvedValue({ id: 'sku-123' });

      const response = await GET(createRequest('http://localhost/api/products/sku-123'), {
        params: Promise.resolve({ id: 'sku-123' }),
      });

      expect(searchService.getCatalogProductById).toHaveBeenCalledWith('sku-123', BASE_OPTIONS, undefined, 'main');
      expect(response.headers.get('cache-control')).toBeNull();
    });

    it('all → options without segmentIds but the response is private, no-store', async () => {
      productsModeService.resolve.mockResolvedValue(
        modeContext({ mode: 'all', segmentIds: ['seg-1'], canToggleAllProducts: true }),
      );
      searchService.getCatalogProductById.mockResolvedValue({ id: 'sku-123' });

      const response = await GET(createRequest('http://localhost/api/products/sku-123'), {
        params: Promise.resolve({ id: 'sku-123' }),
      });

      expect(searchService.getCatalogProductById).toHaveBeenCalledWith('sku-123', BASE_OPTIONS, undefined, 'main');
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    });

    it('ignores a ?segmentIds= query param — scope comes only from ProductsModeService', async () => {
      productsModeService.resolve.mockResolvedValue(modeContext({ mode: 'unsegmented' }));
      searchService.getCatalogProductById.mockResolvedValue({ id: 'sku-123' });

      await GET(createRequest('http://localhost/api/products/sku-123?segmentIds=evil-seg&segmentIds[]=evil-2'), {
        params: Promise.resolve({ id: 'sku-123' }),
      });

      expect(searchService.getCatalogProductById).toHaveBeenCalledWith('sku-123', BASE_OPTIONS, undefined, 'main');
      expect(searchService.getCatalogProductById.mock.calls[0][1]).not.toHaveProperty('segmentIds');
    });

    it('forwards the opt-in cookie value and ?site to ProductsModeService.resolve', async () => {
      searchService.getCatalogProductById.mockResolvedValue({ id: 'sku-123' });

      await GET(createRequest('http://localhost/api/products/sku-123?site=us', { cookie: 'all.cust-42' }), {
        params: Promise.resolve({ id: 'sku-123' }),
      });

      expect(productsModeService.resolve).toHaveBeenCalledWith({ optInCookieValue: 'all.cust-42', siteCode: 'us' });
    });

    it('falls back to ?priceSiteCode for the site and passes undefined cookie when absent', async () => {
      searchService.getCatalogProductById.mockResolvedValue({ id: 'sku-123' });

      await GET(createRequest('http://localhost/api/products/sku-123?prices=true&priceSiteCode=de'), {
        params: Promise.resolve({ id: 'sku-123' }),
      });

      expect(productsModeService.resolve).toHaveBeenCalledWith({ optInCookieValue: undefined, siteCode: 'de' });
    });

    it('resolve failure → 500 logged via LoggerService without calling the search service', async () => {
      productsModeService.resolve.mockRejectedValue(new Error('mode down'));

      const response = await GET(createRequest('http://localhost/api/products/sku-123'), {
        params: Promise.resolve({ id: 'sku-123' }),
      });

      expect(searchService.getCatalogProductById).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'mode down', path: '/api/products/sku-123', method: 'GET' }),
        'Error fetching product',
      );
      expect(response.status).toBe(500);
    });
  });
});
