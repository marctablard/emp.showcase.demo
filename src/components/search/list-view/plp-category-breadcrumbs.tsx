'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/**
 * Static "mock" breadcrumb rendered above the PLP list view.
 * To be Replaced later with a real category-path breadcrumb driven by the selected category.
 *
 * Visually matches Figma PLP breadcrumbs: `Home / All products`. Kept intentionally simple so the
 * upgrade can swap it without touching the parent layout.
 */
export function PlpCategoryBreadcrumbs() {
  const tCommon = useTranslations('common.Breadcrumb');
  const tSearch = useTranslations('search.searchResults');

  return (
    <nav aria-label={tCommon('homeLink')} className="w-full py-4" data-testid="plp-category-breadcrumbs">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-text-body">
        <li className="inline-flex items-center">
          <Link href="/" className="font-bold text-text-action underline hover:text-text-action-hover">
            {tCommon('homeLink')}
          </Link>
        </li>
        <li className="inline-flex items-center text-text-placeholders" aria-hidden="true">
          <ChevronRight className="size-4" />
        </li>
        <li className="inline-flex items-center" aria-current="page">
          <span className="text-text-body">{tSearch('allProducts')}</span>
        </li>
      </ol>
    </nav>
  );
}

export default PlpCategoryBreadcrumbs;
