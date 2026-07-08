'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { PlpFacetPanel } from '@/components/search/facets';
import { PlpCategoryBreadcrumbs } from '@/components/search/list-view/plp-category-breadcrumbs';
import { PlpCategoryTree } from '@/components/search/list-view/plp-category-tree';
import { SearchProductTileGrid } from '@/components/search/search-product-tile-grid';
import { SearchSort } from '@/components/search/search-sort';
import { Button } from '@/components/ui/button';
import { H2 } from '@/components/ui/h';
import { useCategoryProductCounts } from '@/hooks/category/useCategoryProductCounts';
import { resolvePlpCategoryContext } from '@/lib/category/plp-category-context';
import { l10nOrEmpty } from '@/lib/utils';
import type { Category } from '@/platform/services/model/category';
import { getBatteryIncludedCategoryStaticCount } from '@/platform/services/model/category/batteryincluded-category';
import type { BatteryIncludedFacet, SearchFilterValue, SearchSortOption } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';

interface PlpListLayoutProps {
  products: Product[];
  locale: string;
  pageSize: number;
  total: number;
  loading: boolean;
  pendingCursor?: boolean;
  navigationRoots: Category[];
  selectedCategoryId?: string;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void | Promise<void>;
  availableSorts?: SearchSortOption[];
  batteryIncludedFacets?: BatteryIncludedFacet[];
  activeFilters: Record<string, SearchFilterValue>;
  currentSort?: string;
  applyFacet: (facetId: string, value: string | string[]) => void;
  applyRangeFacet: (facetId: string, min: string, max: string) => void;
  changeSort: (sort?: string) => void;
  resetFacet: (facetId: string) => void;
  resetAllFacets?: () => void;
  categoryFilterLabelsById?: Record<string, string>;
  topControlsNode?: React.ReactNode;
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
  pendingCursor,
  navigationRoots,
  selectedCategoryId,
  hasMore,
  loadingMore,
  loadMore,
  availableSorts,
  batteryIncludedFacets,
  activeFilters,
  currentSort,
  applyFacet,
  applyRangeFacet,
  changeSort,
  resetFacet,
  resetAllFacets,
  categoryFilterLabelsById,
  topControlsNode,
}: PlpListLayoutProps) {
  const t = useTranslations('search.searchResults');
  const tFilter = useTranslations('product.filters');
  const plpContext = resolvePlpCategoryContext(navigationRoots, selectedCategoryId);
  const staticCounts = useMemo(() => {
    const out: Record<string, number> = {};

    for (const category of [plpContext.currentCategory, ...plpContext.currentChildren]) {
      if (!category) {
        continue;
      }

      const count = getBatteryIncludedCategoryStaticCount(category);
      if (typeof count === 'number') {
        out[category.id] = count;
      }
    }

    return out;
  }, [plpContext.currentCategory, plpContext.currentChildren]);
  const idsToRequest = useMemo(
    () => plpContext.sidebarCountCategoryIds.filter((id) => staticCounts[id] === undefined),
    [plpContext.sidebarCountCategoryIds, staticCounts],
  );
  const { counts, requestCounts } = useCategoryProductCounts();

  useEffect(() => {
    if (idsToRequest.length > 0) {
      requestCounts(idsToRequest);
    }
  }, [idsToRequest, requestCounts]);

  const categoryCountsById = useMemo(() => ({ ...counts, ...staticCounts }), [counts, staticCounts]);
  const currentCategoryName = plpContext.currentCategory ? l10nOrEmpty(plpContext.currentCategory.name, locale) : '';
  const summaryTitle = currentCategoryName || t('allProducts');
  const summaryCount = plpContext.currentCategory ? categoryCountsById[plpContext.currentCategory.id] : total;
  const summaryDescription = plpContext.currentCategory
    ? l10nOrEmpty(plpContext.currentCategory.description, locale)
    : '';

  return (
    <div className="flex flex-col gap-4">
      {/* <PlpCategoryCarousel categories={plpContext.ribbonCategories} locale={locale} /> */}
      <PlpCategoryBreadcrumbs plpCategoryContext={plpContext} locale={locale} />
      <section className="flex flex-col gap-4" aria-label={summaryTitle} data-testid="plp-category-summary">
        <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:gap-4">
          <H2 className="mb-0">{summaryTitle}</H2>
          {typeof summaryCount === 'number' && !loading ? (
            <span className="text-text-secondary text-lg font-normal">
              {tFilter('productCount', { count: summaryCount })}
            </span>
          ) : null}
        </div>
        {summaryDescription ? <p className="text-base text-text-body">{summaryDescription}</p> : null}
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,444px)_minmax(0,1fr)]">
        <aside className="hidden md:block" aria-label={t('allProducts')}>
          <PlpCategoryTree
            plpCategoryContext={plpContext}
            locale={locale}
            total={total}
            categoryCountsById={categoryCountsById}
          />
          <div className="mt-6">
            <SearchSort availableSorts={availableSorts} currentSort={currentSort} changeSort={changeSort} />
          </div>
          <PlpFacetPanel
            facets={batteryIncludedFacets}
            activeFilters={activeFilters}
            applyFacet={applyFacet}
            applyRangeFacet={applyRangeFacet}
            resetFacet={resetFacet}
            resetAllFacets={resetAllFacets}
            categoryFilterLabelsById={categoryFilterLabelsById}
            className="mt-6"
          />
        </aside>

        <div className="flex min-w-0 flex-col gap-2">
          {topControlsNode}
          <SearchProductTileGrid
            products={products}
            locale={locale}
            pageSize={pageSize}
            total={total}
            loading={loading}
            pendingCursor={pendingCursor}
            gridClassName="grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 md:gap-6"
          />
          {hasMore ? (
            <div className="flex justify-center pt-3">
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
