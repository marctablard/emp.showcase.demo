'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
// import { Link } from '@/i18n/navigation';
import { PlpPendingLink } from '@/components/search/list-view/plp-pending-link';
import type { PlpCategoryContext } from '@/lib/category/plp-category-context';
import { buildBrowseHrefForCategoryId } from '@/lib/navigation/build-browse-category-href';
import type { L10nInput } from '@/lib/utils';
import { l10nOrEmpty } from '@/lib/utils';

interface PlpCategoryBreadcrumbsProps {
  plpCategoryContext: PlpCategoryContext;
  locale: string;
}

export function PlpCategoryBreadcrumbs({ plpCategoryContext, locale }: PlpCategoryBreadcrumbsProps) {
  const tCommon = useTranslations('common.Breadcrumb');
  const tSearch = useTranslations('search.searchResults');
  const getCategoryLabel = (name: L10nInput) => l10nOrEmpty(name, locale);
  const breadcrumbItems = plpCategoryContext.currentCategory
    ? [...plpCategoryContext.ancestorTrail, { kind: 'category' as const, category: plpCategoryContext.currentCategory }]
    : [];

  return (
    <nav aria-label={tSearch('allProducts')} className="w-full" data-testid="plp-category-breadcrumbs">
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
            <li className="inline-flex items-center" aria-current="page">
              <span className="text-text-body">{tSearch('allProducts')}</span>
            </li>
          </>
        ) : (
          breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1;

            return (
              <li key={item.kind === 'virtual-all-products' ? 'all-products' : item.category.id} className="contents">
                <span className="inline-flex items-center text-text-placeholders" aria-hidden="true">
                  <ChevronRight className="size-4" />
                </span>
                {item.kind === 'virtual-all-products' ? (
                  isLast ? (
                    <span className="inline-flex items-center text-text-body" aria-current="page">
                      {tSearch('allProducts')}
                    </span>
                  ) : (
                    <PlpPendingLink
                      href="/browse"
                      className="inline-flex items-center font-bold text-text-action underline hover:text-text-action-hover"
                    >
                      {tSearch('allProducts')}
                    </PlpPendingLink>
                  )
                ) : isLast ? (
                  <span className="inline-flex items-center text-text-body" aria-current="page">
                    {getCategoryLabel(item.category.name)}
                  </span>
                ) : (
                  <PlpPendingLink
                    href={buildBrowseHrefForCategoryId(item.category.id, item.category)}
                    className="inline-flex items-center font-bold text-text-action underline hover:text-text-action-hover"
                  >
                    {getCategoryLabel(item.category.name)}
                  </PlpPendingLink>
                )}
              </li>
            );
          })
        )}
      </ol>
    </nav>
  );
}

export default PlpCategoryBreadcrumbs;
