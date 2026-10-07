import { isDedicatedCategorySelectionFilter } from './category-selection';

export function getAppliedFilterCount(activeFilters: Record<string, unknown>): number {
  return Object.keys(activeFilters).filter((facetId) => !isDedicatedCategorySelectionFilter(facetId)).length;
}
