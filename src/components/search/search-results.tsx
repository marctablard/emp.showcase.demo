'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useCategoryDisplayLabelIndex } from '@/components/navigation/category-display-label-index-context';
import { PlpProductsModeSwitch } from '@/components/search/list-view/plp-products-mode-switch';
import { MobileCategoryDrawer } from '@/components/search/mobile-category-drawer';
import { SearchActiveFiltersWithReset } from '@/components/search/search-active-filters-with-reset';
import { SearchFilter } from '@/components/search/search-filter';
import { SearchLayoutToggle } from '@/components/search/search-layout-toggle';
import { SearchResultsGrid } from '@/components/search/search-results-grid';
import { SearchResultsList } from '@/components/search/search-results-list';
import { SearchSort } from '@/components/search/search-sort';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { releaseNavigationWaitCursorLease } from '@/hooks/common/useGlobalCursor';
import { USE_SEARCH_CLIENT_ERROR, useSearch } from '@/hooks/search/useSearch';
import { resolvePlpCategoryContext } from '@/lib/category/plp-category-context';
import { resolveSelectedCategoryIdFromFilters } from '@/lib/search/category-selection';
import { getAppliedFilterCount } from '@/lib/search/get-applied-filter-count';
import { cn } from '@/lib/utils';
import type { Category } from '@/platform/services/model/category';
import type { BatteryIncludedFacet, SearchParams, SearchResult } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import {
  browseSearchStateSignature,
  extractFiltersFromSearchParams,
  isBrowseUrlSearchParamKey,
  urlSearchParamsToNextRecord,
} from '@/utils/filterUtils';
import { mergeActiveFilterFacetOptions } from './util/merge-active-filter-facet-options';

type SearchResultsLayout = 'list' | 'grid';

interface SearchClientWrapperProps {
  initialSearch?: SearchParams<Product>;
  initialResults?: SearchResult<Product>;
  initialLayout: SearchResultsLayout;
  locale: string;
  /**
   * Site-scoped navigation category forest (from `getCachedNavigationCategoryTrees`). Feeds the
   * list-view thumbnail carousel and later the expandable category tree.
   */
  navigationRoots?: Category[];
  headingNode?: React.ReactNode;
}

/** Matches `createBrowseInitialSearch` default when `size` is omitted from the URL. */
const BROWSE_DEFAULT_PAGE_SIZE = 12;

/**
 * Keeps the last non-empty facet set so the filter panel does not collapse while a new search is
 * in flight.
 *
 * This drives render output, so it is state adjusted during render rather than a ref — see
 * https://react.dev/reference/react/useState#storing-information-from-previous-renders
 *
 * `useSearch` hands back a fresh array on every render, so the retained copy is keyed by facet ids
 * instead of array identity; comparing identity here would re-set state on every render and never
 * converge. The retained set is only ever the fallback for when facets are momentarily empty, so
 * not refreshing it on count-only changes is fine.
 */
function useRetainedFacets(batteryIncludedFacets: BatteryIncludedFacet[] | undefined): BatteryIncludedFacet[] {
  const hasFacets = !!batteryIncludedFacets && batteryIncludedFacets.length > 0;
  const facetsKey = hasFacets ? batteryIncludedFacets.map((facet) => facet.id).join('|') : '';
  const [retained, setRetained] = useState({ key: facetsKey, facets: batteryIncludedFacets ?? [] });

  if (hasFacets && retained.key !== facetsKey) {
    setRetained({ key: facetsKey, facets: batteryIncludedFacets });
  }

  return hasFacets ? batteryIncludedFacets : retained.facets;
}

/**
 * Tracks whether the URL has moved ahead of the search hook's committed state, which is what the
 * result list renders its wait cursor from.
 *
 * The signature is state rather than a ref because it is render output. The params key lives in
 * the same state object so both advance together in a single render pass.
 */
