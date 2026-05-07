'use client';

import { useTranslations } from 'next-intl';
import { PlpCategoryBreadcrumbs } from '@/components/search/list-view/plp-category-breadcrumbs';
import { PlpCategoryCarousel } from '@/components/search/list-view/plp-category-carousel';
import { PlpCategoryTree } from '@/components/search/list-view/plp-category-tree';
import { SearchProductTileGrid } from '@/components/search/search-product-tile-grid';
import { Button } from '@/components/ui/button';
import type { Category } from '@/platform/services/model/category';
import type { Product } from '@/platform/services/model/product';

interface PlpListLayoutProps {
  products: Product[];
  locale: string;
  pageSize: number;
  total: number;
  loading: boolean;
  navigationRoots: Category[];
  selectedCategoryId?: string;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void | Promise<void>;
}

/**
 * PLP list-view orchestrator: top carousel + breadcrumbs (full-width row) above a two-column
 * split with the category tree on the left and the product grid on the right.
 *
 * Mobile: tree is hidden — the carousel stays visible and the product grid spans the full width.
 * The tree gets relocated into the "Filters" modal in a later step.
 */
export function PlpListLayout({
  products,
  locale,
  pageSize,
  total,
  loading,
  navigationRoots,
  selectedCategoryId,
  hasMore,
  loadingMore,
  loadMore,
}: PlpListLayoutProps) {
  const t = useTranslations('search.searchResults');

  return (
    <div className="flex flex-col gap-6">
      <PlpCategoryCarousel categories={navigationRoots} locale={locale} />
      <PlpCategoryBreadcrumbs />

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <aside className="hidden sm:block" aria-label={t('allProducts')}>
          <PlpCategoryTree
            categories={navigationRoots}
            selectedCategoryId={selectedCategoryId}
            locale={locale}
            total={total}
          />
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <SearchProductTileGrid
            products={products}
            locale={locale}
            pageSize={pageSize}
            total={total}
            loading={loading}
            gridClassName="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 md:gap-6"
          />
          {hasMore ? (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? t('loadingMore') : t('loadMore')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default PlpListLayout;
