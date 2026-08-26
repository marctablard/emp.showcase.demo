import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import useHistory from '@/hooks/history/useHistory';
import { useSiteCode } from '@/hooks/site/useSiteCode';
import { fetchSearchResult } from '@/lib/client/search';
import { copyStorefrontCurrencyParam } from '@/lib/common/currency-url';
import { getLogger } from '@/lib/logger/use-logger-client';
import { isDedicatedCategorySelectionFilter } from '@/lib/search/category-selection';
import type {
  BatteryIncludedFacet,
  Filter,
  SearchFilterValue,
  SearchFilters,
  SearchParams,
  SearchResult,
  SearchSortOption,
} from '@/platform/services/model/common';
import type { SearchSuggestions } from '@/platform/services/model/search/SearchSuggestions';
import { useSessionStore } from '@/providers/StoreProvider';
import { appendSearchFilters } from './append-search-filters';
import { buildSearchPaginationUrl } from './build-search-pagination-url';

const DEFAULT_PAGE_INDEX = 0;
const DEFAULT_PAGE_SIZE = 12;

/** Returned on {@link useSearch}; map to `search.errors.*` in next-intl. */
export const USE_SEARCH_CLIENT_ERROR = {
  MISSING_SITE: 'MISSING_SITE',
  GENERIC: 'GENERIC',
} as const;

export type UseSearchClientError = (typeof USE_SEARCH_CLIENT_ERROR)[keyof typeof USE_SEARCH_CLIENT_ERROR];

const normalizeFiltersForCategorySelection = (filters: SearchFilters, selectedFacetId: string): SearchFilters => {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([facetId]) => !isDedicatedCategorySelectionFilter(facetId) || facetId === selectedFacetId,
    ),
  );
};

function buildSearchRequestUrl<T>(
  origin: string,
  params: SearchParams<T>,
  resolvedSite: string,
  locale: string,
  sessionCurrency: string | undefined,
  normalizedQuery: string | undefined,
  filtersToApply: SearchFilters | undefined,
): URL {
  const url = new URL('/api/search', origin);

  if (normalizedQuery) {
    url.searchParams.append('query', normalizedQuery);
  }
  if (params.page !== undefined) {
    url.searchParams.append('page', params.page.toString());
  }
  if (params.size !== undefined) {
    url.searchParams.append('size', params.size.toString());
  }
  if (params.sort) {
    url.searchParams.append('sort', params.sort);
  }
  url.searchParams.append('site', resolvedSite);
  url.searchParams.append('locale', locale);
  if (sessionCurrency) {
    url.searchParams.append('currency', sessionCurrency);
  }
  appendSearchFilters(url, filtersToApply);

  return url;
}

function toSearchFailedError(response: Response): Error {
  return new Error(`Search failed: ${response.status} ${response.statusText || 'Request failed'}`);
}

