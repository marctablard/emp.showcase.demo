'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { H5 } from '@/components/ui/h';
import { useCategoryProductCounts } from '@/hooks/category/useCategoryProductCounts';
import { Link } from '@/i18n/navigation';
import { getCategoryChildren, walkCategoryTree } from '@/lib/category/category-tree-utils';
import { buildBrowseHrefForCategoryId } from '@/lib/navigation/build-browse-category-href';
import { cn } from '@/lib/utils';
import { l10n } from '@/lib/utils';
import type { Category } from '@/platform/services/model/category';

interface PlpCategoryTreeProps {
  /** Site-scoped navigation forest. Empty forest renders nothing. */
  categories: Category[];
  /** Currently active category (from `filters[categoryIds]`). Drives `aria-current`. */
  selectedCategoryId?: string;
  locale: string;
  /** Total product count from the active search, shown next to the header. */
  total: number;
}

interface PlpCategoryTreeNodeProps {
  node: Category;
  level: number;
  selectedCategoryId?: string;
  locale: string;
  counts: Record<string, number>;
}

function PlpCategoryTreeNode({ node, level, selectedCategoryId, locale, counts }: PlpCategoryTreeNodeProps) {
  const href = buildBrowseHrefForCategoryId(node.id);
  const name = l10n(node.name, locale);
  const count = counts[node.id];
  const isSelected = selectedCategoryId === node.id;
  const children = getCategoryChildren(node);

  return (
    <li data-testid="plp-category-tree-node">
      <Link
        href={href}
        aria-current={isSelected ? 'page' : undefined}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-base outline-none transition',
          'hover:bg-surface-action-subtle hover:text-text-action focus-visible:ring-2 focus-visible:ring-border-focus',
          isSelected ? 'font-bold text-text-action' : 'text-text-body',
        )}
        style={{ paddingLeft: `calc(${level} * 1rem + 0.5rem)` }}
      >
        <span className="truncate">{name}</span>
        {typeof count === 'number' ? (
          <span className={cn('shrink-0 text-sm', isSelected ? 'text-text-action' : 'text-text-placeholders')}>
            {count}
          </span>
        ) : null}
      </Link>
      {children.length > 0 ? (
        <ul className="flex flex-col">
          {children.map((child) => (
            <PlpCategoryTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedCategoryId={selectedCategoryId}
              locale={locale}
              counts={counts}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Fully-expanded category tree rendered in the PLP list-view left column.
 *
 * Every node is static: a site-aware `<Link>` scoped to `filters[categoryIds]=<id>`. Clicking a node
 * navigates — TODO next stepwill swap this for an accordion with collapse state. `pruneEmptyBranches` is
 * intentionally NOT applied here; the tree shows all navigation categories with best-effort counts.
 */
export function PlpCategoryTree({ categories, selectedCategoryId, locale, total }: PlpCategoryTreeProps) {
  const t = useTranslations('search.plpCategoryTree');

  const allCategoryIds = useMemo(() => {
    const ids: string[] = [];
    walkCategoryTree(categories, (node) => {
      ids.push(node.id);
    });
    return ids;
  }, [categories]);

  const allCategoryIdsKey = allCategoryIds.join('|');
  const { counts, requestCounts } = useCategoryProductCounts();

  useEffect(() => {
    if (allCategoryIds.length === 0) {
      return;
    }
    requestCounts(allCategoryIds);
    // `allCategoryIdsKey` keeps the effect stable when the forest identity changes but the id
    // set stays the same (memoisation churn higher up).
  }, [allCategoryIdsKey, allCategoryIds, requestCounts]);

  if (categories.length === 0) {
    return null;
  }

  return (
    <Card data-testid="plp-category-tree" className="gap-0 py-4">
      <CardHeader className="px-4">
        <div className="flex items-baseline gap-2">
          <H5>{t('title')}</H5>
          <span className="text-sm text-text-placeholders">{t('totalProducts', { total })}</span>
        </div>
      </CardHeader>
      <CardContent className="px-2">
        <nav aria-label={t('title')}>
          <ul className="flex flex-col">
            {categories.map((root) => (
              <PlpCategoryTreeNode
                key={root.id}
                node={root}
                level={0}
                selectedCategoryId={selectedCategoryId}
                locale={locale}
                counts={counts}
              />
            ))}
          </ul>
        </nav>
      </CardContent>
    </Card>
  );
}

export default PlpCategoryTree;
