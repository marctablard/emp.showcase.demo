import { act, renderHook } from '@testing-library/react';
import { useSiteCode } from '@/hooks/site/useSiteCode';
import { resetInFlightSearchRequests } from '@/lib/client/search';
import { BATTERY_INCLUDED_BREADCRUMB_FILTER } from '@/platform/services/model/category/batteryincluded-category';
import { USE_SEARCH_CLIENT_ERROR, useSearch } from './useSearch';

const mockPush = jest.fn();
const mockUseSessionStore = jest.fn(() => ({ session: { currency: 'EUR' } }));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/browse',
}));

jest.mock('@/hooks/history/useHistory', () => ({
  __esModule: true,
  default: () => ({ addSearchQuery: jest.fn() }),
}));

jest.mock('@/providers/StoreProvider', () => ({
  useSessionStore: () => mockUseSessionStore(),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({ warn: jest.fn(), error: jest.fn() }),
}));

jest.mock('@/hooks/site/useSiteCode', () => ({
  useSiteCode: jest.fn(),
}));

describe('useSearch', () => {
  const mockedUseSiteCode = useSiteCode as jest.MockedFunction<typeof useSiteCode>;

  beforeEach(() => {
    resetInFlightSearchRequests();
    mockPush.mockClear();
    mockUseSessionStore.mockReturnValue({ session: { currency: 'EUR' } });
    window.history.replaceState({}, '', '/browse');
    mockedUseSiteCode.mockReturnValue('main');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
        page: 0,
        pageSize: 12,
        availableFilters: [],
        batteryIncludedFacets: [
          {
            id: 'color',
            label: 'color',
            kind: 'select',
            options: [
              {
                id: 'red',
                label: 'Red',
                active: true,
                count: 1,
              },
            ],
          },
        ],
      }),
    });
  });

  it('exposes MISSING_SITE and does not fetch when site code is missing', async () => {
    mockedUseSiteCode.mockReturnValue(undefined);
    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.search({ page: 0, size: 12 });
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.error).toBe(USE_SEARCH_CLIENT_ERROR.MISSING_SITE);
  });

  it('clears error and fetches when site is present', async () => {
    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.search({ page: 0, size: 12 });
    });

    expect(global.fetch).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('stores BatteryIncluded typed facets separately from legacy availableFilters', async () => {
    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.search({ page: 0, size: 12 });
    });

    expect(result.current.facets).toEqual([]);
    expect(result.current.batteryIncludedFacets).toEqual([
      {
        id: 'color',
        label: 'color',
        kind: 'select',
        options: [
          {
            id: 'red',
            label: 'Red',
            active: true,
            count: 1,
          },
        ],
      },
    ]);
  });

  it('retains the last known BatteryIncluded facets when a search response omits them', async () => {
    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.search({ page: 0, size: 12 });
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
        page: 0,
        pageSize: 12,
        availableFilters: [],
        availableSorts: [],
      }),
    });

    await act(async () => {
      await result.current.search({ page: 0, size: 12, query: 'solar' });
    });

    expect(result.current.batteryIncludedFacets).toEqual([
      {
        id: 'color',
        label: 'color',
        kind: 'select',
        options: [
          {
            id: 'red',
            label: 'Red',
            active: true,
            count: 1,
          },
        ],
      },
    ]);
  });

  it('retains the last known BatteryIncluded facets when loadMore omits them', async () => {
    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.search({ page: 0, size: 12 });
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
        page: 1,
        pageSize: 12,
        availableSorts: [],
      }),
    });

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.batteryIncludedFacets).toEqual([
      {
        id: 'color',
        label: 'color',
        kind: 'select',
        options: [
          {
            id: 'red',
            label: 'Red',
            active: true,
            count: 1,
          },
        ],
      },
    ]);
  });

  it('clears sort state when category navigation searches omit sort', async () => {
    const { result } = renderHook(() =>
      useSearch(
        {
          page: 0,
          size: 12,
          sort: 'name:asc',
        },
        {
          items: [],
          total: 0,
          page: 0,
          pageSize: 12,
          availableFilters: [],
          availableSorts: [],
        } as never,
      ),
    );

    expect(result.current.currentSort).toBe('name:asc');

    await act(async () => {
      await result.current.search({
        page: 0,
        size: 12,
        sort: undefined,
        filters: {
          [BATTERY_INCLUDED_BREADCRUMB_FILTER]: 'Electrical supplies > Power generation > Solar panels',
        },
      });
    });

    expect(result.current.currentSort).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(expect.not.stringContaining('sort='));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        `filters%5B${encodeURIComponent(BATTERY_INCLUDED_BREADCRUMB_FILTER)}%5D=Electrical+supplies+%3E+Power+generation+%3E+Solar+panels`,
      ),
    );
  });

  it('clears all live filters through resetAllFacets and does not repopulate stale filter state', async () => {
    const { result } = renderHook(() =>
      useSearch(
        {
          page: 0,
          size: 12,
          filters: {
            color: ['red'],
            brand: 'Acme',
          },
        },
        {
          items: [],
          total: 0,
          page: 0,
          pageSize: 12,
          availableFilters: [],
          availableSorts: [],
        } as never,
      ),
    );

    await act(async () => {
      result.current.resetAllFacets();
    });

    expect(global.fetch).toHaveBeenCalledWith(expect.not.stringContaining('filters%5Bcolor%5D'));
    expect(global.fetch).toHaveBeenCalledWith(expect.not.stringContaining('filters%5Bbrand%5D'));
    expect(result.current.activeFilters).toEqual({});

    await act(async () => {
      await result.current.search({
        page: 0,
        size: 12,
      });
    });

    expect(result.current.activeFilters).toEqual({});
  });

  it('preserves unrelated filters when applying a category selection filter', async () => {
    const { result } = renderHook(() =>
      useSearch(
        {
          page: 0,
          size: 12,
          filters: {
            brand: 'Acme',
          },
        },
        {
          items: [],
          total: 0,
          page: 0,
          pageSize: 12,
          availableFilters: [],
          availableSorts: [],
        } as never,
      ),
    );

    await act(async () => {
      result.current.applyFacet(BATTERY_INCLUDED_BREADCRUMB_FILTER, 'Cables > USB-C');
    });

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(`filters%5Bbrand%5D=Acme`));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        `filters%5B${encodeURIComponent(BATTERY_INCLUDED_BREADCRUMB_FILTER)}%5D=Cables+%3E+USB-C`,
      ),
    );
    expect(result.current.activeFilters).toEqual({
      brand: 'Acme',
      [BATTERY_INCLUDED_BREADCRUMB_FILTER]: 'Cables > USB-C',
    });
  });

  it('does not write currency onto the storefront browse URL', async () => {
    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.search({ page: 0, size: 12, query: 'solar' });
    });

    expect(mockPush).toHaveBeenCalled();
    const pushedUrl = String(mockPush.mock.calls[0]?.[0] ?? '');
    expect(pushedUrl).toContain('q=solar');
    expect(pushedUrl).not.toContain('currency=');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('currency=EUR'));
  });

  it('preserves an existing storefront currency query when syncing the browse URL', async () => {
    window.history.replaceState({}, '', '/browse?currency=USD');
    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.search({ page: 0, size: 12, query: 'solar' });
    });

    expect(mockPush).toHaveBeenCalled();
    const pushedUrl = String(mockPush.mock.calls[0]?.[0] ?? '');
    expect(pushedUrl).toContain('q=solar');
    expect(pushedUrl).toContain('currency=USD');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('currency=EUR'));
  });

  it('issues a single fetch for overlapping identical searches', async () => {
    let resolveResponse: ((value: { ok: boolean; json: () => Promise<unknown> }) => void) | undefined;
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
    );

    const { result } = renderHook(() => useSearch());

    let firstSearch: Promise<void> | undefined;
    let secondSearch: Promise<void> | undefined;
    await act(async () => {
      firstSearch = result.current.search({ page: 0, size: 12, query: 'solar' });
      secondSearch = result.current.search({ page: 0, size: 12, query: 'solar' });
    });

    resolveResponse?.({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
        page: 0,
        pageSize: 12,
        availableFilters: [],
        availableSorts: [],
      }),
    });

    await act(async () => {
      await Promise.all([firstSearch, secondSearch]);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('joins a URL-sync-style second search after the first request has started', async () => {
    let resolveResponse: ((value: { ok: boolean; json: () => Promise<unknown> }) => void) | undefined;
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
    );

    const { result } = renderHook(() => useSearch());
    const params = {
      page: 0,
      size: 12,
      query: 'solar',
      sort: 'price:asc',
      filters: { color: 'red' },
    };

    let firstSearch: Promise<void> | undefined;
    await act(async () => {
      firstSearch = result.current.search(params);
    });

    let secondSearch: Promise<void> | undefined;
    await act(async () => {
      secondSearch = result.current.search(params);
    });

    resolveResponse?.({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
        page: 0,
        pageSize: 12,
        availableFilters: [],
        availableSorts: [],
      }),
    });

    await act(async () => {
      await Promise.all([firstSearch, secondSearch]);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not fetch again for a just-completed same-key search when initialResults is omitted', async () => {
    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.search({
        page: 0,
        size: 12,
        query: 'solar',
        sort: 'price:asc',
        filters: { color: 'red' },
      });
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.search({
        page: 0,
        size: 12,
        query: 'solar',
        sort: 'price:asc',
        filters: { color: 'red' },
      });
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('still fetches when only session currency changes', async () => {
    const { result, rerender } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.search({ page: 0, size: 12, query: 'solar' });
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('currency=EUR'));

    mockUseSessionStore.mockReturnValue({ session: { currency: 'USD' } });

    await act(async () => {
      rerender();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('currency=USD'));
  });

  it('retries a failed search with the same key', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Unavailable',
    });

    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.search({ page: 0, size: 12, query: 'solar' });
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe(USE_SEARCH_CLIENT_ERROR.GENERIC);

    await act(async () => {
      await result.current.search({ page: 0, size: 12, query: 'solar' });
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
  });
});
