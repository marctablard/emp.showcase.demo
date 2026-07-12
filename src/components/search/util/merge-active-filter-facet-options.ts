import type { BatteryIncludedFacet, SearchFilterValue } from '@/platform/services/model/common';

export function getActiveFacetValues(value: SearchFilterValue | undefined): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

export function mergeActiveFilterFacetOptions(
  facets: BatteryIncludedFacet[] | undefined,
  activeFilters: Record<string, SearchFilterValue>,
): BatteryIncludedFacet[] {
  if (!facets) {
    return [];
  }

  return facets.map((facet) => {
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
}
