'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
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
  const pendingCursorUrlSigRef = useRef<string | null>(null);
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

  const previousFacetsRef = useRef(batteryIncludedFacets);
  if (batteryIncludedFacets && batteryIncludedFacets.length > 0) {
    previousFacetsRef.current = batteryIncludedFacets;
  }
  const baseFacets =
    batteryIncludedFacets && batteryIncludedFacets.length > 0
      ? batteryIncludedFacets
      : (previousFacetsRef.current ?? []);

  const displayFacets = mergeActiveFilterFacetOptions(baseFacets, activeFilters);

  const searchParamsKey = searchParams.toString();
  const previousSearchParamsKeyRef = useRef(searchParamsKey);
  const searchParamsChanged = previousSearchParamsKeyRef.current !== searchParamsKey;

  useEffect(() => {
    previousSearchParamsKeyRef.current = searchParamsKey;
  }, [searchParamsKey]);

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

  if (
    pendingCursorUrlSigRef.current !== null &&
    (!hasBrowseSearchParams || currentSearchSig === pendingCursorUrlSigRef.current)
  ) {
    pendingCursorUrlSigRef.current = null;
  }

  if (searchParamsChanged && hasBrowseSearchParams && !loading && urlSig !== currentSearchSig) {
    pendingCursorUrlSigRef.current = urlSig;
  }

  const pendingCursor = !loading && pendingCursorUrlSigRef.current === urlSig;

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

  const topControlsNode = (
    <div className="w-full">
      {/* Row: SearchFilter controls on mobile and desktop. */}
      <div className="flex w-full flex-col gap-4 md:flex-row md:justify-between">
        {/* Mobile: Use MobileCategoryDrawer if PLP context exists (as a subset), otherwise generic SearchFilter */}
        <div className="flex w-full flex-col items-stretch gap-[40px] md:hidden">
          {plpCategoryContext ? (
            <MobileCategoryDrawer
              plpCategoryContext={plpCategoryContext}
              locale={locale}
              total={total}
              {...plpFacetPanelProps}
            />
          ) : (
            <div className="flex w-full flex-col items-stretch [&>*]:w-full">
              <SearchFilter {...searchFilterProps} />
            </div>
          )}
          <div className="flex w-full flex-col items-stretch [&>*]:w-full">
            <SearchSort {...searchSortProps} />
          </div>
        </div>

        {/* Desktop: SearchFilter + Active filters inline */}
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          {showDesktopSearchFilter ? <SearchFilter {...searchFilterProps} /> : null}
          {showStandaloneActiveFilters ? <SearchActiveFiltersWithReset {...activeFiltersProps} /> : null}
          {showDesktopSearchFilter ? <SearchSort {...searchSortProps} /> : null}
        </div>

        <SearchLayoutToggle active={layout} onSelectLayout={() => undefined} />
      </div>

      {/* Mobile: Active filters below, full width */}
      {showStandaloneActiveFilters ? (
        <div className="mt-4 flex flex-col flex-wrap gap-2 md:hidden">
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
