'use client';

import { useTranslations } from 'next-intl';
import { ProductTile } from '@/components/product/product-tile';
import { ProductTileSkeleton } from '@/components/product/product-tile-skeleton';
import { SearchNoResults } from '@/components/search/search-no-results';
import { Skeleton } from '@/components/ui/skeleton';
import { Product } from '@/platform/services/model/product';

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
  const t = useTranslations('search');

  return (
    <>
      {loading ? (
        <>
          <Skeleton className="mb-4 h-5 w-[180px]" />
          <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
            {Array.from({ length: Math.min(pageSize, products.length) }).map((_, i) => (
              <ProductTileSkeleton key={i} />
            ))}
          </div>
        </>
      ) : (
        <>
          {products.length === 0 ? (
            <SearchNoResults />
          ) : (
            <>
              <div className="mb-4">
                <p className="text-text-placeholders text-sm">
                  {t('searchResults.showing', {
                    start: 1,
                    end: products.length,
                    total: total,
                  })}
                </p>
              </div>

              {/* Client-side rendered products - this will replace the server-rendered ones */}
              <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
                {products.map((product) => (
                  <div key={product.id} className="h-full">
                    <ProductTile product={product} locale={locale} skipVariantFetch />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
