import type { Category } from '@/platform/services/model/category';
import { withBatteryIncludedCategoryMetadata } from '@/platform/services/model/category/batteryincluded-category';
import type { BatteryIncludedCategoryTreeSnapshot } from '@/platform/services/search/impl/batteryincluded-category-tree';
import { getCategoryChildren } from './category-tree-utils';

/**
 * Attaches BatteryIncluded category metadata (`displayPath`, `facetValue`, `labelPath`, …) from
 * the public BI category snapshot to a forest that was built without it — today the customer
 * segment forest from `SegmentFilterService.getCategoryScope` (COP-4822).
 *
 * With the metadata in place the PLP resolves hrefs, the selected category and the live
 * category-tree counts from the segment-scoped `_product_i18n.categoryBreadcrumbs.displayPath`
 * facet exactly like the public PLP does, instead of falling back to `filters[categoryIds]`
 * links and the unscoped Emporix per-category counts.
 *
 * The snapshot `count` is deliberately **not** copied: it is the public catalog count and would
 * leak wrong numbers into a segmented tree via `getBatteryIncludedCategoryStaticCount`.
 *
 * Pure: inputs are never mutated; nodes missing from `snapshot.byId` are returned as-is and a
 * `null` / `undefined` snapshot returns the roots unchanged (in a new array).
 */
export function enrichCategoriesWithBatteryIncludedMetadata(
  roots: readonly Category[],
  snapshot: Pick<BatteryIncludedCategoryTreeSnapshot, 'byId'> | null | undefined,
): Category[] {
  if (!snapshot) {
    return [...roots];
  }

  const enrich = (node: Category): Category => {
    const children = getCategoryChildren(node);
    const base: Category = children.length > 0 ? { ...node, children: children.map(enrich) } : node;
    const entry = snapshot.byId[node.id];
    if (!entry) {
      return base;
    }
    return withBatteryIncludedCategoryMetadata(base, {
      source: 'batteryincluded',
      displayPath: entry.displayPath,
      facetValue: entry.facetValue,
      labelPath: entry.labelPath,
      leafLabel: entry.leafLabel,
      publicationAnchorId: entry.publicationAnchorId,
      idPath: entry.idPath,
    });
  };

  return roots.map(enrich);
}
