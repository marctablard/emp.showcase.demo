import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import useHistory from '@/hooks/history/useHistory';
import { useSiteCode } from '@/hooks/site/useSiteCode';
import { getLogger } from '@/lib/logger/use-logger-client';
import type {
  BatteryIncludedFacet,
  Filter,
  SearchFilterValue,
  SearchFilters,
  SearchParams,
  SearchResult,
} from '@/platform/services/model/common';
import type { SearchSuggestions } from '@/platform/services/model/search/SearchSuggestions';
import { useSessionStore } from '@/providers/StoreProvider';
import { buildSearchPaginationUrl } from './build-search-pagination-url';

const DEFAULT_PAGE_INDEX = 0;
const DEFAULT_PAGE_SIZE = 12;

/** Returned on {@link useSearch}; map to `search.errors.*` in next-intl. */
export const USE_SEARCH_CLIENT_ERROR = {
  MISSING_SITE: 'MISSING_SITE',
  GENERIC: 'GENERIC',
} as const;

export type UseSearchClientError = (typeof USE_SEARCH_CLIENT_ERROR)[keyof typeof USE_SEARCH_CLIENT_ERROR];

export function useSearch<T>(initialSearch?: SearchParams<T>, initialResult?: SearchResult<T>) {
  const { addSearchQuery } = useHistory();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<T[]>(initialResult?.items || []);
  const [loading, setLoading] = useState(!initialResult);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<UseSearchClientError | null>(null);
  const [facets, setFacets] = useState<Filter[]>([]);
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
    page: DEFAULT_PAGE_INDEX,
    size: DEFAULT_PAGE_SIZE,
  });
  const searchGeneration = useRef(0);

  /**
   * Updates the browser URL to reflect current search parameters without reloading.
   * Normalizes parameters for the browser:
   * - maps 'query' to 'q'
   * - omits empty search terms ('q' or 'query') so /browse?q= is treated as /browse
   * - omits default page/size values
   * Skips navigation if the current URL is already equivalent.
   */
  const updateBrowserUrl = useCallback(
    (apiSearchParams: URLSearchParams) => {
      const isDefault = (k: string, v: string) =>
        (k === 'page' && v === String(DEFAULT_PAGE_INDEX)) || (k === 'size' && v === String(DEFAULT_PAGE_SIZE));

      const normalize = (src: URLSearchParams, mapQuery: boolean) => {
        const out = new URLSearchParams();
        src.forEach((value, key) => {
          // Only for /api/search — never mirror onto the storefront URL (path already encodes site/locale).
          if (key === 'site' || key === 'locale') {
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
      const newUrl = newParams.toString() ? `${pathname}?${newParams}` : pathname;

      const currentParams = new URLSearchParams(window.location.search);
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
      const gen = ++searchGeneration.current;
      try {
        setLoading(true);
        setError(null);

        const resolvedSite = siteCode?.trim();
        if (!resolvedSite) {
          getLogger().warn({ event: 'search_missing_site' }, 'Product search skipped: no site context');
          setError(USE_SEARCH_CLIENT_ERROR.MISSING_SITE);
          setLoading(false);
          return;
        }

        // Build the URL with query parameters
        const url = new URL('/api/search', window.location.origin);

        // Add basic parameters
        if (params.query) {
          url.searchParams.append('query', params.query);
          setCurrentQuery(params.query);
        }

        if (params.page !== undefined) {
          url.searchParams.append('page', params.page.toString());
          setCurrentPage(params.page);
        }

        if (params.size !== undefined) {
          url.searchParams.append('size', params.size.toString());
          setPageSize(params.size);
        }

        if (params.sort) {
          url.searchParams.append('sort', params.sort);
          setCurrentSort(params.sort);
        }
        url.searchParams.append('site', resolvedSite);
        url.searchParams.append('locale', locale);
        if (sessionCurrency) {
          url.searchParams.append('currency', sessionCurrency);
        }

        const filtersToApply = params.filters && Object.keys(params.filters).length > 0 ? params.filters : undefined;
        if (filtersToApply) {
          Object.entries(filtersToApply).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              value.forEach((val) => {
                url.searchParams.append(`filters[${key}][]`, val);
              });
            } else if (typeof value === 'object' && value !== null) {
              Object.entries(value).forEach(([nestedKey, nestedValue]) => {
                url.searchParams.append(`filters[${key}][${nestedKey}]`, String(nestedValue));
              });
            } else {
              url.searchParams.append(`filters[${key}]`, String(value));
            }
          });
        }
        setActiveFilters(filtersToApply ?? {});

        const paramsForRef: SearchParams<T> = { ...params, filters: filtersToApply };
        lastSearchParams.current = paramsForRef;

        // Update browser URL with the same parameters (but with 'q' instead of 'query')
        updateBrowserUrl(url.searchParams);

        const response = await fetch(url.toString());

        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`);
        }

        const data: SearchResult<T> = await response.json();

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

        setBatteryIncludedFacets(data.batteryIncludedFacets);
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

  /**
   * Apply a facet filter to the search
   */
  const applyFacet = useCallback(
    (facetId: string, value: string | string[]) => {
      const newFilters = { ...activeFilters, [facetId]: value };

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
      const newFilters = { ...activeFilters };

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
      });

      // Reset to first page when applying filters
      search({
        ...lastSearchParams.current,
        page: 0,
        filters: newFilters,
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

    setActiveFilters({});
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

      if (lastSearchParams.current.filters) {
        Object.entries(lastSearchParams.current.filters).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach((val) => url.searchParams.append(`filters[${key}][]`, val));
          } else if (typeof value === 'object' && value !== null) {
            Object.entries(value).forEach(([nestedKey, nestedValue]) => {
              url.searchParams.append(`filters[${key}][${nestedKey}]`, String(nestedValue));
            });
          } else {
            url.searchParams.append(`filters[${key}]`, String(value));
          }
        });
      }

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`Search failed: ${response.statusText}`);

      const result: SearchResult<T> = await response.json();

      setData((prev) => [...prev, ...result.items]);
      setCurrentPage(nextPage);
      setTotal(result.total);
      setBatteryIncludedFacets(result.batteryIncludedFacets);

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
          throw new Error(`Suggestions failed: ${response.statusText}`);
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
    (sort: string) => {
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
