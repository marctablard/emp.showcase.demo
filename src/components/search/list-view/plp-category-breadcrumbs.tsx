'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { PlpCategoryContext } from '@/lib/category/plp-category-context';
import { buildBrowseHrefForCategoryId } from '@/lib/navigation/build-browse-category-href';
import { l10n } from '@/lib/utils';

interface PlpCategoryBreadcrumbsProps {
  plpCategoryContext: PlpCategoryContext;
  locale: string;
}

export function PlpCategoryBreadcrumbs({ plpCategoryContext, locale }: PlpCategoryBreadcrumbsProps) {
  const tCommon = useTranslations('common.Breadcrumb');
  const tSearch = useTranslations('search.searchResults');
  const breadcrumbItems = plpCategoryContext.currentCategory
    ? [...plpCategoryContext.ancestorTrail, { kind: 'category' as const, category: plpCategoryContext.currentCategory }]
    : [];

  return (
    <nav aria-label={tSearch('allProducts')} className="w-full py-4" data-testid="plp-category-breadcrumbs">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-text-body">
        <li className="inline-flex items-center">
          <Link href="/" className="font-bold text-text-action underline hover:text-text-action-hover">
            {tCommon('homeLink')}
          </Link>
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
                    <Link
                      href="/browse"
                      className="inline-flex items-center font-bold text-text-action underline hover:text-text-action-hover"
                    >
                      {tSearch('allProducts')}
                    </Link>
                  )
                ) : isLast ? (
                  <span className="inline-flex items-center text-text-body" aria-current="page">
                    {l10n(item.category.name, locale)}
                  </span>
                ) : (
                  <Link
                    href={buildBrowseHrefForCategoryId(item.category.id, item.category)}
                    className="inline-flex items-center font-bold text-text-action underline hover:text-text-action-hover"
                  >
                    {l10n(item.category.name, locale)}
                  </Link>
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