export function useSearch<T>(initialSearch?: SearchParams<T>, initialResult?: SearchResult<T>) {
  const { addSearchQuery } = useHistory();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<T[]>(initialResult?.items || []);
  const [loading, setLoading] = useState(!initialResult);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<UseSearchClientError | null>(null);
  const [facets, setFacets] = useState<Filter[]>([]);
  const [availableSorts, setAvailableSorts] = useState<SearchSortOption[]>(initialResult?.availableSorts || []);
  const [batteryIncludedFacets, setBatteryIncludedFacets] = useState<BatteryIncludedFacet[] | undefined>(
    initialResult?.batteryIncludedFacets,
  );
  const [total, setTotal] = useState(initialResult?.total || 0);
  const [currentPage, setCurrentPage] = useState(initialResult?.page || DEFAULT_PAGE_INDEX);
  const [pageSize, setPageSize] = useState(initialResult?.pageSize || DEFAULT_PAGE_SIZE);
  const [activeFilters, setActiveFilters] = useState<Record<string, SearchFilterValue>>(initialSearch?.filters || {});
  const [currentQuery, setCurrentQuery] = useState<string | undefined>(initialSearch?.query);
  const [currentSort, setCurrentSort] = useState<string | undefined>(initialSearch?.sort);
  // Suggestions state
  const [suggestions, setSuggestions] = useState<SearchSuggestions>({
    queryCompletions: [],
    products: [],
    categories: [],
  });
  const siteCode = useSiteCode();
  const locale = useLocale();
  const sessionCurrency = useSessionStore().session?.currency;

  // Keep track of the last search params for pagination
  const lastSearchParams = useRef<SearchParams<T>>({
    page: initialSearch?.page ?? DEFAULT_PAGE_INDEX,
    size: initialSearch?.size ?? DEFAULT_PAGE_SIZE,
    query: initialSearch?.query,
    sort: initialSearch?.sort,
    filters: initialSearch?.filters,
  });
  const searchGeneration = useRef(0);
  const lastSearchCurrency = useRef<string | undefined>(sessionCurrency);
  // The pathname where this search hook is hosted (e.g. /browse), captured on mount.
  // While an intercepting route (e.g. the /login dialog) is open, `usePathname()` returns the
  // intercept's pathname for this still-mounted page; syncing to it would rewrite the browser URL
  // to /login and pollute history, breaking router.back() restore. Skip URL sync in that case.
  const searchHostPathnameRef = useRef(pathname);

  /**
   * Updates the browser URL to reflect current search parameters without reloading.
   * Normalizes parameters for the browser:
   * - maps 'query' to 'q'
   * - omits empty search terms ('q' or 'query') so /browse?q= is treated as /browse
   * - omits default page/size values
   * - omits site/locale/currency from the API request (path encodes site/locale;
   *   currency is session-owned for `/api/search`)
   * - preserves an existing storefront `?currency=` so inbound/share links stay
   *   visible for CurrencyUrlAligner (COP-5942)
   * Skips navigation if the current URL is already equivalent.
   */
  const updateBrowserUrl = useCallback(
    (apiSearchParams: URLSearchParams) => {
      // Do not sync the browser URL when the active route is no longer the search page
      // (e.g. an intercepting /login dialog changed the pathname). Prevents polluting history.
      if (pathname !== searchHostPathnameRef.current) {
        return;
      }

      const isDefault = (k: string, v: string) =>
        (k === 'page' && v === String(DEFAULT_PAGE_INDEX)) || (k === 'size' && v === String(DEFAULT_PAGE_SIZE));

      const normalize = (src: URLSearchParams, mapQuery: boolean) => {
        const out = new URLSearchParams();
        src.forEach((value, key) => {
          // API-only: path already encodes site/locale. Do not copy session currency
          // onto the storefront (COP-5942 — defaults stay out of the URL).
          if (key === 'site' || key === 'locale' || key === 'currency') {
            return;
          }
          // Replace 'query' with 'q' in the browser URL for consistency
          const k = mapQuery && key === 'query' ? 'q' : key;
          // Omit empty search terms so /browse?q= is treated as /browse
          if ((k === 'q' || key === 'query') && value.trim() === '') {
            return;
          }
          // This prevents /browse from redirecting to /browse?page=0&size=12
          if (!isDefault(k, value)) {
            // Copy all other parameters as is
            out.append(k, value);
          }
        });
        return out;
      };

      // Create a new URLSearchParams for the browser URL
      const newParams = normalize(apiSearchParams, true);
      const currentParams = new URLSearchParams(window.location.search);
      copyStorefrontCurrencyParam(currentParams, newParams);
      const newUrl = newParams.toString() ? `${pathname}?${newParams}` : pathname;

      const normalizedCurrent = normalize(currentParams, false);
      const normalizedCurrentUrl = normalizedCurrent.toString() ? `${pathname}?${normalizedCurrent}` : pathname;

      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (currentUrl === newUrl || normalizedCurrentUrl === newUrl) {
        return;
      }

      router.push(newUrl, { scroll: false });
    },
    [pathname, router],
  );

  /**
   * Search for products with the given parameters
   */
  const search = useCallback(
    async (params: SearchParams<T>) => {
      const resolvedSite = siteCode?.trim();
      if (!resolvedSite) {
        getLogger().warn({ event: 'search_missing_site' }, 'Product search skipped: no site context');
        setError(USE_SEARCH_CLIENT_ERROR.MISSING_SITE);
        setLoading(false);
        return;
      }

      const normalizedQuery = params.query?.trim() ? params.query : undefined;
      const filtersToApply = params.filters && Object.keys(params.filters).length > 0 ? params.filters : undefined;
      const url = buildSearchRequestUrl(
        globalThis.location.origin,
        params,
        resolvedSite,
        locale,
        sessionCurrency,
        normalizedQuery,
        filtersToApply,
      );

      lastSearchParams.current = {
        ...params,
        query: normalizedQuery,
        filters: filtersToApply,
      };
      lastSearchCurrency.current = sessionCurrency;

      const requestUrl = url.toString();
      const gen = ++searchGeneration.current;

      try {
        setLoading(true);
        setError(null);
        setCurrentQuery(normalizedQuery);
        if (params.page !== undefined) {
          setCurrentPage(params.page);
        }
        if (params.size !== undefined) {
          setPageSize(params.size);
        }
        setCurrentSort(params.sort);
        setActiveFilters(filtersToApply ?? {});

        // Update browser URL with the same parameters (but with 'q' instead of 'query')
        updateBrowserUrl(url.searchParams);

        const data = await fetchSearchResult<T>(requestUrl);

        if (gen !== searchGeneration.current) {
          return;
        }

        // Update state with the search results
        setData(data.items);
        setTotal(data.total);
        setCurrentPage(data.page);
        setPageSize(data.pageSize);

        if (data.availableFilters) {
          setFacets(data.availableFilters);
        }

        setAvailableSorts(data.availableSorts || []);

        if (data.batteryIncludedFacets && data.batteryIncludedFacets.length > 0) {
          setBatteryIncludedFacets(data.batteryIncludedFacets);
        }
      } catch (err) {
        if (gen === searchGeneration.current) {
          getLogger().error({ err, event: 'search_request_failed' }, 'Product search request failed');
          setError(USE_SEARCH_CLIENT_ERROR.GENERIC);
        }
      } finally {
        if (gen === searchGeneration.current) {
          setLoading(false);
        }
      }
    },
    [updateBrowserUrl, locale, siteCode, sessionCurrency],
  );

  useEffect(() => {
    if (!sessionCurrency) {
      return;
    }
    if (lastSearchCurrency.current === undefined) {
      lastSearchCurrency.current = sessionCurrency;
      return;
    }
    if (lastSearchCurrency.current === sessionCurrency) {
      return;
    }
    lastSearchCurrency.current = sessionCurrency;
    search(lastSearchParams.current).catch((err: unknown) => {
      getLogger().error({ err, event: 'search_currency_refresh_failed' }, 'Product search currency refresh failed');
    });
  }, [sessionCurrency, search]);

  /**
   * Apply a facet filter to the search
   */
  const applyFacet = useCallback(
    (facetId: string, value: string | string[]) => {
      const mergedFilters = { ...activeFilters, [facetId]: value };
      const newFilters = isDedicatedCategorySelectionFilter(facetId)
        ? normalizeFiltersForCategorySelection(mergedFilters, facetId)
        : mergedFilters;

      // Reset to first page when applying a filter
      search({
        ...lastSearchParams.current,
        page: 0,
        filters: newFilters,
      });
    },
    [activeFilters, search],
  );

  /**
   * Apply a range facet filter to the search
   */
  const applyRangeFacet = useCallback(
    (facetId: string, min: string, max: string) => {
      const newFilters = {
        ...activeFilters,
        [facetId]: {
          from: min,
          till: max,
        },
      };

      // Reset to first page when applying a filter
      search({
        ...lastSearchParams.current,
        page: 0,
        filters: newFilters,
      });
    },
    [activeFilters, search],
  );

  /**
   * Apply multiple facet filters at once to the search
   */
  const applyAllFacets = useCallback(
    (facets: Array<{ facetId: string; value: string | string[] } | { facetId: string; min: string; max: string }>) => {
      // Start with current active filters
      const newFilters: SearchFilters = { ...activeFilters };
      let selectedCategorySelectionFacetId: string | undefined;

      // Apply each facet to build up the filters object
      facets.forEach((facet) => {
        if ('value' in facet) {
          // Handle standard facet
          newFilters[facet.facetId] = facet.value;
        } else if ('min' in facet && 'max' in facet) {
          // Handle range facet
          newFilters[facet.facetId] = {
            from: facet.min,
            till: facet.max,
          };
        }

        if (isDedicatedCategorySelectionFilter(facet.facetId)) {
          selectedCategorySelectionFacetId = facet.facetId;
        }
      });

      const normalizedFilters =
        selectedCategorySelectionFacetId !== undefined
          ? normalizeFiltersForCategorySelection(newFilters, selectedCategorySelectionFacetId)
          : newFilters;

      // Reset to first page when applying filters
      search({
        ...lastSearchParams.current,
        page: 0,
        filters: normalizedFilters,
      });
    },
    [activeFilters, search],
  );

  /**
   * Remove a facet filter from the search
   */
  const resetFacet = useCallback(
    (facetId: string) => {
      const newFilters = { ...activeFilters };
      delete newFilters[facetId];

      // Reset to first page when removing a filter
      search({
        ...lastSearchParams.current,
        page: 0,
        filters: newFilters,
      });
    },
    [activeFilters, search],
  );

  /**
   * Reset all facet filters
   */
  const resetAllFacets = useCallback(() => {
    // Reset to first page with no filters
    search({
      ...lastSearchParams.current,
      page: 0,
      filters: undefined,
    });
  }, [search]);

  /**
   * Change the current page
   */
  const changePage = useCallback(
    (page: number) => {
      search({
        ...lastSearchParams.current,
        page,
      });
    },
    [search],
  );

  const hasMore = useMemo(() => (currentPage + 1) * pageSize < total, [currentPage, pageSize, total]);

  /**
   * Fetch the next page of results and append to the existing data
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;

    const resolvedSite = siteCode?.trim();
    if (!resolvedSite) return;

    const nextPage = currentPage + 1;
    try {
      setLoadingMore(true);
      setError(null);

      const url = buildSearchPaginationUrl({
        origin: window.location.origin,
        nextPage,
        pageSize,
        siteCode: resolvedSite,
        locale,
        query: lastSearchParams.current.query,
        sort: lastSearchParams.current.sort,
        currency: sessionCurrency,
      });

      appendSearchFilters(url, lastSearchParams.current.filters);

      const response = await fetch(url.toString());
      if (!response.ok) throw toSearchFailedError(response);

      const result: SearchResult<T> = await response.json();

      setData((prev) => [...prev, ...result.items]);
      setCurrentPage(nextPage);
      setTotal(result.total);
      setAvailableSorts(result.availableSorts || []);
      if (result.batteryIncludedFacets && result.batteryIncludedFacets.length > 0) {
        setBatteryIncludedFacets(result.batteryIncludedFacets);
      }

      lastSearchParams.current = { ...lastSearchParams.current, page: nextPage };
    } catch (err) {
      getLogger().error({ err, event: 'search_load_more_failed' }, 'Product search load-more failed');
      setError(USE_SEARCH_CLIENT_ERROR.GENERIC);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, loading, currentPage, pageSize, siteCode, locale, sessionCurrency]);

  const getSuggestions = useCallback(
    async (query: string, locale?: string): Promise<void> => {
      setLoading(true);
      if (!query?.trim()) {
        setSuggestions({
          queryCompletions: [],
          products: [],
          categories: [],
        });
        setLoading(false);
        return;
      }
      const resolvedSite = siteCode?.trim();
      if (!resolvedSite) {
        setLoading(false);
        return;
      }
      try {
        const url = new URL('/api/search/suggestions', window.location.origin);
        url.searchParams.append('query', query);
        url.searchParams.append('site', resolvedSite);
        if (locale) {
          url.searchParams.append('locale', locale);
        }
        if (sessionCurrency) {
          url.searchParams.append('currency', sessionCurrency);
        }
        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`Suggestions failed: ${response.status} ${response.statusText || 'Request failed'}`);
        }
        const data = await response.json();

        // Set suggestions directly from API response
        setSuggestions(data);
      } catch (err) {
        getLogger().error({ err, query }, 'Error fetching suggestions');
      } finally {
        setLoading(false);
      }
    },
    [siteCode, sessionCurrency],
  );

  const changeSort = useCallback(
    (sort?: string) => {
      search({
        ...lastSearchParams.current,
        sort,
        page: 0, // Reset to first page when changing sort
      });
    },
    [search],
  );

  /**
   * When browse URL matches SSR (redundant /api/search skipped), keep hook state aligned with the URL so
   * filter chips, category label resolution, and pagination refs stay correct after client navigation.
   */
  const syncBrowseSearchStateFromUrl = useCallback(
    (slice: { query: string; page: number; size: number; sort?: string; filtersRecord: SearchFilters }) => {
      setError(null);
      const filters = Object.keys(slice.filtersRecord).length > 0 ? slice.filtersRecord : undefined;
      const q = slice.query.trim() ? slice.query : undefined;

      setActiveFilters(filters ?? {});
      setCurrentPage(slice.page);
      setPageSize(slice.size);
      setCurrentQuery(q);
      setCurrentSort(slice.sort);

      lastSearchParams.current = {
        page: slice.page,
        size: slice.size,
        query: q,
        sort: slice.sort,
        filters,
      };
    },
    [],
  );

  useEffect(() => {
    if (currentQuery) {
      addSearchQuery(currentQuery);
    }
  }, [currentQuery, addSearchQuery]);

  return {
    // State
    data,
    loading,
    loadingMore,
    error,
    hasMore,
    facets,
    availableSorts,
    batteryIncludedFacets,
    total,
    currentPage,
    pageSize,
    activeFilters,
    currentQuery,
    currentSort,

    // Functions
    search,
    loadMore,
    applyAllFacets,
    applyFacet,
    applyRangeFacet,
    resetFacet,
    resetAllFacets,
    changePage,
    changeSort,
    suggestions,
    getSuggestions,
    setPage: changePage,
    syncBrowseSearchStateFromUrl,
  };
}

export default useSearch;
