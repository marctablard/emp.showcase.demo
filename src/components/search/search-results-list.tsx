'use client';

import { PlpListLayout } from '@/components/search/list-view/plp-list-layout';
import { resolveSelectedCategoryIdFromFilters } from '@/lib/search/category-selection';
import type { Category } from '@/platform/services/model/category';
import type { BatteryIncludedFacet, SearchFilterValue, SearchSortOption } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';

interface SearchResultsListProps {
  products: Product[];
  locale: string;
  currentPage: number;
  pageSize: number;
  total: number;
  loading: boolean;
  pendingCursor?: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void | Promise<void>;
  activeFilters?: Record<string, SearchFilterValue>;
  availableSorts?: SearchSortOption[];
  batteryIncludedFacets?: BatteryIncludedFacet[];
  currentSort?: string;
  applyFacet: (facetId: string, value: string | string[]) => void;
  applyRangeFacet: (facetId: string, min: string, max: string) => void;
  changeSort: (sort?: string) => void;
  resetFacet: (facetId: string) => void;
  resetAllFacets?: () => void;
  categoryFilterLabelsById?: Record<string, string>;
  searchQuery?: string;
  /**
   * Site-scoped navigation root categories rendered in the PLP thumbnail carousel and left-column
   * tree. Optional so legacy call sites that do not plumb the forest keep rendering a slim layout.
   */
  navigationRoots?: Category[];
  topControlsNode?: React.ReactNode;
}

export function SearchResultsList({
  products,
  locale,
  currentPage: _currentPage,
  pageSize,
  total,
  loading,
  pendingCursor,
  hasMore,
  loadingMore,
  loadMore,
  activeFilters,
  availableSorts,
  batteryIncludedFacets,
  currentSort,
  applyFacet,
  applyRangeFacet,
  changeSort,
  resetFacet,
  resetAllFacets,
  categoryFilterLabelsById,
  navigationRoots,
  topControlsNode,
  searchQuery,
}: SearchResultsListProps) {
  const rootCategories = navigationRoots ?? [];
  const selectedCategoryId = resolveSelectedCategoryIdFromFilters(activeFilters ?? {}, rootCategories);

  return (
    <PlpListLayout
      products={products}
      locale={locale}
      pageSize={pageSize}
      total={total}
      loading={loading}
      pendingCursor={pendingCursor}
      navigationRoots={rootCategories}
      selectedCategoryId={selectedCategoryId}
      hasMore={hasMore}
      loadingMore={loadingMore}
      loadMore={loadMore}
      availableSorts={availableSorts}
      batteryIncludedFacets={batteryIncludedFacets}
      activeFilters={activeFilters ?? {}}
      currentSort={currentSort}
      applyFacet={applyFacet}
      applyRangeFacet={applyRangeFacet}
      changeSort={changeSort}
      resetFacet={resetFacet}
      resetAllFacets={resetAllFacets}
      categoryFilterLabelsById={categoryFilterLabelsById}
      topControlsNode={topControlsNode}
      searchQuery={searchQuery}
    />
  );
}
