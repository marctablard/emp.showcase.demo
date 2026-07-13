import { Trash2 } from 'lucide-react';
import { SearchActiveFilters } from '@/components/search/search-active-filters';
import { Pill } from '@/components/ui/pill';
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
}: Omit<SearchActiveFiltersWithResetProps, 'className'>) {
  return (
    <>
      <SearchActiveFilters
        activeFilters={activeFilters}
        resetFacet={resetFacet}
        resetAllFacets={resetAllFacets}
        categoryFilterLabelsById={categoryFilterLabelsById}
        batteryIncludedFacets={batteryIncludedFacets}
      />
      {Object.keys(activeFilters).length > 0 && (
        <span className="hidden md:block">
          <Pill variant="reset" leadingIcon={<Trash2 />} label={resetLabel} onClick={resetAllFacets} />
        </span>
      )}
    </>
  );
}
