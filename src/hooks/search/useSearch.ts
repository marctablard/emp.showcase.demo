import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useProductsMode } from '@/components/navigation/products-mode-context';
import useHistory from '@/hooks/history/useHistory';
import { useSiteCode } from '@/hooks/site/useSiteCode';
import { buildClientFetchScope } from '@/lib/client/client-fetch-scope';
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
import { browseSearchStateSignature } from '@/utils/filterUtils';
import { appendSearchFilters } from './append-search-filters';
import { buildSearchPaginationUrl } from './build-search-pagination-url';

const DEFAULT_PAGE_INDEX = 0;
const DEFAULT_PAGE_SIZE = 12;
const EMPTY_SUGGESTIONS: SearchSuggestions = { queryCompletions: [], products: [], categories: [] };

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

function buildSearchRequestKey(
  state: {
    query?: string;
    page: number;
    size: number;
    sort?: string;
    filters?: SearchFilters;
  },
  site: string,
  locale: string,
  currency: string | undefined,
  clientScope: string,
): string {
  return `${browseSearchStateSignature(state)}|${site}|${locale}|${currency ?? ''}|${clientScope}`;
}

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

function applySuccessfulSearchPayload<T>(
  data: SearchResult<T>,
  apply: {
    setData: (items: T[]) => void;
    setTotal: (total: number) => void;
    setCurrentPage: (page: number) => void;
    setPageSize: (size: number) => void;
    setFacets: (filters: Filter[]) => void;
    setAvailableSorts: (sorts: SearchSortOption[]) => void;
    setBatteryIncludedFacets: (facets: BatteryIncludedFacet[] | undefined) => void;
  },
): void {
  apply.setData(data.items);
  apply.setTotal(data.total);
  apply.setCurrentPage(data.page);
  apply.setPageSize(data.pageSize);
  if (data.availableFilters) {
    apply.setFacets(data.availableFilters);
  }
  apply.setAvailableSorts(data.availableSorts || []);
  if (data.batteryIncludedFacets && data.batteryIncludedFacets.length > 0) {
    apply.setBatteryIncludedFacets(data.batteryIncludedFacets);
  }
}

function reportSearchRequestFailure(
  generation: number,
  currentGeneration: number,
  err: unknown,
  setError: (error: UseSearchClientError) => void,
): void {
  if (generation !== currentGeneration) {
    return;
  }
  getLogger().error({ err, event: 'search_request_failed' }, 'Product search request failed');
  setError(USE_SEARCH_CLIENT_ERROR.GENERIC);
}

