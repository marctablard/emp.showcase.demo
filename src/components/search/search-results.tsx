'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useCategoryDisplayLabelIndex } from '@/components/navigation/category-display-label-index-context';
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
import type { SearchParams, SearchResult } from '@/platform/services/model/common';
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

export function SearchResultsComponent({
  initialSearch,
  initialResults,
  initialLayout,
  locale,
  navigationRoots,
  headingNode,
}: SearchClientWrapperProps) {
  const t = useTranslations('search.searchResults');
  const tSearch = useTranslations('search');
  const searchParams = useSearchParams();
  const navigationLabelIndex = useCategoryDisplayLabelIndex();
  const layout = initialLayout;
  // Initialize the search hook with Product type and initial results
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
    currentQuery,
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
  } = useSearch<Product>(initialSearch, initialResults);

  // Keep the last non-empty facet set so the filter panel does not collapse while a new search
  // is in flight. This drives render output, so it is state (adjusted during render) rather than
  // a ref — see https://react.dev/reference/react/useState#storing-information-from-previous-renders
  //
  // `useSearch` hands back a fresh array on every render, so the retained copy is keyed by facet
  // ids instead of array identity; comparing identity here would re-set state on every render and
  // never converge. The retained set is only ever a fallback for when facets are momentarily
  // empty, so not refreshing it on count-only changes is fine.
  const hasFacets = !!batteryIncludedFacets && batteryIncludedFacets.length > 0;
  const facetsKey = hasFacets ? batteryIncludedFacets.map((facet) => facet.id).join('|') : '';
  const [retainedFacets, setRetainedFacets] = useState({ key: facetsKey, facets: batteryIncludedFacets ?? [] });
  if (hasFacets && retainedFacets.key !== facetsKey) {
    setRetainedFacets({ key: facetsKey, facets: batteryIncludedFacets });
  }
  const baseFacets = hasFacets ? batteryIncludedFacets : retainedFacets.facets;

  const displayFacets = mergeActiveFilterFacetOptions(baseFacets, activeFilters);
  const appliedFilterCount = getAppliedFilterCount(activeFilters);

  const searchParamsKey = searchParams.toString();

  const isApiOnlyBrowseParam = (key: string) => key === 'site' || key === 'locale' || key === 'currency';
  const meaningfulKeys = Array.from(searchParams.keys()).filter((k) => !isApiOnlyBrowseParam(k));
  const hasBrowseSearchParams = meaningfulKeys.some(isBrowseUrlSearchParamKey);
  const raw = urlSearchParamsToNextRecord(searchParams);
  const filtersRecord = extractFiltersFromSearchParams(raw);

  const qVal = raw.q;
  const query = (Array.isArray(qVal) ? qVal[0] : qVal) ?? '';
  const pageRaw = raw.page;
  const page = pageRaw !== undefined ? parseInt(Array.isArray(pageRaw) ? pageRaw[0] : pageRaw, 10) : 0;
  const sizeRaw = raw.size;
  const defaultSize = initialSearch?.size ?? BROWSE_DEFAULT_PAGE_SIZE;
  const parsedSize = sizeRaw !== undefined ? parseInt(Array.isArray(sizeRaw) ? sizeRaw[0] : sizeRaw, 10) : defaultSize;
  const size = Number.isFinite(parsedSize) ? parsedSize : defaultSize;
  const sortRaw = raw.sort;
  const sort = sortRaw !== undefined ? (Array.isArray(sortRaw) ? sortRaw[0] : sortRaw) : undefined;
  const urlSig = browseSearchStateSignature({
    query,
    page: Number.isFinite(page) ? page : 0,
    size,
    sort,
    filters: Object.keys(filtersRecord).length > 0 ? filtersRecord : undefined,
  });
  const currentSearchSig = browseSearchStateSignature({
    query: currentQuery ?? '',
    page: currentPage,
    size: pageSize,
    sort: currentSort,
    filters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
  });

  // `pendingCursor` is render output (it is passed down to the result list), so the signature it
  // derives from is state, not a ref. The params key is kept in the same state object so both
  // advance together in a single render pass.
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

  const pendingCursor = !loading && pendingUrlSig === urlSig;

  useLayoutEffect(() => {
    if (currentSearchSig !== urlSig) {
      return;
    }

    releaseNavigationWaitCursorLease({ targetSignature: urlSig });
  }, [currentSearchSig, urlSig]);

  const rootCategories = navigationRoots ?? [];
  const selectedCategoryId = resolveSelectedCategoryIdFromFilters(activeFilters ?? {}, rootCategories);
  const plpCategoryContext = navigationRoots
    ? resolvePlpCategoryContext(navigationRoots, selectedCategoryId)
    : undefined;
  const showDesktopSearchFilter = !plpCategoryContext || layout !== 'list';
  const showStandaloneActiveFilters = !plpCategoryContext || layout !== 'list';

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

  useEffect(() => {
    const hasSearchParams = meaningfulKeys.some(isBrowseUrlSearchParamKey);
    // Ignore tracking params etc.; still run when URL only had site/locale (legacy bad URLs from old client sync).
    if (!hasSearchParams && meaningfulKeys.length > 0) {
      return;
    }

    const initSig = browseSearchStateSignature({
      query: initialSearch?.query ?? '',
      page: initialSearch?.page ?? 0,
      size: initialSearch?.size ?? BROWSE_DEFAULT_PAGE_SIZE,
      sort: initialSearch?.sort,
      filters: initialSearch?.filters,
    });

    // Avoid duplicate /api/search whenever the URL still matches SSR criteria (including total === 0).
    // Previously we only skipped on the first effect run; `useSearchParams()` can re-subscribe and re-run
    // this effect without the query string changing, which caused many redundant fetches on /browse.
    if (initialResults !== undefined && urlSig === initSig) {
      syncBrowseSearchStateFromUrl({
        query,
        page: Number.isFinite(page) ? page : 0,
        size,
        sort,
        filtersRecord,
      });
      return;
    }

    if (initialResults !== undefined && urlSig === currentSearchSig) {
      return;
    }

    search({
      query,
      page: Number.isFinite(page) ? page : 0,
      size,
      sort,
      filters: Object.keys(filtersRecord).length > 0 ? filtersRecord : undefined,
    });
    // Depend on searchParamsKey so we do not re-run when ReadonlyURLSearchParams identity changes without query updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams is read from the latest render whenever searchParamsKey changes
  }, [searchParamsKey, search, initialResults, initialSearch, syncBrowseSearchStateFromUrl]);

  // When the desktop filter row would have no content (PLP list view), hide the whole
  // wrapper above 1024px so it does not produce an empty flex item with a gap.
  const hideTopControlsOnDesktop = !showDesktopSearchFilter && !showStandaloneActiveFilters;

  const topControlsNode = (
    <div className={cn('w-full', hideTopControlsOnDesktop && 'min-[1024px]:hidden')}>
      {/* Row: SearchFilter controls on mobile and desktop. */}
      {/* Search Layout Top Bar */}
      <div className="flex w-full flex-col gap-4 lg:justify-between">
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

  return (
    <>
      {searchError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            {searchError === USE_SEARCH_CLIENT_ERROR.MISSING_SITE
              ? tSearch('errors.missingSite')
              : tSearch('errors.generic')}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Main product view area takes the full width and handles its own layout, receiving topControls */}
      <div className="w-full">
        {layout === 'list' && (
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
        )}

        {layout === 'grid' && (
          <div className="flex flex-col gap-6">
            {headingNode}
            {topControlsNode}
            <SearchResultsGrid
              products={products}
              locale={locale}
              currentPage={currentPage}
              pageSize={pageSize}
              total={total}
              loading={loading}
              pendingCursor={pendingCursor}
            />
            {hasMore ? (
              <div className="flex justify-center mt-8">
                <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? t('loadingMore') : t('loadMore')}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
