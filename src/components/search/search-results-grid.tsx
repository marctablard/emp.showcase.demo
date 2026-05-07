'use client';

import { SearchProductTileGrid } from '@/components/search/search-product-tile-grid';
import type { Product } from '@/platform/services/model/product';

interface SearchResultsGridProps {
  products: Product[];
  locale: string;
  currentPage: number;
  pageSize: number;
  total: number;
  loading: boolean;
}

export function SearchResultsGrid({
  products,
  locale,
  currentPage: _currentPage,
  pageSize,
  total,
  loading,
}: SearchResultsGridProps) {
  return (
    <SearchProductTileGrid products={products} locale={locale} pageSize={pageSize} total={total} loading={loading} />
  );
}
