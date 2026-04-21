'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useCategoryDisplayLabelIndex } from '@/components/navigation/category-display-label-index-context';
import { SearchActiveFiltersWithReset } from '@/components/search/search-active-filters-with-reset';
import { SearchFilter } from '@/components/search/search-filter';
import { SearchLayoutToggle } from '@/components/search/search-layout-toggle';
import { SearchResultsGrid } from '@/components/search/search-results-grid';
import { SearchResultsList } from '@/components/search/search-results-list';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { USE_SEARCH_CLIENT_ERROR, useSearch } from '@/hooks/search/useSearch';
import { parseCategoryIdsFilterValue } from '@/lib/search/parse-category-ids-filter';
import type { Category } from '@/platform/services/model/category';
import type { SearchParams, SearchResult } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import {
  browseSearchStateSignature,
  extractFiltersFromSearchParams,
  isBrowseUrlSearchParamKey,
  urlSearchParamsToNextRecord,
} from '@/utils/filterUtils';

interface SearchClientWrapperProps {
  initialSearch?: SearchParams<Product>;
  initialResults?: SearchResult<Product>;
  locale: string;
  /**
   * Site-scoped navigation category forest (from `getCachedNavigationCategoryTrees`). Feeds the
   * list-view thumbnail carousel and later the expandable category tree.
   */
  navigationRoots?: Category[];
}

/** Matches `createBrowseInitialSearch` default when `size` is omitted from the URL. */
const BROWSE_DEFAULT_PAGE_SIZE = 12;

export function SearchResultsComponent({
  initialSearch,
  initialResults,
  locale,
  navigationRoots,
}: SearchClientWrapperProps) {
  const t = useTranslations('search.searchResults');
  const tSearch = useTranslations('search');
  const searchParams = useSearchParams();
  const navigationLabelIndex = useCategoryDisplayLabelIndex();
  const [layout, setLayout] = useState<'list' | 'grid'>('grid');
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

  const categoryFilterLabelsById = useMemo(() => {
    const ids = parseCategoryIdsFilterValue(activeFilters.categoryIds);
    const out: Record<string, string> = {};
    for (const id of ids) {
      const label = navigationLabelIndex[id]?.trim();
      out[id] = label && label.length > 0 ? label : id;
    }
    return out;
  }, [navigationLabelIndex, activeFilters.categoryIds]);

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
    categoryFilterLabelsById,
  };
  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    const isApiOnlyBrowseParam = (key: string) => key === 'site' || key === 'locale';
    const meaningfulKeys = Array.from(searchParams.keys()).filter((k) => !isApiOnlyBrowseParam(k));
    const hasSearchParams = meaningfulKeys.some(isBrowseUrlSearchParamKey);
    // Ignore tracking params etc.; still run when URL only had site/locale (legacy bad URLs from old client sync).
    if (!hasSearchParams && meaningfulKeys.length > 0) {
      return;
    }

    const raw = urlSearchParamsToNextRecord(searchParams);
    const filtersRecord = extractFiltersFromSearchParams(raw) as Record<string, unknown>;

    const qVal = raw.q;
    const query = (Array.isArray(qVal) ? qVal[0] : qVal) ?? '';
    const pageRaw = raw.page;
    const page = pageRaw !== undefined ? parseInt(Array.isArray(pageRaw) ? pageRaw[0] : pageRaw, 10) : 0;
    const sizeRaw = raw.size;
    const defaultSize = initialSearch?.size ?? BROWSE_DEFAULT_PAGE_SIZE;
    const parsedSize =
      sizeRaw !== undefined ? parseInt(Array.isArray(sizeRaw) ? sizeRaw[0] : sizeRaw, 10) : defaultSize;
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

    const initSig = browseSearchStateSignature({
      query: initialSearch?.query ?? '',
      page: initialSearch?.page ?? 0,
      size: initialSearch?.size ?? BROWSE_DEFAULT_PAGE_SIZE,
      sort: initialSearch?.sort,
      filters: initialSearch?.filters as Record<string, unknown> | undefined,
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
      filters:
        Object.keys(filtersRecord).length > 0
          ? (filtersRecord as Record<string, string | string[] | Record<string, string>>)
          : undefined,
    });
    // Depend on searchParamsKey so we do not re-run when ReadonlyURLSearchParams identity changes without query updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams is read from the latest render whenever searchParamsKey changes
  }, [searchParamsKey, search, initialResults, initialSearch, syncBrowseSearchStateFromUrl]);

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
      {/* Top controls */}
      <div className="w-full">
        {/* Row: SearchFilter + Layout toggle inline on mobile; desktop keeps toggle on the right */}
        <div className="flex w-full justify-between gap-4">
          {/* Mobile: SearchFilter only */}
          <div className="flex sm:hidden">
            <SearchFilter {...searchFilterProps} />
          </div>

          {/* Desktop: SearchFilter + Active filters inline */}
          <div className="hidden flex-wrap items-center gap-4 sm:flex">
            <SearchFilter {...searchFilterProps} />
            <SearchActiveFiltersWithReset {...activeFiltersProps} />
          </div>

          <SearchLayoutToggle active={layout} onSelectLayout={(selectedLayout) => setLayout(selectedLayout)} />
        </div>

        {/* Mobile: Active filters below, full width */}
        <div className="mt-4 flex flex-col flex-wrap gap-4 sm:hidden">
          <SearchActiveFiltersWithReset {...activeFiltersProps} />
        </div>
      </div>

      {/* Product List/Grid */}
      <div className="mt-6 w-full">
        {layout === 'list' && (
          <SearchResultsList
            products={products}
            locale={locale}
            currentPage={currentPage}
            pageSize={pageSize}
            total={total}
            loading={loading}
            navigationRoots={navigationRoots}
          />
        )}

        {layout === 'grid' && (
          <SearchResultsGrid
            products={products}
            locale={locale}
            currentPage={currentPage}
            pageSize={pageSize}
            total={total}
            loading={loading}
          />
        )}

        {layout === 'grid' && hasMore && (
          <div className="mt-8 flex justify-center">
            <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? t('loadingMore') : t('loadMore')}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
