'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useProductsMode } from '@/components/navigation/products-mode-context';
import { PlpPendingLink } from '@/components/search/list-view/plp-pending-link';
import { PlpProductsModeSwitch } from '@/components/search/list-view/plp-products-mode-switch';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { H5 } from '@/components/ui/h';
import type { PlpCategoryContext } from '@/lib/category/plp-category-context';
import {
  buildBrowseHrefClearCategory,
  buildBrowseHrefForCategoryId,
  buildBrowseHrefResetAll,
} from '@/lib/navigation/build-browse-category-href';
import { l10n } from '@/lib/utils';

interface PlpCategoryTreeProps {
  plpCategoryContext: PlpCategoryContext;
  locale: string;
  total: number;
  categoryCountsById: Record<string, number>;
  className?: string;
  isNested?: boolean;
}

/**
 * Drill-down category tree rendered in the PLP list-view left column.
 */
export function PlpCategoryTree({
  plpCategoryContext,
  locale,
  categoryCountsById,
  className,
  isNested,
}: PlpCategoryTreeProps) {
  const t = useTranslations('search.plpCategoryTree');
  const tSearch = useTranslations('search.searchResults');
  const searchParams = useSearchParams();
  const { mode: productsMode } = useProductsMode();

  const { ancestorTrail, currentCategory, currentChildren } = plpCategoryContext;
  // COP-4822 AC2: segmented customers see "Assigned Products" as the root row; ALL mode and anonymous keep "All Products".
  const rootLabel = productsMode === 'assigned' ? tSearch('assignedProducts') : tSearch('allProducts');
  const currentLabel = currentCategory ? l10n(currentCategory.name, locale) : rootLabel;

  const selectedLabelRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (selectedLabelRef.current) {
      selectedLabelRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [currentCategory?.id]);

  const treeContent = (
    <nav aria-label={t('title')}>
      {/* Ancestors Breadcrumbs */}
      {ancestorTrail.length > 0 && (
        <ul className="flex flex-col gap-2">
          {ancestorTrail.map((ancestor) => {
            if (ancestor.kind === 'virtual-all-products') {
              return (
                <li key="virtual-all-products">
                  <PlpPendingLink
                    href={buildBrowseHrefClearCategory(searchParams)}
                    className="group inline-flex min-h-[50px] items-center gap-2 text-text-action underline outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                    title={tSearch('allCategories')}
                  >
                    <ChevronLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
                    <span className="truncate" title={tSearch('allCategories')}>
                      {tSearch('allCategories')}
                    </span>
                  </PlpPendingLink>
                </li>
              );
            }
            const cat = ancestor.category;
            return (
              <li key={cat.id}>
                <PlpPendingLink
                  href={buildBrowseHrefForCategoryId(cat.id, cat, searchParams)}
                  className="group inline-flex min-h-[50px] items-center gap-2 text-text-action underline outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  title={l10n(cat.name, locale)}
                  data-testid={`plp-category-tree-ancestor-${cat.id}`}
                >
                  <ChevronLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
                  <span className="truncate" title={l10n(cat.name, locale)}>
                    {l10n(cat.name, locale)}
                  </span>
                </PlpPendingLink>
              </li>
            );
          })}
        </ul>
      )}

      {/* Current Category Emphasized Row */}
      <div className="pl-4">
        <PlpPendingLink
          href={
            currentCategory
              ? buildBrowseHrefForCategoryId(currentCategory.id, currentCategory, searchParams)
              : buildBrowseHrefResetAll(searchParams)
          }
          className="inline-flex min-h-[50px] w-full items-center justify-between font-bold text-text-headings outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          aria-current="page"
          ref={selectedLabelRef}
          title={currentLabel}
          data-testid="plp-category-tree-current"
        >
          <span className="truncate" title={currentLabel}>
            {currentLabel}
          </span>
          {currentCategory && categoryCountsById[currentCategory.id] !== undefined && (
            <span className="shrink-0 text-text-on-disabled font-normal ml-2">
              {categoryCountsById[currentCategory.id]}
            </span>
          )}
        </PlpPendingLink>
      </div>

      {/* Children List */}
      {currentChildren.length > 0 && (
        <div className="pl-8">
          <ul className="flex flex-col">
            {currentChildren.map((child) => {
              const childCount = categoryCountsById[child.id];
              return (
                <li key={child.id}>
                  <PlpPendingLink
                    href={buildBrowseHrefForCategoryId(child.id, child, searchParams)}
                    className="inline-flex min-h-[40px] w-full items-center justify-between text-text-body hover:text-text-headings hover:underline outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                    title={l10n(child.name, locale)}
                    data-testid={`plp-category-tree-child-${child.id}`}
                  >
                    <span className="truncate" title={l10n(child.name, locale)}>
                      {l10n(child.name, locale)}
                    </span>
                    {childCount !== undefined && <span className="shrink-0 text-text-on-disabled">{childCount}</span>}
                  </PlpPendingLink>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );

  if (isNested) {
    return (
      <div data-testid="plp-category-tree-nested" className={className}>
        {treeContent}
      </div>
    );
  }

  return (
    <Card
      data-testid="plp-category-tree"
      className={className || 'gap-0 pt-4 pb-6 shadow-sm border-border-primary rounded-[8px]'}
    >
      {/* COP-4822 CR-1: the ASSIGNED / ALL products switch sits right of the "Categories" title when the column is
          wide enough (≥1440px) and wraps onto its own row below the title in the narrow 274px sidebar. */}
      <CardHeader className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 pb-4 pt-0">
        <H5>{t('title')}</H5>
        <PlpProductsModeSwitch />
      </CardHeader>
      <CardContent className="px-6 pb-0">{treeContent}</CardContent>
    </Card>
  );
}

export default PlpCategoryTree;
