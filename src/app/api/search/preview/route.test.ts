import { NextRequest } from 'next/server';
import type { ProductsModeContext } from '@/platform/services/products-mode/ProductsModeService';
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

type MockService = { [method: string]: jest.Mock };

const ROUTE_URL = 'http://localhost/api/search/preview';

const request = (search: string) => new NextRequest(`${ROUTE_URL}${search}`, { method: 'GET' });

function context(mode: ProductsModeContext['mode']): ProductsModeContext {
  const segmented = mode === 'assigned' || mode === 'all';
  return {
    mode,
    segmentIds: segmented ? ['seg-1'] : [],
    canToggleAllProducts: segmented,
    engine: 'batteryincluded',
    siteCode: 'main',
    customerId: mode === 'anonymous' ? undefined : 'cust-42',
  };
}

const suggestions = (ids: string[], queryCompletions: string[] = []) => ({
  products: ids.map((id) => ({ id, name: `<mark>${id}</mark>` })),
  queryCompletions,
  categories: [],
});

describe('GET /api/search/preview', () => {
  let searchService: MockService;
  let productsModeService: MockService;
  let logger: MockService;

  beforeEach(() => {
    searchService = { getSuggestions: jest.fn(), searchProducts: jest.fn().mockResolvedValue({ items: [] }) };
    productsModeService = { resolve: jest.fn().mockResolvedValue(context('anonymous')) };
    logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('SearchService', searchService);
    mockedServer.default.__services.set('ProductsModeService', productsModeService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('ranks products for each past search through the engine suggest', async () => {
    searchService.getSuggestions.mockImplementation(async ({ query }: { query: string }) =>
      query === 'fluid' ? suggestions(['f1', 'f2'], ['fluids']) : suggestions(['i1']),
    );

    const response = await GET(request('?term=fluid&term=inverter&site=main&locale=en&currency=EUR'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      source: 'history',
      products: [
        { id: 'f1', name: 'f1' },
        { id: 'i1', name: 'i1' },
        { id: 'f2', name: 'f2' },
      ],
      queryCompletions: ['fluids'],
    });
    expect(searchService.getSuggestions).toHaveBeenCalledWith({
      query: 'fluid',
      locale: 'en',
      site: 'main',
      currency: 'EUR',
    });
    expect(searchService.getSuggestions).toHaveBeenCalledTimes(2);
  });

  it('uses the full search for a past search that suggest no longer returns products for', async () => {
    searchService.getSuggestions.mockResolvedValue(suggestions([], ['batteries']));
    searchService.searchProducts.mockResolvedValue({ items: [{ id: 'b1', name: 'Battery' }] });

    const body = await (await GET(request('?term=battery&site=main&currency=USD'))).json();

    expect(body).toEqual({
      source: 'history',
      products: [{ id: 'b1', name: 'Battery' }],
      queryCompletions: ['batteries'],
    });
    expect(searchService.searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'battery', page: 0, size: 6, currency: 'USD' }),
    );
  });

  it('falls back to the engine empty-query ranking without history', async () => {
    searchService.getSuggestions.mockResolvedValue(suggestions(['p1']));

    const response = await GET(request('?site=main'));

    await expect(response.json()).resolves.toEqual({
      source: 'popular',
      products: [{ id: 'p1', name: 'p1' }],
      queryCompletions: [],
    });
    expect(searchService.getSuggestions).toHaveBeenCalledWith(expect.objectContaining({ query: '' }));
  });

  it('falls back to popular products when past searches no longer match, keeping their completions', async () => {
    searchService.getSuggestions.mockImplementation(async ({ query }: { query: string }) =>
      query ? suggestions([], ['fluids']) : suggestions(['p1']),
    );

    const body = await (await GET(request('?term=fluid&site=main'))).json();

    expect(body.source).toBe('popular');
    expect(body.queryCompletions).toEqual(['fluids']);
  });

  it('passes segment ids in assigned mode and marks the response private', async () => {
    productsModeService.resolve.mockResolvedValue(context('assigned'));
    searchService.getSuggestions.mockResolvedValue(suggestions(['p1']));

    const response = await GET(request('?term=fluid&site=main'));

    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(searchService.getSuggestions).toHaveBeenCalledWith(expect.objectContaining({ segmentIds: ['seg-1'] }));
  });

  it('answers 500 without leaking the search terms into the log', async () => {
    searchService.getSuggestions.mockRejectedValue(new Error('engine down'));

    const response = await GET(request('?site=main'));

    expect(response.status).toBe(500);
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('fluid');
  });
});
