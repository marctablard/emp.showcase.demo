import { NextRequest } from 'next/server';
import { PRODUCTS_MODE_COOKIE_NAME } from '@/lib/common/products-mode-cookie';
import type { ProductsModeContext } from '@/platform/services/products-mode/ProductsModeService';
import { GET } from './route';

/**
 * Route-level tests for `GET /api/products/[id]/variants` (COP-4822).
 * Focus: the products mode is resolved server-side through ProductsModeService;
 * in `assigned` mode the variants are scoped through `{ segmentIds }` and the
 * response is `private, no-store`. `segmentIds` is never taken from the request.
 */

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

const ROUTE_URL = 'http://localhost/api/products/parent-1/variants';
const ROUTE_PARAMS = { params: Promise.resolve({ id: 'parent-1' }) };

function createRequest(url: string = ROUTE_URL, options: { cookie?: string } = {}): NextRequest {
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

describe('GET /api/products/[id]/variants', () => {
  let productService: MockService;
  let productsModeService: MockService;
  let logger: MockService;

  beforeEach(() => {
    productService = {
      getVariantProducts: jest.fn(),
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
    mockedServer.default.__services.set('ProductService', productService);
    mockedServer.default.__services.set('ProductsModeService', productsModeService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('assigned → getVariantProducts receives { segmentIds } and the response is private, no-store', async () => {
    productsModeService.resolve.mockResolvedValue(modeContext({ mode: 'assigned', segmentIds: ['seg-1', 'seg-2'] }));
    const variants = [{ id: 'var-1' }, { id: 'var-2' }];
    productService.getVariantProducts.mockResolvedValue(variants);

    const response = await GET(createRequest(), ROUTE_PARAMS);

    expect(productService.getVariantProducts).toHaveBeenCalledTimes(1);
    expect(productService.getVariantProducts).toHaveBeenCalledWith('parent-1', {
      segmentIds: ['seg-1', 'seg-2'],
      siteCode: 'main',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ variants });
  });

  it('assigned + no variants in scope → { variants: [] }, still private, no-store', async () => {
    productsModeService.resolve.mockResolvedValue(modeContext({ mode: 'assigned', segmentIds: ['seg-1'] }));
    productService.getVariantProducts.mockResolvedValue([]);

    const response = await GET(createRequest(), ROUTE_PARAMS);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ variants: [] });
  });

  it('unsegmented → getVariantProducts called without segmentIds and no Cache-Control set by the handler', async () => {
    productsModeService.resolve.mockResolvedValue(modeContext({ mode: 'unsegmented' }));
    const variants = [{ id: 'var-1' }];
    productService.getVariantProducts.mockResolvedValue(variants);

    const response = await GET(createRequest(), ROUTE_PARAMS);

    expect(productService.getVariantProducts).toHaveBeenCalledTimes(1);
    expect(productService.getVariantProducts).toHaveBeenCalledWith('parent-1');
    expect(productService.getVariantProducts.mock.calls[0][1]).toBeUndefined();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBeNull();
    await expect(response.json()).resolves.toEqual({ variants });
  });

  it('anonymous → getVariantProducts called without segmentIds and no Cache-Control', async () => {
    productsModeService.resolve.mockResolvedValue(modeContext({ mode: 'anonymous', customerId: undefined }));
    productService.getVariantProducts.mockResolvedValue([]);

    const response = await GET(createRequest(), ROUTE_PARAMS);

    expect(productService.getVariantProducts).toHaveBeenCalledWith('parent-1');
    expect(response.headers.get('cache-control')).toBeNull();
  });

  it('all → getVariantProducts called without segmentIds but the response is private, no-store', async () => {
    productsModeService.resolve.mockResolvedValue(
      modeContext({ mode: 'all', segmentIds: ['seg-1'], canToggleAllProducts: true }),
    );
    productService.getVariantProducts.mockResolvedValue([{ id: 'var-1' }]);

    const response = await GET(createRequest(), ROUTE_PARAMS);

    expect(productService.getVariantProducts).toHaveBeenCalledWith('parent-1');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('ignores a ?segmentIds= query param — scope comes only from ProductsModeService', async () => {
    productsModeService.resolve.mockResolvedValue(modeContext({ mode: 'unsegmented' }));
    productService.getVariantProducts.mockResolvedValue([]);

    await GET(createRequest(`${ROUTE_URL}?segmentIds=evil-seg`), ROUTE_PARAMS);

    expect(productService.getVariantProducts).toHaveBeenCalledWith('parent-1');
  });

  it('forwards the opt-in cookie value and ?site to ProductsModeService.resolve', async () => {
    productService.getVariantProducts.mockResolvedValue([]);

    await GET(createRequest(`${ROUTE_URL}?site=us`, { cookie: 'all.cust-42' }), ROUTE_PARAMS);

    expect(productsModeService.resolve).toHaveBeenCalledWith({ optInCookieValue: 'all.cust-42', siteCode: 'us' });
  });

  it('falls back to ?priceSiteCode for the site and passes undefined cookie/site when absent', async () => {
    productService.getVariantProducts.mockResolvedValue([]);

    await GET(createRequest(`${ROUTE_URL}?priceSiteCode=de`), ROUTE_PARAMS);
    await GET(createRequest(), ROUTE_PARAMS);

    expect(productsModeService.resolve).toHaveBeenNthCalledWith(1, { optInCookieValue: undefined, siteCode: 'de' });
    expect(productsModeService.resolve).toHaveBeenNthCalledWith(2, {
      optInCookieValue: undefined,
      siteCode: undefined,
    });
  });

  it('logs with context object first and returns 500 when the service throws', async () => {
    productService.getVariantProducts.mockRejectedValue(new Error('boom'));

    const response = await GET(createRequest(), ROUTE_PARAMS);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'boom',
        path: '/api/products/parent-1/variants',
        method: 'GET',
        productId: 'parent-1',
      }),
      'Error fetching product variants',
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch product variants' });
  });

  it('resolve failure → 500 without calling the product service', async () => {
    productsModeService.resolve.mockRejectedValue(new Error('mode down'));

    const response = await GET(createRequest(), ROUTE_PARAMS);

    expect(productService.getVariantProducts).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'mode down', path: '/api/products/parent-1/variants' }),
      'Error fetching product variants',
    );
    expect(response.status).toBe(500);
    // Fail closed on caching: the mode is unknown, so the error body is never cacheable.
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
