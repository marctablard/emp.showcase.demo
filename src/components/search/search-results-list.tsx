import { useTranslations } from 'next-intl';
import type { Product } from '@platform/services/model/product';
import { ProductTileListItemSkeleton } from '@/components/product/product-tile-list-item-skeleton';
import { PlpCategoryBreadcrumbs } from '@/components/search/list-view/plp-category-breadcrumbs';
import { PlpCategoryCarousel } from '@/components/search/list-view/plp-category-carousel';
import { SearchNoResults } from '@/components/search/search-no-results';
import { Skeleton } from '@/components/ui/skeleton';
import type { Category } from '@/platform/services/model/category';

interface SearchResultsListProps {
  products: Product[];
  locale: string;
  currentPage: number;
  pageSize: number;
  total: number;
  loading: boolean;
  /**
   * Site-scoped navigation root categories rendered in the PLP thumbnail carousel. Optional so
   * legacy call sites that do not plumb the forest keep rendering the placeholder product area.
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
  navigationRoots,
}: SearchResultsListProps) {
  const t = useTranslations('search');
  const rootCategories = navigationRoots ?? [];

  return (
    <>
      <PlpCategoryCarousel categories={rootCategories} locale={locale} />
      <PlpCategoryBreadcrumbs />

      {loading ? (
        <>
          <Skeleton className="mb-4 h-5 w-[180px]" />
          <div className="flex flex-col gap-4">
            {Array.from({ length: Math.min(pageSize, products.length) }).map((_, i) => (
              <ProductTileListItemSkeleton key={i} />
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
              <div className="flex flex-col gap-4">
                <p>List view currently not available. Please select grid view.</p>
                {/*{products.map((product) => (*/}
                {/*  <div key={product.id} className="h-full">*/}
                {/*    <ProductTileListItem product={product} locale={locale} />*/}
                {/*  </div>*/}
                {/*))}*/}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
