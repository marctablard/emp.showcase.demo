'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ListFilter, X } from 'lucide-react';
import { PlpCategoryTree } from '@/components/search/list-view/plp-category-tree';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { H4 } from '@/components/ui/h';
import { useCategoryProductCounts } from '@/hooks/category/useCategoryProductCounts';
import type { PlpCategoryContext } from '@/lib/category/plp-category-context';
import { getBatteryIncludedCategoryStaticCount } from '@/platform/services/model/category/batteryincluded-category';

interface MobileCategoryDrawerProps {
  plpCategoryContext: PlpCategoryContext;
  locale: string;
  total: number;
}

export function MobileCategoryDrawer({ plpCategoryContext, locale, total }: MobileCategoryDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tFilter = useTranslations('product.filters');
  const staticCounts = useMemo(() => {
    const out: Record<string, number> = {};

    for (const category of [plpCategoryContext.currentCategory, ...plpCategoryContext.currentChildren]) {
      if (!category) {
        continue;
      }

      const count = getBatteryIncludedCategoryStaticCount(category);
      if (typeof count === 'number') {
        out[category.id] = count;
      }
    }

    return out;
  }, [plpCategoryContext.currentCategory, plpCategoryContext.currentChildren]);
  const idsToRequest = useMemo(
    () => plpCategoryContext.sidebarCountCategoryIds.filter((id) => staticCounts[id] === undefined),
    [plpCategoryContext.sidebarCountCategoryIds, staticCounts],
  );
  const { counts, requestCounts } = useCategoryProductCounts();

  useEffect(() => {
    if (idsToRequest.length > 0) {
      requestCounts(idsToRequest);
    }
  }, [idsToRequest, requestCounts]);

  const categoryCountsById = useMemo(() => ({ ...counts, ...staticCounts }), [counts, staticCounts]);

  return (
    <div className="relative w-full">
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button variant="secondary" className="w-full" data-testid="mobile-category-drawer-toggle">
            <ListFilter className="mr-2" /> {tFilter('filterButton')}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-[85vh] overflow-y-auto rounded-t-[8px] border-none shadow-lg [&>div:first-child]:hidden data-[vaul-drawer-direction=bottom]:max-h-[85vh] data-[vaul-drawer-direction=bottom]:rounded-t-[8px]">
          <div className="flex flex-col gap-[40px] p-[24px]">
            <div className="flex items-center justify-between">
              <DrawerTitle asChild>
                <H4 className="text-text-headings">{tFilter('filterButton')}</H4>
              </DrawerTitle>
              <DrawerClose asChild>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center text-icon-action"
                  aria-label={tFilter('close')}
                >
                  <X className="h-6 w-6" />
                </button>
              </DrawerClose>
            </div>

            <div className="flex items-center justify-between border-b border-border-primary pb-4">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-text-headings">{tFilter('categoryIds')}</span>
                {typeof total === 'number' ? (
                  <span className="text-base font-normal text-text-body">
                    {tFilter('productCount', { count: total })}
                  </span>
                ) : null}
              </div>
              <ChevronDown className="h-5 w-5 text-icon-action" />
            </div>

            <div className="flex flex-col gap-6">
              <PlpCategoryTree
                plpCategoryContext={plpCategoryContext}
                locale={locale}
                total={total}
                categoryCountsById={categoryCountsById}
                isNested={true}
              />
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
