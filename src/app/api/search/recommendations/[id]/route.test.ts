import { NextRequest } from 'next/server';
import { PRODUCTS_MODE_COOKIE_NAME } from '@/lib/common/products-mode-cookie';
import type { ProductsModeContext } from '@/platform/services/products-mode/ProductsModeService';
import { GET } from './route';

/**
 * Route-level tests for `GET /api/search/recommendations/[id]` (COP-4822 CR-1.3).
 * Focus: the products mode is resolved server-side, `segmentIds` reach the engine only in
 * `assigned` mode, and personalised responses are `Cache-Control: private, no-store`.
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

const ROUTE_URL = 'http://localhost/api/search/recommendations';
const RECOMMENDATIONS = [{ id: 'rec-1' }, { id: 'rec-2' }];
const OPTIONS_ARG = 5;

function createRequest(productId: string, search: string = '', options: { cookie?: string } = {}): NextRequest {
  const headers = new Headers();
  if (options.cookie) {
    headers.set('cookie', `${PRODUCTS_MODE_COOKIE_NAME}=${options.cookie}`);
  }
  return new NextRequest(`${ROUTE_URL}/${productId}${search}`, { method: 'GET', headers });
}

function callRoute(productId: string, search: string = '', options: { cookie?: string } = {}) {
  return GET(createRequest(productId, search, options), { params: Promise.resolve({ id: productId }) });
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

describe('GET /api/search/recommendations/[id]', () => {
  let searchService: MockService;
  let productsModeService: MockService;
  let logger: MockService;

  beforeEach(() => {
    searchService = { getRecommendations: jest.fn().mockResolvedValue(RECOMMENDATIONS) };
    productsModeService = { resolve: jest.fn() };
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
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  describe('anonymous mode', () => {
    it("keeps today's behaviour: no segmentIds, no Cache-Control", async () => {
      productsModeService.resolve.mockResolvedValue(context('anonymous', { siteCode: undefined }));

      const response = await callRoute('product-1', '?size=6');

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBeNull();
      await expect(response.json()).resolves.toEqual({ products: RECOMMENDATIONS });
      expect(searchService.getRecommendations).toHaveBeenCalledWith(
        'product-1',
        undefined,
        undefined,
        6,
        undefined,
        undefined,
      );
    });
  });

  describe('unsegmented mode', () => {
    it('passes no segmentIds and sets no Cache-Control', async () => {
      productsModeService.resolve.mockResolvedValue(context('unsegmented'));

      const response = await callRoute('product-1');

      expect(response.headers.get('cache-control')).toBeNull();
      expect(searchService.getRecommendations.mock.calls[0][OPTIONS_ARG]).toBeUndefined();
    });
  });

  describe('assigned mode', () => {
    it('forwards segmentIds to getRecommendations and responds private, no-store', async () => {
      productsModeService.resolve.mockResolvedValue(context('assigned'));

      const response = await callRoute('product-1', '', { cookie: 'assigned.cust-42' });

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      await expect(response.json()).resolves.toEqual({ products: RECOMMENDATIONS });
      expect(productsModeService.resolve).toHaveBeenCalledWith({ optInCookieValue: 'assigned.cust-42' });
      expect(searchService.getRecommendations).toHaveBeenCalledWith('product-1', undefined, 'main', 12, undefined, {
        segmentIds: ['seg-1', 'seg-2'],
      });
    });

    it('forwards segmentIds: [] verbatim after a failed segment lookup (service produces the empty result)', async () => {
      productsModeService.resolve.mockResolvedValue(context('assigned', { segmentIds: [] }));
      searchService.getRecommendations.mockResolvedValue([]);

      const response = await callRoute('product-1');

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      await expect(response.json()).resolves.toEqual({ products: [] });
      expect(searchService.getRecommendations.mock.calls[0][OPTIONS_ARG]).toEqual({ segmentIds: [] });
    });

    it('error responses stay private, no-store', async () => {
      productsModeService.resolve.mockResolvedValue(context('assigned'));
      searchService.getRecommendations.mockRejectedValue(new Error('engine down'));

      const response = await callRoute('product-1');

      expect(response.status).toBe(500);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'engine down',
          path: '/api/search/recommendations/product-1',
          method: 'GET',
          productId: 'product-1',
          mode: 'assigned',
        }),
        'Error fetching product recommendations',
      );
    });
  });

  describe('all mode', () => {
    it('passes no segmentIds but responds private, no-store', async () => {
      productsModeService.resolve.mockResolvedValue(context('all'));

      const response = await callRoute('product-1', '', { cookie: 'all.cust-42' });

      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(productsModeService.resolve).toHaveBeenCalledWith({ optInCookieValue: 'all.cust-42' });
      expect(searchService.getRecommendations.mock.calls[0][OPTIONS_ARG]).toBeUndefined();
    });
  });

  describe('client hints are ignored', () => {
    it('?segmentIds= and ?mode=all query params have no effect on the mode or the engine call', async () => {
      productsModeService.resolve.mockResolvedValue(context('unsegmented'));

      const response = await callRoute('product-1', '?segmentIds=seg-evil&mode=all');

      expect(productsModeService.resolve).toHaveBeenCalledWith({ optInCookieValue: undefined });
      expect(response.headers.get('cache-control')).toBeNull();
      expect(searchService.getRecommendations.mock.calls[0][OPTIONS_ARG]).toBeUndefined();
    });

    it('?segmentIds= cannot widen the server-resolved segments in assigned mode', async () => {
      productsModeService.resolve.mockResolvedValue(context('assigned', { segmentIds: ['seg-1'] }));

      await callRoute('product-1', '?segmentIds=seg-evil');

      expect(searchService.getRecommendations.mock.calls[0][OPTIONS_ARG]).toEqual({ segmentIds: ['seg-1'] });
    });
  });

  it('returns 400 without resolving the mode when the product id is empty', async () => {
    const response = await callRoute('');

    expect(response.status).toBe(400);
    expect(productsModeService.resolve).not.toHaveBeenCalled();
    expect(searchService.getRecommendations).not.toHaveBeenCalled();
  });

  it('resolve failure → 500, logged, private, no-store (mode unknown)', async () => {
    productsModeService.resolve.mockRejectedValue(new Error('session down'));

    const response = await callRoute('product-1');

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(searchService.getRecommendations).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'session down', path: '/api/search/recommendations/product-1' }),
      'Error fetching product recommendations',
    );
  });
});
