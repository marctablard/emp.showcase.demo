'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { PlpCategoryTreeNode } from '@/components/search/list-view/plp-category-tree-node';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { H5 } from '@/components/ui/h';
import { useCategoryProductCounts } from '@/hooks/category/useCategoryProductCounts';
import { findCategoryPath, pruneEmptyBranches, walkCategoryTree } from '@/lib/category/category-tree-utils';
import type { Category } from '@/platform/services/model/category';
import { getBatteryIncludedCategoryStaticCount } from '@/platform/services/model/category/batteryincluded-category';

interface PlpCategoryTreeProps {
  /** Site-scoped navigation forest. Empty forest renders nothing. */
  categories: Category[];
  /** Currently active category (from `filters[categoryIds]`). Drives `aria-current` and auto-expand. */
  selectedCategoryId?: string;
  locale: string;
  /** Total product count from the active search, shown next to the header. */
  total: number;
}

/**
 * Collapsible category tree rendered in the PLP list-view left column.
 *
 * Interaction model:
 * - Chevron click toggles local open/closed state **without** navigating.
 * - Label click navigates to the category-scoped PLP (keeps the requirement "all category names
 *   clickable").
 * - On deep links (`filters[categoryIds]=<deep-id>`), every ancestor of the active node auto-expands
 *   and the selected label scrolls into view.
 *
 * Pruning: `pruneEmptyBranches` hides branches whose product counts are known and all zero. When
 * counts have not resolved yet (every id returns `undefined`), the util keeps all nodes, so there
 * is no flicker while counts stream in.
 */
export function PlpCategoryTree({ categories, selectedCategoryId, locale, total }: PlpCategoryTreeProps) {
  const t = useTranslations('search.plpCategoryTree');

  const staticCounts = useMemo(() => {
    const out: Record<string, number> = {};
    walkCategoryTree(categories, (node) => {
      const count = getBatteryIncludedCategoryStaticCount(node);
      if (typeof count === 'number') {
        out[node.id] = count;
      }
    });
    return out;
  }, [categories]);

  const allCategoryIdsKey = useMemo(() => {
    const ids: string[] = [];
    walkCategoryTree(categories, (node) => {
      if (staticCounts[node.id] === undefined) {
        ids.push(node.id);
      }
    });
    return ids.join('|');
  }, [categories, staticCounts]);

  const { counts, requestCounts } = useCategoryProductCounts();

  useEffect(() => {
    if (allCategoryIdsKey.length === 0) {
      return;
    }
    requestCounts(allCategoryIdsKey.split('|'));
  }, [allCategoryIdsKey, requestCounts]);

  const mergedCounts = useMemo(() => ({ ...counts, ...staticCounts }), [counts, staticCounts]);

  const visibleCategories = useMemo(
    () => pruneEmptyBranches(categories, (id) => mergedCounts[id]),
    [categories, mergedCounts],
  );

  const selectedPathIds = useMemo(() => {
    if (!selectedCategoryId) {
      return new Set<string>();
    }
    const path = findCategoryPath(visibleCategories, selectedCategoryId);
    return new Set(path.map((node) => node.id));
  }, [visibleCategories, selectedCategoryId]);

  const selectedLabelRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (!selectedCategoryId || !selectedLabelRef.current) {
      return;
    }
    selectedLabelRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedCategoryId]);

  if (visibleCategories.length === 0) {
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
          <ul className="flex flex-col" role="tree">
            {visibleCategories.map((root) => (
              <PlpCategoryTreeNode
                key={root.id}
                node={root}
                level={0}
                locale={locale}
                selectedCategoryId={selectedCategoryId}
                selectedPathIds={selectedPathIds}
                counts={mergedCounts}
                selectedLabelRef={selectedLabelRef}
              />
            ))}
          </ul>
        </nav>
      </CardContent>
    </Card>
  );
}

export default PlpCategoryTree;