function usePendingCursor({
  searchParamsKey,
  hasBrowseSearchParams,
  loading,
  urlSig,
  currentSearchSig,
}: {
  searchParamsKey: string;
  hasBrowseSearchParams: boolean;
  loading: boolean;
  urlSig: string;
  currentSearchSig: string;
}): boolean {
  const [cursorState, setCursorState] = useState<{ paramsKey: string; pendingUrlSig: string | null }>({
    paramsKey: searchParamsKey,
    pendingUrlSig: null,
  });
  const searchParamsChanged = cursorState.paramsKey !== searchParamsKey;

  let pendingUrlSig = cursorState.pendingUrlSig;
  if (pendingUrlSig !== null && (!hasBrowseSearchParams || currentSearchSig === pendingUrlSig)) {
    pendingUrlSig = null;
  }
  if (searchParamsChanged && hasBrowseSearchParams && !loading && urlSig !== currentSearchSig) {
    pendingUrlSig = urlSig;
  }
  if (searchParamsChanged || pendingUrlSig !== cursorState.pendingUrlSig) {
    setCursorState({ paramsKey: searchParamsKey, pendingUrlSig });
  }

  return !loading && pendingUrlSig === urlSig;
}

type BrowseFilters = ReturnType<typeof extractFiltersFromSearchParams>;

interface BrowseUrlState {
  /** URL keys that are neither `site`, `locale` nor `currency` (API-only context). */
  meaningfulKeys: string[];
  hasBrowseSearchParams: boolean;
  filtersRecord: BrowseFilters;
  /** `filtersRecord` or `undefined` when empty — the shape `search()` expects. */
  filters: BrowseFilters | undefined;
  query: string;
  page: number;
  size: number;
  sort: string | undefined;
  urlSig: string;
}

