'use client';

import { useTranslations } from 'next-intl';
import { ProductTile } from '@/components/product/product-tile';
import { ProductTileSkeleton } from '@/components/product/product-tile-skeleton';
import { SearchNoResults } from '@/components/search/search-no-results';
import { Skeleton } from '@/components/ui/skeleton';
import type { Product } from '@/platform/services/model/product';

interface SearchProductTileGridProps {
  products: Product[];
  locale: string;
  pageSize: number;
  total: number;
  loading: boolean;
  /**
   * Override the grid template so the list view (narrower right column) can downsize the columns.
   * Defaults match the full-width grid layout used by `SearchResultsGrid`.
   */
  gridClassName?: string;
}

const DEFAULT_GRID_CLASSES =
  'grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6 lg:grid-cols-4';

/**
 * Shared product tile grid: loading skeletons, empty state, "Showing X of Y" header, and the
 * actual product grid. Used by both `SearchResultsGrid` and the PLP list-view orchestrator so the
 * two layouts stay in sync without drift.
 */
export function SearchProductTileGrid({
  products,
  locale,
  pageSize,
  total,
  loading,
  gridClassName,
}: SearchProductTileGridProps) {
  const t = useTranslations('search');
  const resolvedGridClass = gridClassName ?? DEFAULT_GRID_CLASSES;

  if (loading) {
    return (
      <>
        <Skeleton className="mb-4 h-5 w-[180px]" />
        <div className={resolvedGridClass}>
          {Array.from({ length: Math.min(pageSize, products.length) }).map((_, i) => (
            <ProductTileSkeleton key={i} />
          ))}
        </div>
      </>
    );
  }

  if (products.length === 0) {
    return <SearchNoResults />;
  }

  return (
    <>
      <div className="mb-4">
        <p className="text-sm text-text-placeholders">
          {t('searchResults.showing', {
            start: 1,
            end: products.length,
            total: total,
          })}
        </p>
      </div>
      <div className={resolvedGridClass}>
        {products.map((product) => (
          <div key={product.id} className="h-full">
            <ProductTile product={product} locale={locale} skipVariantFetch />
          </div>
        ))}
      </div>
    </>
  );
}
