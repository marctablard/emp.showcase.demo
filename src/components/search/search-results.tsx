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
import type { SearchFilters, SearchParams, SearchResult } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import {
  browseSearchStateSignature,
  extractFiltersFromSearchParams,
  isBrowseUrlSearchParamKey,
  urlSearchParamsToNextRecord,
} from '@/utils/filterUtils';

type SearchResultsLayout = 'list' | 'grid';

type LegacySearchFilters = Record<string, string | string[] | Record<string, string>>;

function toLegacySearchFilters(filters: SearchFilters | undefined): LegacySearchFilters {
  if (!filters) {
    return {};
  }

  const normalizedFilters: LegacySearchFilters = {};

  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'string' || Array.isArray(value)) {
      normalizedFilters[key] = value;
      continue;
    }

    if (Object.values(value).every((nestedValue) => typeof nestedValue === 'string')) {
      normalizedFilters[key] = value as Record<string, string>;
    }
  }

  return normalizedFilters;
}

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
    currentPage,
    pageSize,
    currentQuery,
    currentSort,
    search,
    loadMore,
    applyFacet,
    applyRangeFacet,
    applyAllFacets,
    resetFacet,
    resetAllFacets,
    activeFilters,
    syncBrowseSearchStateFromUrl,
    error: searchError,
  } = useSearch<Product>(initialSearch, initialResults);

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
  const currentActiveFilters: SearchFilters = activeFilters;
  const legacyActiveFilters = toLegacySearchFilters(currentActiveFilters);

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
    filters: Object.keys(currentActiveFilters).length > 0 ? currentActiveFilters : undefined,
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
  const selectedCategoryId = resolveSelectedCategoryIdFromFilters(legacyActiveFilters, rootCategories);
  const plpCategoryContext = navigationRoots
    ? resolvePlpCategoryContext(navigationRoots, selectedCategoryId)
    : undefined;

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
    activeFilters: legacyActiveFilters,
    resetFacet,
    resetAllFacets,
    resetLabel: t('resetFilter'),
    categoryFilterLabelsById: navigationLabelIndex,
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
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:justify-between">
        {/* Mobile: Use MobileCategoryDrawer if PLP context exists (as a subset), otherwise generic SearchFilter */}
        <div className="flex w-full flex-col items-stretch gap-[40px] sm:hidden">
          {plpCategoryContext ? (
            <MobileCategoryDrawer plpCategoryContext={plpCategoryContext} locale={locale} total={total} />
          ) : (
            <div className="flex w-full flex-col items-stretch [&>*]:w-full">
              <SearchFilter {...searchFilterProps} />
            </div>
          )}
          <div className="flex w-full flex-col items-stretch [&>*]:w-full">
            <SearchSort />
          </div>
        </div>

        {/* Desktop: SearchFilter + Active filters inline */}
        <div className="hidden flex-wrap items-center gap-4 sm:flex">
          <SearchFilter {...searchFilterProps} />
          <SearchActiveFiltersWithReset {...activeFiltersProps} />
        </div>

        <SearchLayoutToggle active={layout} onSelectLayout={() => undefined} />
      </div>

      {/* Mobile: Active filters below, full width */}
      <div className="mt-4 flex flex-col flex-wrap gap-4 sm:hidden">
        <SearchActiveFiltersWithReset {...activeFiltersProps} />
      </div>
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
            activeFilters={legacyActiveFilters}
            navigationRoots={navigationRoots}
            topControlsNode={topControlsNode}
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
