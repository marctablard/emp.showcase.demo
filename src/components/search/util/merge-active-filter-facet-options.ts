import { isDedicatedCategorySelectionFilter } from '@/lib/search/category-selection';
import type { BatteryIncludedFacet, SearchFilterValue } from '@/platform/services/model/common';
import { getFilterLabelFallback } from './search';

export function getActiveFacetValues(value: SearchFilterValue | undefined): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

function isRangeFilterValue(value: SearchFilterValue | undefined): value is { from?: string; till?: string } {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (typeof (value as { from?: unknown }).from === 'string' || typeof (value as { till?: unknown }).till === 'string')
  );
}

/**
 * Category-selection filters are surfaced through the category tree, never as facet sections.
 * Guard both the dedicated helper and any `category`-shaped key so breadcrumb/displayPath
 * filters are never synthesized into a checkbox facet.
 */
function isCategorySelectionFacetId(facetId: string): boolean {
  return isDedicatedCategorySelectionFilter(facetId) || /category/i.test(facetId);
}

/**
 * Builds facet sections for filters that are active in the query but absent from the current
 * facet response. This keeps applied facets visible (and removable/adjustable) even when the
 * BatteryIncluded search returns no products and therefore omits the facet definitions.
 */
function synthesizeMissingActiveFacets(
  facets: BatteryIncludedFacet[],
  activeFilters: Record<string, SearchFilterValue>,
): BatteryIncludedFacet[] {
  const existingFacetIds = new Set(facets.map((facet) => facet.id));
  const synthesized: BatteryIncludedFacet[] = [];

  for (const [facetId, value] of Object.entries(activeFilters)) {
    if (existingFacetIds.has(facetId) || isCategorySelectionFacetId(facetId)) {
      continue;
    }

    const label = getFilterLabelFallback(facetId);

    if (isRangeFilterValue(value)) {
      const till = typeof value.till === 'string' ? value.till : undefined;

      synthesized.push({
        kind: 'range',
        id: facetId,
        label,
        min: '0',
        max: till,
      });
      continue;
    }

    const activeValues = getActiveFacetValues(value);
    if (activeValues.length === 0) {
      continue;
    }

    synthesized.push({
      kind: 'select',
      id: facetId,
      label,
      options: activeValues.map((activeValue) => ({
        id: activeValue,
        label: activeValue,
        active: true,
        count: undefined,
      })),
    });
  }

  return synthesized;
}

export function mergeActiveFilterFacetOptions(
  facets: BatteryIncludedFacet[] | undefined,
  activeFilters: Record<string, SearchFilterValue>,
): BatteryIncludedFacet[] {
  const baseFacets = facets ?? [];

  const mergedFacets = baseFacets.map((facet) => {
    if (facet.kind !== 'select' && facet.kind !== 'rating') {
      return facet;
    }

    const activeValues = getActiveFacetValues(activeFilters[facet.id]);
    if (activeValues.length === 0) {
      return facet;
    }

    const existingOptionIds = new Set(facet.options.map((option) => option.id));
    const missingValues = activeValues.filter((value) => !existingOptionIds.has(value));

    if (missingValues.length === 0) {
      return facet;
    }

    const newOptions = missingValues.map((value) => ({
      id: value,
      label: value,
      active: true,
      count: undefined,
    }));

    return {
      ...facet,
      options: [...facet.options, ...newOptions],
    };
  });

  return [...mergedFacets, ...synthesizeMissingActiveFacets(mergedFacets, activeFilters)];
}
