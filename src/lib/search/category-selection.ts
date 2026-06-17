import { walkCategoryTree } from '@/lib/category/category-tree-utils';
import type { Category } from '@/platform/services/model/category';
import {
  BATTERY_INCLUDED_BREADCRUMB_FILTER,
  getBatteryIncludedCategoryMetadata,
} from '@/platform/services/model/category/batteryincluded-category';
import { parseCategoryIdsFilterValue } from './parse-category-ids-filter';

type CategoryFilterValue = string | string[] | Record<string, string> | undefined | null;

const LEGACY_BATTERY_INCLUDED_BREADCRUMB_FILTER = '_product_i18n.categories.breadcrumbs.displayPath';

export function parseFlatCategoryFilterValue(value: CategoryFilterValue): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => String(entry).trim()).filter(Boolean))];
  }
  return [];
}

export function buildBatteryIncludedFacetValueIdIndex(
  navigationRoots: readonly Category[] | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  walkCategoryTree(navigationRoots, (node) => {
    const metadata = getBatteryIncludedCategoryMetadata(node);
    if (metadata?.facetValue && !out[metadata.facetValue]) {
      out[metadata.facetValue] = node.id;
    }
  });
  return out;
}

export function resolveSelectedCategoryIdFromFilters(
  activeFilters: Record<string, CategoryFilterValue>,
  navigationRoots: readonly Category[] | undefined,
): string | undefined {
  const categoryIds = parseCategoryIdsFilterValue(activeFilters.categoryIds);
  if (categoryIds.length > 0) {
    return categoryIds[0];
  }

  const facetValues = parseFlatCategoryFilterValue(
    activeFilters[BATTERY_INCLUDED_BREADCRUMB_FILTER] ?? activeFilters[LEGACY_BATTERY_INCLUDED_BREADCRUMB_FILTER],
  );
  if (facetValues.length === 0) {
    return undefined;
  }

  const idIndex = buildBatteryIncludedFacetValueIdIndex(navigationRoots);
  return facetValues.map((value) => idIndex[value]).find(Boolean);
}

export function isDedicatedCategorySelectionFilter(facetId: string): boolean {
  return facetId === 'categoryIds' || facetId === BATTERY_INCLUDED_BREADCRUMB_FILTER;
}
