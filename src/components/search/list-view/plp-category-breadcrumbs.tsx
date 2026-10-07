'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
// import { Link } from '@/i18n/navigation';
import { useProductsMode } from '@/components/navigation/products-mode-context';
import { PlpPendingLink } from '@/components/search/list-view/plp-pending-link';
import type { PlpCategoryContext } from '@/lib/category/plp-category-context';
import {
  buildBrowseHrefClearCategory,
  buildBrowseHrefForCategoryId,
  buildBrowseHrefResetAll,
} from '@/lib/navigation/build-browse-category-href';
import type { L10nInput } from '@/lib/utils';
import { l10nOrEmpty } from '@/lib/utils';
import type { Category } from '@/platform/services/model/category';

interface PlpCategoryBreadcrumbsProps {
  plpCategoryContext: PlpCategoryContext;
  locale: string;
}

export function PlpCategoryBreadcrumbs({ plpCategoryContext, locale }: PlpCategoryBreadcrumbsProps) {
  const tCommon = useTranslations('common.Breadcrumb');
  const tSearch = useTranslations('search.searchResults');
  const searchParams = useSearchParams();
  const { mode: productsMode } = useProductsMode();
  // COP-4822 AC2/AC6: segmented customers see "Assigned Products" as the root crumb; ALL mode and anonymous keep "All Products".
  const rootLabel = productsMode === 'assigned' ? tSearch('assignedProducts') : tSearch('allProducts');
  const getCategoryLabel = (name: L10nInput) => l10nOrEmpty(name, locale);
  const breadcrumbItems = plpCategoryContext.currentCategory
    ? [...plpCategoryContext.ancestorTrail, { kind: 'category' as const, category: plpCategoryContext.currentCategory }]
    : [];

  const hasSearchPhrase = !!searchParams?.get('q');

  const renderRootCrumb = (isLast: boolean) => {
    if (isLast) {
      return (
        <span className="inline-flex items-center text-text-body" aria-current="page">
          {rootLabel}
        </span>
      );
    }

    return (
      <>
        <PlpPendingLink
          href={buildBrowseHrefResetAll(searchParams)}
          className="inline-flex items-center font-bold text-text-action underline hover:text-text-action-hover"
        >
          {rootLabel}
        </PlpPendingLink>
        {hasSearchPhrase && (
          <>
            <span className="inline-flex items-center text-text-placeholders" aria-hidden="true">
              <ChevronRight className="size-4" />
            </span>
            <PlpPendingLink
              href={buildBrowseHrefClearCategory(searchParams)}
              className="inline-flex items-center font-bold text-text-action underline hover:text-text-action-hover"
            >
              {tSearch('searchResults')}
            </PlpPendingLink>
          </>
        )}
      </>
    );
  };

  const renderCategoryCrumb = (category: Category, isLast: boolean) => {
    if (isLast) {
      return (
        <span className="inline-flex items-center text-text-body" aria-current="page">
          {getCategoryLabel(category.name)}
        </span>
      );
    }

    return (
      <PlpPendingLink
        href={buildBrowseHrefForCategoryId(category.id, category, searchParams)}
        className="inline-flex items-center font-bold text-text-action underline hover:text-text-action-hover"
      >
        {getCategoryLabel(category.name)}
      </PlpPendingLink>
    );
  };

  return (
    <nav aria-label={rootLabel} className="w-full" data-testid="plp-category-breadcrumbs">
      <ol className="flex flex-wrap items-center gap-1 text-base text-text-body">
        <li className="inline-flex items-center">
          <PlpPendingLink href="/" className="font-bold text-text-action underline hover:text-text-action-hover">
            {tCommon('homeLink')}
          </PlpPendingLink>
        </li>
        {breadcrumbItems.length === 0 ? (
          <>
            <li className="inline-flex items-center text-text-placeholders" aria-hidden="true">
              <ChevronRight className="size-4" />
            </li>
            {hasSearchPhrase ? (
              <li className="contents">
                <PlpPendingLink
                  href={buildBrowseHrefResetAll(searchParams)}
                  className="font-bold text-text-action underline hover:text-text-action-hover"
                >
                  {rootLabel}
                </PlpPendingLink>
                <span className="inline-flex items-center text-text-placeholders" aria-hidden="true">
                  <ChevronRight className="size-4" />
                </span>
                <span className="inline-flex items-center text-text-body">{tSearch('searchResults')}</span>
              </li>
            ) : (
              <li className="inline-flex items-center" aria-current="page">
                <span className="text-text-body">{rootLabel}</span>
              </li>
            )}
          </>
        ) : (
          breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1;

            return (
              <li key={item.kind === 'virtual-all-products' ? 'all-products' : item.category.id} className="contents">
                <span className="inline-flex items-center text-text-placeholders" aria-hidden="true">
                  <ChevronRight className="size-4" />
                </span>
                {item.kind === 'virtual-all-products'
                  ? renderRootCrumb(isLast)
                  : renderCategoryCrumb(item.category, isLast)}
              </li>
            );
          })
        )}
      </ol>
    </nav>
  );
}

export default PlpCategoryBreadcrumbs;