function finishSearchInFlight(
  generation: number,
  currentGeneration: number,
  requestKey: string,
  inFlightSearch: { current: { key: string; promise: Promise<void> } | undefined },
  setLoading: (loading: boolean) => void,
  settleInFlight: () => void,
): void {
  if (generation === currentGeneration) {
    setLoading(false);
  }
  if (inFlightSearch.current?.key === requestKey) {
    inFlightSearch.current = undefined;
  }
  settleInFlight();
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
  const [suggestions, setSuggestions] = useState<SearchSuggestions>(EMPTY_SUGGESTIONS);
  const siteCode = useSiteCode();
  const locale = useLocale();
  const session = useSessionStore().session;
  const sessionCurrency = session?.currency;
  const { mode } = useProductsMode();
  const clientFetchScope = buildClientFetchScope({
    mode,
    siteCode,
    customerId: session?.customerId,
    extra: sessionCurrency,
  });

  // Keep track of the last search params for pagination
  const lastSearchParams = useRef<SearchParams<T>>({
    page: initialSearch?.page ?? DEFAULT_PAGE_INDEX,
    size: initialSearch?.size ?? DEFAULT_PAGE_SIZE,
    query: initialSearch?.query,
    sort: initialSearch?.sort,
    filters: initialSearch?.filters,
  });
  const searchGeneration = useRef(0);
  // Latest scope for the direct fetches below (suggestions, load-more): a response captured under
  // an older products-mode / customer scope must never populate the new scope's UI (COP-4822).
  const clientFetchScopeRef = useRef(clientFetchScope);
  const suggestionsGeneration = useRef(0);
  const lastClientFetchScope = useRef<string | undefined>(undefined);
  const lastCompletedSearchKey = useRef<string | undefined>(undefined);
  const inFlightSearch = useRef<{ key: string; promise: Promise<void> } | undefined>(undefined);
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
   *   visible for CurrencyUrlAligner
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
          // onto the storefront (defaults stay out of the URL).
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
      const currentParams = new URLSearchParams(globalThis.location.search);
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
      const requestKey = buildSearchRequestKey(
        {
          query: normalizedQuery,
          page: params.page ?? DEFAULT_PAGE_INDEX,
          size: params.size ?? DEFAULT_PAGE_SIZE,
          sort: params.sort,
          filters: filtersToApply,
        },
        resolvedSite,
        locale,
        sessionCurrency,
        clientFetchScope,
      );

      const inFlight = inFlightSearch.current;
      if (inFlight?.key === requestKey) {
        return inFlight.promise;
      }

      if (lastCompletedSearchKey.current === requestKey) {
        return;
      }

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
      lastClientFetchScope.current = clientFetchScope;

      const requestUrl = url.toString();
      const gen = ++searchGeneration.current;

      let settleInFlight = () => {};
      const inFlightPromise = new Promise<void>((resolve) => {
        settleInFlight = resolve;
      });
      // Write the key before setLoading / URL sync / fetch so a same-turn searchParams
      // effect cannot start a second /api/search.
      inFlightSearch.current = { key: requestKey, promise: inFlightPromise };

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

        const data = await fetchSearchResult<T>(requestUrl, clientFetchScope);

        if (gen !== searchGeneration.current) {
          return;
        }

        applySuccessfulSearchPayload(data, {
          setData,
          setTotal,
          setCurrentPage,
          setPageSize,
          setFacets,
          setAvailableSorts,
          setBatteryIncludedFacets,
        });
        lastCompletedSearchKey.current = requestKey;
      } catch (err) {
        reportSearchRequestFailure(gen, searchGeneration.current, err, setError);
      } finally {
        finishSearchInFlight(gen, searchGeneration.current, requestKey, inFlightSearch, setLoading, settleInFlight);
      }
    },
    [updateBrowserUrl, locale, siteCode, sessionCurrency, clientFetchScope],
  );

  useEffect(() => {
    clientFetchScopeRef.current = clientFetchScope;
  }, [clientFetchScope]);

  useEffect(() => {
    if (lastClientFetchScope.current === undefined) {
      lastClientFetchScope.current = clientFetchScope;
      return;
    }
    if (lastClientFetchScope.current === clientFetchScope) {
      return;
    }
    lastClientFetchScope.current = clientFetchScope;
    lastCompletedSearchKey.current = undefined;
    // Suggestions and tiles were produced under the previous scope: drop them so
    // SearchProductTileGrid cannot keep painting ALL/other-customer products while loading.
    suggestionsGeneration.current += 1;
    setSuggestions(EMPTY_SUGGESTIONS);
    setData([]);
    setTotal(0);
    search(lastSearchParams.current).catch((err: unknown) => {
      getLogger().error({ err, event: 'search_scope_refresh_failed' }, 'Product search scope refresh failed');
    });
  }, [clientFetchScope, search]);

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
    const scopeAtRequest = clientFetchScope;
    const searchGenerationAtRequest = searchGeneration.current;
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

      // Scope changed or a new search started while this page was in flight: the page belongs
      // to the previous result set and must not be appended.
      if (clientFetchScopeRef.current !== scopeAtRequest || searchGeneration.current !== searchGenerationAtRequest) {
        return;
      }

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
  }, [hasMore, loadingMore, loading, currentPage, pageSize, siteCode, locale, sessionCurrency, clientFetchScope]);

  const getSuggestions = useCallback(
    async (query: string, locale?: string): Promise<void> => {
      const generation = ++suggestionsGeneration.current;
      const scopeAtRequest = clientFetchScope;
      // Superseded by a newer suggestions request, or the products-mode / customer scope changed
      // while in flight: the payload belongs to the previous scope and must not be shown.
      const isStale = () =>
        generation !== suggestionsGeneration.current || clientFetchScopeRef.current !== scopeAtRequest;

      setLoading(true);
      if (!query?.trim()) {
        setSuggestions(EMPTY_SUGGESTIONS);
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

        if (isStale()) {
          return;
        }
        // Set suggestions directly from API response
        setSuggestions(data);
      } catch (err) {
        getLogger().error({ err, query }, 'Error fetching suggestions');
      } finally {
        // The newest suggestions request owns `loading`; a superseded one must not clear it early.
        if (generation === suggestionsGeneration.current) {
          setLoading(false);
        }
      }
    },
    [siteCode, sessionCurrency, clientFetchScope],
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
