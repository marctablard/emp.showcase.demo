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

function buildCategoryDepthIndex(navigationRoots: readonly Category[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  walkCategoryTree(navigationRoots, (node, ancestors) => {
    out[node.id] = ancestors.length + 1;
  });
  return out;
}

function resolveDeepestCategoryId(
  candidateIds: readonly string[],
  navigationRoots: readonly Category[] | undefined,
): string | undefined {
  if (candidateIds.length === 0) {
    return undefined;
  }

  const depthById = buildCategoryDepthIndex(navigationRoots);
  let bestId: string | undefined;
  let bestDepth = -1;

  for (const candidateId of candidateIds) {
    const depth = depthById[candidateId];
    if (depth === undefined) {
      continue;
    }
    if (depth > bestDepth) {
      bestId = candidateId;
      bestDepth = depth;
    }
  }

  return bestId ?? candidateIds[0];
}

export function resolveSelectedCategoryIdFromFilters(
  activeFilters: Record<string, CategoryFilterValue>,
  navigationRoots: readonly Category[] | undefined,
): string | undefined {
  const categoryIds = parseCategoryIdsFilterValue(activeFilters.categoryIds);
  if (categoryIds.length > 0) {
    return resolveDeepestCategoryId(categoryIds, navigationRoots);
  }

  const facetValues = parseFlatCategoryFilterValue(
    activeFilters[BATTERY_INCLUDED_BREADCRUMB_FILTER] ?? activeFilters[LEGACY_BATTERY_INCLUDED_BREADCRUMB_FILTER],
  );
  if (facetValues.length === 0) {
    return undefined;
  }

  const idIndex = buildBatteryIncludedFacetValueIdIndex(navigationRoots);
  return resolveDeepestCategoryId(
    facetValues.map((value) => idIndex[value]).filter((value): value is string => Boolean(value)),
    navigationRoots,
  );
}

export function isDedicatedCategorySelectionFilter(facetId: string): boolean {
  return facetId === 'categoryIds' || facetId === BATTERY_INCLUDED_BREADCRUMB_FILTER;
}
