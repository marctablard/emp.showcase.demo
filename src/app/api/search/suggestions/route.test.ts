import { NextRequest } from 'next/server';
import { PRODUCTS_MODE_COOKIE_NAME } from '@/lib/common/products-mode-cookie';
import type { ProductsModeContext } from '@/platform/services/products-mode/ProductsModeService';
import { GET } from './route';

/**
 * Route-level tests for `GET /api/search/suggestions` (COP-4822 Task 3.1).
 * Focus: `segmentIds` reach `getSuggestions` only in `assigned` mode and personalised
 * responses are `Cache-Control: private, no-store`.
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

const ROUTE_URL = 'http://localhost/api/search/suggestions';
const SUGGESTIONS = { queries: [], products: [], categories: [] };

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

function suggestionParamsOf(mock: jest.Mock): Record<string, unknown> {
  return mock.mock.calls[0][0] as Record<string, unknown>;
}

describe('GET /api/search/suggestions', () => {
  let searchService: MockService;
  let productsModeService: MockService;
  let logger: MockService;

  beforeEach(() => {
    searchService = { getSuggestions: jest.fn().mockResolvedValue(SUGGESTIONS) };
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

  it('assigned → getSuggestions receives segmentIds and the response is private, no-store', async () => {
    productsModeService.resolve.mockResolvedValue(context('assigned'));

    const response = await GET(createRequest('?query=dri&site=main&locale=en&currency=EUR'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual(SUGGESTIONS);
    expect(suggestionParamsOf(searchService.getSuggestions)).toEqual({
      query: 'dri',
      locale: 'en',
      site: 'main',
      currency: 'EUR',
      segmentIds: ['seg-1', 'seg-2'],
    });
  });

  it('assigned without ?site → uses ctx.siteCode for the engine call', async () => {
    productsModeService.resolve.mockResolvedValue(context('assigned', { siteCode: 'us' }));

    await GET(createRequest('?query=dri'));

    expect(productsModeService.resolve).toHaveBeenCalledWith({ optInCookieValue: undefined, siteCode: undefined });
    expect(suggestionParamsOf(searchService.getSuggestions).site).toBe('us');
  });

  it('unsegmented → no segmentIds and no Cache-Control set by the handler', async () => {
    productsModeService.resolve.mockResolvedValue(context('unsegmented'));

    const response = await GET(createRequest('?query=dri&site=main'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBeNull();
    expect(suggestionParamsOf(searchService.getSuggestions)).toEqual({
      query: 'dri',
      locale: undefined,
      site: 'main',
      currency: undefined,
    });
  });

  it('anonymous → no segmentIds and no Cache-Control', async () => {
    productsModeService.resolve.mockResolvedValue(context('anonymous'));

    const response = await GET(createRequest('?query=dri'));

    expect(response.headers.get('cache-control')).toBeNull();
    expect(suggestionParamsOf(searchService.getSuggestions)).not.toHaveProperty('segmentIds');
  });

  it('all → no segmentIds but private, no-store; forwards the opt-in cookie value', async () => {
    productsModeService.resolve.mockResolvedValue(context('all'));

    const response = await GET(createRequest('?query=dri&site=main', { cookie: 'all.cust-42' }));

    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(suggestionParamsOf(searchService.getSuggestions)).not.toHaveProperty('segmentIds');
    expect(productsModeService.resolve).toHaveBeenCalledWith({ optInCookieValue: 'all.cust-42', siteCode: 'main' });
  });

  it('?segmentIds= / ?mode=all query params have no effect', async () => {
    productsModeService.resolve.mockResolvedValue(context('unsegmented'));

    const response = await GET(createRequest('?query=dri&segmentIds=seg-evil&mode=all'));

    expect(response.headers.get('cache-control')).toBeNull();
    const params = suggestionParamsOf(searchService.getSuggestions);
    expect(params).not.toHaveProperty('segmentIds');
    expect(params).not.toHaveProperty('mode');
  });

  it('missing query → 400 without resolving the mode', async () => {
    const response = await GET(createRequest(''));

    expect(response.status).toBe(400);
    expect(productsModeService.resolve).not.toHaveBeenCalled();
    expect(searchService.getSuggestions).not.toHaveBeenCalled();
  });

  it('assigned + engine failure → 500 stays private, no-store and is logged', async () => {
    productsModeService.resolve.mockResolvedValue(context('assigned'));
    searchService.getSuggestions.mockRejectedValue(new Error('engine down'));

    const response = await GET(createRequest('?query=dri'));

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'engine down', path: '/api/search/suggestions', mode: 'assigned' }),
      'Error fetching suggestions',
    );
  });

  it('resolve failure → 500, private, no-store (mode unknown)', async () => {
    productsModeService.resolve.mockRejectedValue(new Error('session down'));

    const response = await GET(createRequest('?query=dri'));

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(searchService.getSuggestions).not.toHaveBeenCalled();
  });
});
