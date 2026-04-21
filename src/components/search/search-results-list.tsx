'use client';

import { PlpListLayout } from '@/components/search/list-view/plp-list-layout';
import { parseCategoryIdsFilterValue } from '@/lib/search/parse-category-ids-filter';
import type { Category } from '@/platform/services/model/category';
import type { Product } from '@/platform/services/model/product';

interface SearchResultsListProps {
  products: Product[];
  locale: string;
  currentPage: number;
  pageSize: number;
  total: number;
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void | Promise<void>;
  /** Active `filters[categoryIds]` from `useSearch`, used to highlight the selected tree node. */
  activeCategoryIdsFilter?: string | string[] | Record<string, string>;
  /**
   * Site-scoped navigation root categories rendered in the PLP thumbnail carousel and left-column
   * tree. Optional so legacy call sites that do not plumb the forest keep rendering a slim layout.
   */
  navigationRoots?: Category[];
}

export function SearchResultsList({
  products,
  locale,
  currentPage: _currentPage,
  pageSize,
  total,
  loading,
  hasMore,
  loadingMore,
  loadMore,
  activeCategoryIdsFilter,
  navigationRoots,
}: SearchResultsListProps) {
  const rootCategories = navigationRoots ?? [];
  const selectedCategoryId = parseCategoryIdsFilterValue(activeCategoryIdsFilter)[0];

  return (
    <PlpListLayout
      products={products}
      locale={locale}
      pageSize={pageSize}
      total={total}
      loading={loading}
      navigationRoots={rootCategories}
      selectedCategoryId={selectedCategoryId}
      hasMore={hasMore}
      loadingMore={loadingMore}
      loadMore={loadMore}
    />
  );
}
