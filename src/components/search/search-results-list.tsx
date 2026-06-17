'use client';

import { PlpListLayout } from '@/components/search/list-view/plp-list-layout';
import { resolveSelectedCategoryIdFromFilters } from '@/lib/search/category-selection';
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
  activeFilters?: Record<string, string | string[] | Record<string, string>>;
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
  hasMore,
  loadingMore,
  loadMore,
  activeFilters,
  navigationRoots,
  topControlsNode,
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
      navigationRoots={rootCategories}
      selectedCategoryId={selectedCategoryId}
      hasMore={hasMore}
      loadingMore={loadingMore}
      loadMore={loadMore}
      topControlsNode={topControlsNode}
    />
  );
}
