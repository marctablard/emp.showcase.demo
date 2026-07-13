import { SearchActiveFilters } from '@/components/search/search-active-filters';
import type { BatteryIncludedFacet, SearchFilterValue } from '@/platform/services/model/common';

interface SearchActiveFiltersWithResetProps {
  activeFilters: Record<string, SearchFilterValue>;
  resetFacet: (key: string) => void;
  resetAllFacets: () => void;
  resetLabel: string;
  categoryFilterLabelsById?: Record<string, string>;
  batteryIncludedFacets?: BatteryIncludedFacet[];
}

export function SearchActiveFiltersWithReset({
  activeFilters,
  resetFacet,
  resetAllFacets,
  resetLabel,
  categoryFilterLabelsById,
  batteryIncludedFacets,
}: SearchActiveFiltersWithResetProps) {
  return (
    <SearchActiveFilters
      activeFilters={activeFilters}
      resetFacet={resetFacet}
      resetAllFacets={resetAllFacets}
      categoryFilterLabelsById={categoryFilterLabelsById}
      batteryIncludedFacets={batteryIncludedFacets}
    />
  );
}
