'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ListFilter, X } from 'lucide-react';
import { PlpFacetPanel } from '@/components/search/facets';
import { PlpCategoryTree } from '@/components/search/list-view/plp-category-tree';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { useCategoryProductCounts } from '@/hooks/category/useCategoryProductCounts';
import type { PlpCategoryContext } from '@/lib/category/plp-category-context';
import { resolvePlpCategoryTreeFacetContext } from '@/lib/category/plp-category-tree-facet';
import type { Category } from '@/platform/services/model/category';
import { getBatteryIncludedCategoryStaticCount } from '@/platform/services/model/category/batteryincluded-category';
import type { BatteryIncludedFacet, SearchFilterValue } from '@/platform/services/model/common';

interface MobileCategoryDrawerProps {
  plpCategoryContext: PlpCategoryContext;
  navigationRoots?: Category[];
  selectedCategoryId?: string;
  locale: string;
  total: number;
  facets?: BatteryIncludedFacet[];
  activeFilters: Record<string, SearchFilterValue>;
  applyFacet: (facetId: string, value: string | string[]) => void;
  applyRangeFacet: (facetId: string, min: string, max: string) => void;
  resetFacet: (facetId: string) => void;
  resetAllFacets?: () => void;
  categoryFilterLabelsById?: Record<string, string>;
}

export function MobileCategoryDrawer({
  plpCategoryContext,
  navigationRoots,
  selectedCategoryId,
  locale,
  total,
  facets,
  activeFilters,
  applyFacet,
  applyRangeFacet,
  resetFacet,
  resetAllFacets,
  categoryFilterLabelsById,
}: MobileCategoryDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tFilter = useTranslations('product.filters');
  const liveCategoryTreeContext = useMemo(
    () => resolvePlpCategoryTreeFacetContext(facets, navigationRoots, selectedCategoryId, locale),
    [facets, navigationRoots, selectedCategoryId, locale],
  );
  const useLiveCategoryTree =
    liveCategoryTreeContext !== undefined &&
    (selectedCategoryId === undefined || liveCategoryTreeContext.selectedCategoryFound);
  const resolvedCategoryContext =
    useLiveCategoryTree && liveCategoryTreeContext ? liveCategoryTreeContext.plpCategoryContext : plpCategoryContext;
  const staticCounts = useMemo(() => {
    const out: Record<string, number> = {};

    for (const category of [resolvedCategoryContext.currentCategory, ...resolvedCategoryContext.currentChildren]) {
      if (!category) {
        continue;
      }

      const count = getBatteryIncludedCategoryStaticCount(category);
      if (typeof count === 'number') {
        out[category.id] = count;
      }
    }

    return out;
  }, [resolvedCategoryContext.currentCategory, resolvedCategoryContext.currentChildren]);
  const idsToRequest = useMemo(
    () =>
      useLiveCategoryTree
        ? []
        : resolvedCategoryContext.sidebarCountCategoryIds.filter((id) => staticCounts[id] === undefined),
    [resolvedCategoryContext.sidebarCountCategoryIds, staticCounts, useLiveCategoryTree],
  );
  const { counts, requestCounts } = useCategoryProductCounts();

  useEffect(() => {
    if (idsToRequest.length > 0) {
      requestCounts(idsToRequest);
    }
  }, [idsToRequest, requestCounts]);

  const categoryCountsById = useMemo(() => {
    if (useLiveCategoryTree && liveCategoryTreeContext) {
      return { ...staticCounts, ...liveCategoryTreeContext.categoryCountsById };
    }

    return { ...counts, ...staticCounts };
  }, [counts, liveCategoryTreeContext, staticCounts, useLiveCategoryTree]);

  return (
    <div className="relative w-full">
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button variant="secondary" className="w-full" data-testid="mobile-category-drawer-toggle">
            <ListFilter className="mr-2" /> {tFilter('filterButton')}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-[85vh] rounded-t-[8px] border-none shadow-lg [&>div:first-child]:hidden data-[vaul-drawer-direction=bottom]:max-h-[85vh] data-[vaul-drawer-direction=bottom]:rounded-t-[8px]">
          <div className="flex h-full flex-col overflow-y-auto pb-[90px]">
            <div className="flex items-center justify-between border-b border-border-primary px-6 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-base font-bold text-text-headings">Category</span>
                {typeof total === 'number' ? (
                  <span className="text-base font-normal text-text-body">
                    {tFilter('productCount', { count: total })}
                  </span>
                ) : null}
              </div>
              <DrawerClose asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-transparent hover:bg-surface-secondary text-icon-action"
                  aria-label={tFilter('close')}
                >
                  <X className="h-5 w-5" />
                </Button>
              </DrawerClose>
            </div>

            <div className="px-6 py-4">
              <PlpCategoryTree
                plpCategoryContext={resolvedCategoryContext}
                locale={locale}
                total={total}
                categoryCountsById={categoryCountsById}
                isNested={true}
              />
            </div>

            <hr className="border-border-primary" />

            <div className="px-6 py-4">
              <div className="flex items-center justify-between border-b border-border-primary pb-4">
                <span className="text-base font-bold text-text-headings">{tFilter('filterButton')}</span>
                {Object.keys(activeFilters).length > 0 && (
                  <button
                    type="button"
                    onClick={resetAllFacets}
                    className="text-sm font-bold text-text-action underline-offset-4 hover:underline focus-visible:outline-none"
                  >
                    {tFilter('clearAllFilters', { defaultValue: 'Clear filters' })}
                  </button>
                )}
              </div>

              <div className="mt-6">
                <PlpFacetPanel
                  facets={facets}
                  activeFilters={activeFilters}
                  applyFacet={applyFacet}
                  applyRangeFacet={applyRangeFacet}
                  resetFacet={resetFacet}
                  categoryFilterLabelsById={categoryFilterLabelsById}
                  variant="list"
                />
              </div>
            </div>

            <div className="px-6 pb-6 pt-0">
              <DrawerClose asChild>
                <Button variant="secondary" className="w-full">
                  {tFilter('showProducts', { count: total })}
                </Button>
              </DrawerClose>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