function isApiOnlyBrowseParam(key: string): boolean {
  return key === 'site' || key === 'locale' || key === 'currency';
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseIntegerOr(raw: string | undefined, fallback: number): number {
  const parsed = raw === undefined ? fallback : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Reads the browse search state (query, paging, sort, filters) and its signature from the URL. */
function parseBrowseUrlState(searchParams: URLSearchParams, defaultSize: number): BrowseUrlState {
  const meaningfulKeys = Array.from(searchParams.keys()).filter((key) => !isApiOnlyBrowseParam(key));
  const raw = urlSearchParamsToNextRecord(searchParams);
  const filtersRecord = extractFiltersFromSearchParams(raw);
  const filters = Object.keys(filtersRecord).length > 0 ? filtersRecord : undefined;
  const query = firstValue(raw.q) ?? '';
  const page = parseIntegerOr(firstValue(raw.page), 0);
  const size = parseIntegerOr(firstValue(raw.size), defaultSize);
  const sort = firstValue(raw.sort);

  return {
    meaningfulKeys,
    hasBrowseSearchParams: meaningfulKeys.some(isBrowseUrlSearchParamKey),
    filtersRecord,
    filters,
    query,
    page,
    size,
    sort,
    urlSig: browseSearchStateSignature({ query, page, size, sort, filters }),
  };
}

type SearchState = ReturnType<typeof useSearch<Product>>;

function buildCurrentSearchSignature(state: SearchState): string {
  return browseSearchStateSignature({
    query: state.currentQuery ?? '',
    page: state.currentPage,
    size: state.pageSize,
    sort: state.currentSort,
    filters: Object.keys(state.activeFilters).length > 0 ? state.activeFilters : undefined,
  });
}

function buildInitialSearchSignature(initialSearch: SearchParams<Product> | undefined): string {
  return browseSearchStateSignature({
    query: initialSearch?.query ?? '',
    page: initialSearch?.page ?? 0,
    size: initialSearch?.size ?? BROWSE_DEFAULT_PAGE_SIZE,
    sort: initialSearch?.sort,
    filters: initialSearch?.filters,
  });
}

interface UseBrowseUrlSyncInput {
  searchParamsKey: string;
  urlState: BrowseUrlState;
  currentSearchSig: string;
  initialSearch: SearchParams<Product> | undefined;
  initialResults: SearchResult<Product> | undefined;
  search: SearchState['search'];
  syncBrowseSearchStateFromUrl: SearchState['syncBrowseSearchStateFromUrl'];
}

/**
 * Keeps the search hook in step with the browse URL: releases the navigation wait cursor once the
 * hook state matches the URL, and on URL changes either adopts the SSR state, skips a duplicate
 * request, or runs the client search.
 */
function useBrowseUrlSync({
  searchParamsKey,
  urlState,
  currentSearchSig,
  initialSearch,
  initialResults,
  search,
  syncBrowseSearchStateFromUrl,
}: UseBrowseUrlSyncInput): void {
  const { meaningfulKeys, filtersRecord, filters, query, page, size, sort, urlSig } = urlState;

  useLayoutEffect(() => {
    if (currentSearchSig !== urlSig) {
      return;
    }

    releaseNavigationWaitCursorLease({ targetSignature: urlSig });
  }, [currentSearchSig, urlSig]);

  useEffect(() => {
    const hasSearchParams = meaningfulKeys.some(isBrowseUrlSearchParamKey);
    // Ignore tracking params etc.; still run when URL only had site/locale (legacy bad URLs from old client sync).
    if (!hasSearchParams && meaningfulKeys.length > 0) {
      return;
    }

    // Avoid duplicate /api/search whenever the URL still matches SSR criteria (including total === 0).
    // Previously we only skipped on the first effect run; `useSearchParams()` can re-subscribe and re-run
    // this effect without the query string changing, which caused many redundant fetches on /browse.
    if (initialResults !== undefined && urlSig === buildInitialSearchSignature(initialSearch)) {
      syncBrowseSearchStateFromUrl({ query, page, size, sort, filtersRecord });
      return;
    }

    if (initialResults !== undefined && urlSig === currentSearchSig) {
      return;
    }

    // SSR-off / failed SSR: the skips above do not apply. This search() is the first client fetch of
    // this hook instance. search() joins in-flight and skips a just-completed same key — do not add a
    // "run only once" ref (that missed later URL changes).
    search({ query, page, size, sort, filters });
    // Depend on searchParamsKey so we do not re-run when ReadonlyURLSearchParams identity changes without query updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams is read from the latest render whenever searchParamsKey changes
  }, [searchParamsKey, search, initialResults, initialSearch, syncBrowseSearchStateFromUrl]);
}

function SearchErrorAlert({ error }: Readonly<{ error: SearchState['error'] }>) {
  const tSearch = useTranslations('search');

  if (!error) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertDescription>
        {error === USE_SEARCH_CLIENT_ERROR.MISSING_SITE ? tSearch('errors.missingSite') : tSearch('errors.generic')}
      </AlertDescription>
    </Alert>
  );
}

interface SearchTopControlsProps {
  layout: SearchResultsLayout;
  /** When the desktop filter row would have no content (PLP list view), hide the whole wrapper above 1024px. */
  hideOnDesktop: boolean;
  showDesktopSearchFilter: boolean;
  showStandaloneActiveFilters: boolean;
  plpCategoryContext: ReturnType<typeof resolvePlpCategoryContext> | undefined;
  locale: string;
  total: number;
  plpFacetPanelProps: Omit<
    React.ComponentProps<typeof MobileCategoryDrawer>,
    'plpCategoryContext' | 'locale' | 'total' | 'navigationRoots' | 'selectedCategoryId'
  >;
  searchFilterProps: React.ComponentProps<typeof SearchFilter>;
  searchSortProps: React.ComponentProps<typeof SearchSort>;
  activeFiltersProps: React.ComponentProps<typeof SearchActiveFiltersWithReset> & { resetLabel: string };
}

/** Filter / sort / active-filter toolbar shared by the list and grid layouts. */
function SearchTopControls({
  layout,
  hideOnDesktop,
  showDesktopSearchFilter,
  showStandaloneActiveFilters,
  plpCategoryContext,
  locale,
  total,
  plpFacetPanelProps,
  searchFilterProps,
  searchSortProps,
  activeFiltersProps,
}: Readonly<SearchTopControlsProps>) {
  return (
    <div className={cn('w-full', hideOnDesktop && 'min-[1024px]:hidden')}>
      {/* Row: SearchFilter controls on mobile and desktop. */}
      {/* Search Layout Top Bar */}
      <div className="flex w-full flex-col gap-4 lg:justify-between">
        {/* COP-4822 CR-1: the grid layout has no category tree card, so the ASSIGNED / ALL switch gets its own row
            above the Filter + Sort toolbar (single mount for every breakpoint). The list layout mounts it in the
            "Categories" card header and the mobile category drawer instead. */}
        {layout === 'grid' ? <PlpProductsModeSwitch /> : null}

        {/* Mobile / Tablet Filter + Sort */}
        <div className="flex w-full items-center gap-3 min-[1024px]:hidden">
          {plpCategoryContext ? (
            <div className="shrink-0">
              <MobileCategoryDrawer
                plpCategoryContext={plpCategoryContext}
                locale={locale}
                total={total}
                {...plpFacetPanelProps}
              />
            </div>
          ) : (
            <div className="shrink-0">
              <SearchFilter {...searchFilterProps} />
            </div>
          )}

          <div className="w-[261px] shrink-0">
            <SearchSort {...searchSortProps} />
          </div>
        </div>

        {/* Desktop Filter + Active Filters */}
        <div className="hidden flex-wrap items-center gap-2 min-[1024px]:flex">
          {showDesktopSearchFilter ? <SearchFilter {...searchFilterProps} /> : null}
          {showStandaloneActiveFilters ? <SearchActiveFiltersWithReset {...activeFiltersProps} /> : null}
          {showDesktopSearchFilter ? <SearchSort {...searchSortProps} /> : null}
        </div>

        <SearchLayoutToggle active={layout} onSelectLayout={() => undefined} />
      </div>

      {/* Mobile / Tablet: Active filters below, full width */}
      {showStandaloneActiveFilters ? (
        <div className="mt-4 flex flex-col flex-wrap gap-2 min-[1024px]:hidden">
          <SearchActiveFiltersWithReset {...activeFiltersProps} />
        </div>
      ) : null}
    </div>
  );
}

interface SearchResultsGridLayoutProps extends React.ComponentProps<typeof SearchResultsGrid> {
  headingNode: React.ReactNode;
  topControlsNode: React.ReactNode;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void | Promise<void>;
}

/** Grid layout: heading, toolbar, product grid and the "load more" button. */
function SearchResultsGridLayout({
  headingNode,
  topControlsNode,
  hasMore,
  loadingMore,
  loadMore,
  ...gridProps
}: Readonly<SearchResultsGridLayoutProps>) {
  const t = useTranslations('search.searchResults');

  return (
    <div className="flex flex-col gap-6">
      {headingNode}
      {topControlsNode}
      <SearchResultsGrid {...gridProps} />
      {hasMore ? (
        <div className="flex justify-center mt-8">
          <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? t('loadingMore') : t('loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function SearchResultsComponent({
  initialSearch,
  initialResults,
  initialLayout,
  locale,
  navigationRoots,
  headingNode,
}: Readonly<SearchClientWrapperProps>) {
  const t = useTranslations('search.searchResults');
  const searchParams = useSearchParams();
  const navigationLabelIndex = useCategoryDisplayLabelIndex();
  const layout = initialLayout;
  // Initialize the search hook with Product type and initial results
  const searchState = useSearch<Product>(initialSearch, initialResults, { refetchOnPricingScopeChange: true });
  const {
    data: products,
    loading,
    loadingMore,
    hasMore,
    total,
    facets: availableFilters,
    availableSorts,
    batteryIncludedFacets,
    currentPage,
    pageSize,
    currentSort,
    search,
    loadMore,
    changeSort: handleSortChange,
    applyFacet,
    applyRangeFacet,
    applyAllFacets,
    resetFacet,
    resetAllFacets,
    activeFilters,
    syncBrowseSearchStateFromUrl,
    error: searchError,
  } = searchState;

  const baseFacets = useRetainedFacets(batteryIncludedFacets);

  const displayFacets = mergeActiveFilterFacetOptions(baseFacets, activeFilters);
  const appliedFilterCount = getAppliedFilterCount(activeFilters);

  const searchParamsKey = searchParams.toString();
  const urlState = parseBrowseUrlState(searchParams, initialSearch?.size ?? BROWSE_DEFAULT_PAGE_SIZE);
  const { hasBrowseSearchParams, query, urlSig } = urlState;
  const currentSearchSig = buildCurrentSearchSignature(searchState);

  const pendingCursor = usePendingCursor({
    searchParamsKey,
    hasBrowseSearchParams,
    loading,
    urlSig,
    currentSearchSig,
  });

  useBrowseUrlSync({
    searchParamsKey,
    urlState,
    currentSearchSig,
    initialSearch,
    initialResults,
    search,
    syncBrowseSearchStateFromUrl,
  });

  const rootCategories = navigationRoots ?? [];
  const selectedCategoryId = resolveSelectedCategoryIdFromFilters(activeFilters ?? {}, rootCategories);
  const plpCategoryContext = navigationRoots
    ? resolvePlpCategoryContext(navigationRoots, selectedCategoryId)
    : undefined;
  // The PLP list view owns its own filter/sort chrome (category tree, facet panel, sort in the grid header).
  const usesPlpListChrome = plpCategoryContext !== undefined && layout === 'list';
  const showDesktopSearchFilter = !usesPlpListChrome;
  const showStandaloneActiveFilters = !usesPlpListChrome;

  const plpFacetPanelProps = {
    facets: displayFacets,
    activeFilters,
    applyFacet,
    applyRangeFacet,
    resetFacet,
    resetAllFacets,
    categoryFilterLabelsById: navigationLabelIndex,
    appliedFilterCount,
  };

  const searchSortProps = {
    availableSorts,
    currentSort,
    changeSort: handleSortChange,
  };

  // Shared props for SearchFilter component (used in both mobile and desktop layouts)
  const searchFilterProps = {
    activeFilters,
    availableFilters,
    resetFacet,
    resetAllFacets,
    applyFacet,
    applyRangeFacet,
    applyAllFacets,
    appliedFilterCount,
  };

  // Shared props for ActiveFiltersWithReset component
  const activeFiltersProps = {
    activeFilters,
    resetFacet,
    resetAllFacets,
    resetLabel: t('resetFilter'),
    categoryFilterLabelsById: navigationLabelIndex,
    batteryIncludedFacets: displayFacets,
  };

  const topControlsNode = (
    <SearchTopControls
      layout={layout}
      hideOnDesktop={usesPlpListChrome}
      showDesktopSearchFilter={showDesktopSearchFilter}
      showStandaloneActiveFilters={showStandaloneActiveFilters}
      plpCategoryContext={plpCategoryContext}
      locale={locale}
      total={total}
      plpFacetPanelProps={plpFacetPanelProps}
      searchFilterProps={searchFilterProps}
      searchSortProps={searchSortProps}
      activeFiltersProps={activeFiltersProps}
    />
  );

  return (
    <>
      <SearchErrorAlert error={searchError} />

      {/* Main product view area takes the full width and handles its own layout, receiving topControls */}
      <div className="w-full">
        {layout === 'list' ? (
          <SearchResultsList
            products={products}
            locale={locale}
            currentPage={currentPage}
            pageSize={pageSize}
            total={total}
            loading={loading}
            pendingCursor={pendingCursor}
            hasMore={hasMore}
            loadingMore={loadingMore}
            loadMore={loadMore}
            activeFilters={activeFilters}
            navigationRoots={navigationRoots}
            availableSorts={availableSorts}
            batteryIncludedFacets={displayFacets}
            currentSort={currentSort}
            applyFacet={applyFacet}
            applyRangeFacet={applyRangeFacet}
            changeSort={handleSortChange}
            resetFacet={resetFacet}
            resetAllFacets={resetAllFacets}
            categoryFilterLabelsById={navigationLabelIndex}
            topControlsNode={topControlsNode}
            searchQuery={query}
          />
        ) : (
          <SearchResultsGridLayout
            headingNode={headingNode}
            topControlsNode={topControlsNode}
            products={products}
            locale={locale}
            currentPage={currentPage}
            pageSize={pageSize}
            total={total}
            loading={loading}
            pendingCursor={pendingCursor}
            hasMore={hasMore}
            loadingMore={loadingMore}
            loadMore={loadMore}
          />
        )}
      </div>
    </>
  );
}
