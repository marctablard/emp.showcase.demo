import { NextRequest } from 'next/server';
import { PRODUCTS_MODE_COOKIE_NAME } from '@/lib/common/products-mode-cookie';
import type { ProductsModeContext } from '@/platform/services/products-mode/ProductsModeService';
import { GET } from './route';

/**
 * Route-level tests for `GET /api/search` (COP-4822 Task 3.1).
 * Focus: the products mode is resolved server-side, `segmentIds` reach the engine only in
 * `assigned` mode, the AC5 category-filter sanitiser runs against the segment scope, and
 * personalised responses are `Cache-Control: private, no-store`.
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

const ROUTE_URL = 'http://localhost/api/search';
const SEARCH_RESULT = { items: [], total: 0 };

function createRequest(search: string = '', options: { cookie?: string } = {}): NextRequest {
  const headers = new Headers();
  if (options.cookie) {
    headers.set('cookie', `${PRODUCTS_MODE_COOKIE_NAME}=${options.cookie}`);
  }
  return new NextRequest(`${ROUTE_URL}${search}`, { method: 'GET', headers });
}

function context(mode: ProductsModeContext['mode'], overrides: Partial<ProductsModeContext> = {}): ProductsModeContext {
  const segmented = mode === 'assigned' || mode === 'all';
  return {
    mode,
    segmentIds: segmented ? ['seg-1', 'seg-2'] : [],
    canToggleAllProducts: segmented,
    engine: 'batteryincluded',
    siteCode: 'main',
    customerId: mode === 'anonymous' ? undefined : 'cust-42',
    ...overrides,
  };
}

function searchParamsOf(mock: jest.Mock): Record<string, unknown> {
  return mock.mock.calls[0][0] as Record<string, unknown>;
}

describe('GET /api/search', () => {
  let searchService: MockService;
  let productsModeService: MockService;
  let segmentFilterService: MockService;
  let logger: MockService;
  const originalUnscopedEnv = process.env.SEARCH_ALLOW_UNSCOPED_PRODUCT_SEARCH;

  beforeEach(() => {
    searchService = { searchProducts: jest.fn().mockResolvedValue(SEARCH_RESULT) };
    productsModeService = { resolve: jest.fn() };
    segmentFilterService = {
      getCategoryScope: jest.fn().mockResolvedValue({
        roots: [],
        treeCategoryIds: ['cat-root', 'cat-in'],
        assignedCategoryIds: ['cat-in'],
        allowedCategoryIds: ['cat-root', 'cat-in', 'cat-in-child'],
      }),
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
    mockedServer.default.__services.set('ProductsModeService', productsModeService);
    mockedServer.default.__services.set('SegmentFilterService', segmentFilterService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  afterEach(() => {
    if (originalUnscopedEnv === undefined) {
      delete process.env.SEARCH_ALLOW_UNSCOPED_PRODUCT_SEARCH;
    } else {
      process.env.SEARCH_ALLOW_UNSCOPED_PRODUCT_SEARCH = originalUnscopedEnv;
    }
  });

  describe('assigned mode', () => {
    it('passes segmentIds to searchProducts and responds private, no-store', async () => {
      productsModeService.resolve.mockResolvedValue(context('assigned'));

      const response = await GET(createRequest('?query=drill&site=main'));

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      await expect(response.json()).resolves.toEqual(SEARCH_RESULT);
      expect(searchParamsOf(searchService.searchProducts)).toEqual(
        expect.objectContaining({ query: 'drill', segmentIds: ['seg-1', 'seg-2'], site: 'main' }),
      );
      expect(searchService.searchProducts.mock.calls[0][2]).toBe('main');
    });

    it('forwards segmentIds: [] verbatim after a failed segment lookup (service produces the empty result)', async () => {
      productsModeService.resolve.mockResolvedValue(context('assigned', { segmentIds: [] }));

      const response = await GET(createRequest('?query=drill&site=main'));

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(searchParamsOf(searchService.searchProducts)).toEqual(
        expect.objectContaining({ segmentIds: [], searchAllProducts: false }),
      );
    });

    it('removes an out-of-scope filters[categoryIds] and keeps an in-scope one (AC5)', async () => {
      productsModeService.resolve.mockResolvedValue(context('assigned'));

      await GET(createRequest('?filters[categoryIds][]=cat-in&filters[categoryIds][]=cat-out&filters[brand]=acme'));

      expect(segmentFilterService.getCategoryScope).toHaveBeenCalledWith('main', ['seg-1', 'seg-2']);
      expect(searchParamsOf(searchService.searchProducts).filters).toEqual({
        categoryIds: ['cat-in'],
        brand: 'acme',
      });
    });

    it('drops the categoryIds filter entirely when every id is out of scope', async () => {
      productsModeService.resolve.mockResolvedValue(context('assigned'));

      await GET(createRequest('?filters[categoryIds]=cat-out'));

      expect(searchParamsOf(searchService.searchProducts).filters).toBeUndefined();
    });

    it('forces searchAllProducts=false even with ?allProducts=1 and the unscoped flag on (OQ 20)', async () => {
      process.env.SEARCH_ALLOW_UNSCOPED_PRODUCT_SEARCH = 'true';
      productsModeService.resolve.mockResolvedValue(context('assigned'));

      await GET(createRequest('?query=drill&allProducts=1'));

      expect(searchParamsOf(searchService.searchProducts)).toEqual(
        expect.objectContaining({ searchAllProducts: false, segmentIds: ['seg-1', 'seg-2'] }),
      );
    });

    it('does not load the Emporix category scope when no categoryIds filter is present', async () => {
      productsModeService.resolve.mockResolvedValue(context('assigned'));

      await GET(createRequest('?query=drill&site=main'));

      expect(segmentFilterService.getCategoryScope).not.toHaveBeenCalled();
    });

    it('uses ctx.siteCode for the engine call when the request has no ?site', async () => {
      productsModeService.resolve.mockResolvedValue(context('assigned', { siteCode: 'us' }));

      await GET(createRequest('?query=drill'));

      expect(productsModeService.resolve).toHaveBeenCalledWith({ optInCookieValue: undefined, siteCode: undefined });
      expect(segmentFilterService.getCategoryScope).not.toHaveBeenCalled();
      expect(searchParamsOf(searchService.searchProducts).site).toBe('us');
      expect(searchService.searchProducts.mock.calls[0][2]).toBe('us');
    });

    it('uses ctx.siteCode for AC5 scope when a categoryIds filter is present', async () => {
      productsModeService.resolve.mockResolvedValue(context('assigned', { siteCode: 'us' }));

      await GET(createRequest('?filters[categoryIds]=cat-in'));

      expect(segmentFilterService.getCategoryScope).toHaveBeenCalledWith('us', ['seg-1', 'seg-2']);
    });

    it('fails closed on the category filter when no site can be resolved', async () => {
      productsModeService.resolve.mockResolvedValue(context('assigned', { siteCode: undefined }));

      await GET(createRequest('?filters[categoryIds]=cat-in'));

      expect(segmentFilterService.getCategoryScope).not.toHaveBeenCalled();
      expect(searchParamsOf(searchService.searchProducts).filters).toBeUndefined();
      expect(searchParamsOf(searchService.searchProducts).segmentIds).toEqual(['seg-1', 'seg-2']);
    });

    it('error responses stay private, no-store', async () => {
      productsModeService.resolve.mockResolvedValue(context('assigned'));
      searchService.searchProducts.mockRejectedValue(new Error('engine down'));

      const response = await GET(createRequest('?query=drill'));

      expect(response.status).toBe(500);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'engine down', path: '/api/search', method: 'GET', mode: 'assigned' }),
        'Error searching products',
      );
    });
  });

  describe('unsegmented mode', () => {
    it('passes no segmentIds, does not touch the segment scope and sets no Cache-Control', async () => {
      productsModeService.resolve.mockResolvedValue(context('unsegmented'));

      const response = await GET(createRequest('?query=drill&site=main&filters[categoryIds]=cat-out'));

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBeNull();
      expect(segmentFilterService.getCategoryScope).not.toHaveBeenCalled();
      const params = searchParamsOf(searchService.searchProducts);
      expect(params).not.toHaveProperty('segmentIds');
      expect(params.filters).toEqual({ categoryIds: 'cat-out' });
    });

    it('keeps the ?allProducts=1 handling when the unscoped flag is on', async () => {
      process.env.SEARCH_ALLOW_UNSCOPED_PRODUCT_SEARCH = 'true';
      productsModeService.resolve.mockResolvedValue(context('unsegmented'));

      await GET(createRequest('?allProducts=1'));

      expect(searchParamsOf(searchService.searchProducts).searchAllProducts).toBe(true);
    });
  });

  describe('anonymous mode', () => {
    it("keeps today's behaviour: no segmentIds, no Cache-Control", async () => {
      productsModeService.resolve.mockResolvedValue(context('anonymous'));

      const response = await GET(createRequest('?query=drill'));

      expect(response.headers.get('cache-control')).toBeNull();
      expect(searchParamsOf(searchService.searchProducts)).not.toHaveProperty('segmentIds');
    });
  });

  describe('all mode', () => {
    it('passes no segmentIds but responds private, no-store', async () => {
      productsModeService.resolve.mockResolvedValue(context('all'));

      const response = await GET(createRequest('?query=drill', { cookie: 'all.cust-42' }));

      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(segmentFilterService.getCategoryScope).not.toHaveBeenCalled();
      expect(searchParamsOf(searchService.searchProducts)).not.toHaveProperty('segmentIds');
      expect(productsModeService.resolve).toHaveBeenCalledWith({
        optInCookieValue: 'all.cust-42',
        siteCode: undefined,
      });
    });
  });

  describe('client hints are ignored', () => {
    it('?segmentIds= and ?mode=all query params have no effect on the mode or the engine params', async () => {
      productsModeService.resolve.mockResolvedValue(context('unsegmented'));

      const response = await GET(createRequest('?query=drill&segmentIds=seg-evil&mode=all&site=main'));

      expect(productsModeService.resolve).toHaveBeenCalledWith({ optInCookieValue: undefined, siteCode: 'main' });
      expect(response.headers.get('cache-control')).toBeNull();
      const params = searchParamsOf(searchService.searchProducts);
      expect(params).not.toHaveProperty('segmentIds');
      expect(params).not.toHaveProperty('mode');
    });

    it('?segmentIds= cannot widen the server-resolved segments in assigned mode', async () => {
      productsModeService.resolve.mockResolvedValue(context('assigned', { segmentIds: ['seg-1'] }));

      await GET(createRequest('?query=drill&segmentIds=seg-evil'));

      expect(searchParamsOf(searchService.searchProducts).segmentIds).toEqual(['seg-1']);
    });
  });

  it('forwards the opt-in cookie value and ?site to ProductsModeService.resolve', async () => {
    productsModeService.resolve.mockResolvedValue(context('unsegmented', { siteCode: 'us' }));

    await GET(createRequest('?site=us', { cookie: 'all.other' }));

    expect(productsModeService.resolve).toHaveBeenCalledWith({ optInCookieValue: 'all.other', siteCode: 'us' });
  });

  it('resolve failure → 500, logged, private, no-store (mode unknown)', async () => {
    productsModeService.resolve.mockRejectedValue(new Error('session down'));

    const response = await GET(createRequest('?query=drill'));

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(searchService.searchProducts).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'session down', path: '/api/search' }),
      'Error searching products',
    );
  });
});
