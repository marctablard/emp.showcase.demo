import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Pill } from '@/components/ui/pill';
import type { FilterValue as SearchFilterValue } from '@/hooks/search/useSearch';
import { type ProductFilterKey, dk } from '@/i18n/dynamic-key';

interface SearchActiveFiltersProps {
  activeFilters: Record<string, SearchFilterValue>;
  resetFacet: (facetId: string) => void;
  resetAllFacets: () => void;
}

export function SearchActiveFilters({ activeFilters, resetFacet }: SearchActiveFiltersProps) {
  const t = useTranslations('product');
  const filters = Object.entries(activeFilters);

  // Helper function to format filter values for display
  const formatFilterValue = (value: SearchFilterValue): string => {
    if (typeof value === 'string') {
      return value;
    } else if (Array.isArray(value)) {
      return value.join(', ');
    } else if (value && typeof value === 'object') {
      // Handle Record<string, string>
      return Object.entries(value)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    }
    return '';
  };

  return (
    <>
      {filters &&
        filters.map(([id, value]) => {
          return (
            <Pill
              trailingIcon={<X />}
              key={id}
              label={t(dk<ProductFilterKey>(`filters.${id}`))}
              value={formatFilterValue(value)}
              onClick={() => resetFacet(id)}
            />
          );
        })}
    </>
  );
}
