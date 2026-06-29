import { act, renderHook } from '@testing-library/react';
import { useSiteCode } from '@/hooks/site/useSiteCode';
import { BATTERY_INCLUDED_BREADCRUMB_FILTER } from '@/platform/services/model/category/batteryincluded-category';
import { USE_SEARCH_CLIENT_ERROR, useSearch } from './useSearch';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/browse',
}));

jest.mock('@/hooks/history/useHistory', () => ({
  __esModule: true,
  default: () => ({ addSearchQuery: jest.fn() }),
}));

jest.mock('@/providers/StoreProvider', () => ({
  useSessionStore: () => ({ session: { currency: 'EUR' } }),
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

  it('clears non-category filters when applying a category selection filter', async () => {
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
      result.current.applyFacet(BATTERY_INCLUDED_BREADCRUMB_FILTER, 'Cables > USB-C');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        `filters%5B${encodeURIComponent(BATTERY_INCLUDED_BREADCRUMB_FILTER)}%5D=Cables+%3E+USB-C`,
      ),
    );
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('filters%5Bcolor%5D'));
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('filters%5Bbrand%5D'));
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
});
