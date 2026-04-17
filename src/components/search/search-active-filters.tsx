import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Pill } from '@/components/ui/pill';
import type { FilterValue as SearchFilterValue } from '@/hooks/search/useSearch';
import { type ProductFilterKey, dk } from '@/i18n/dynamic-key';
import { parseCategoryIdsFilterValue } from '@/lib/search/parse-category-ids-filter';

interface SearchActiveFiltersProps {
  activeFilters: Record<string, SearchFilterValue>;
  resetFacet: (facetId: string) => void;
  resetAllFacets: () => void;
  categoryFilterLabelsById?: Record<string, string>;
}

export function SearchActiveFilters({ activeFilters, resetFacet, categoryFilterLabelsById }: SearchActiveFiltersProps) {
  const t = useTranslations('product');
  const filters = Object.entries(activeFilters);

  const formatFilterValue = (facetId: string, value: SearchFilterValue): string => {
    if (facetId === 'categoryIds') {
      const ids = parseCategoryIdsFilterValue(value);
      if (ids.length === 0) {
        return '';
      }
      return ids.map((id) => categoryFilterLabelsById?.[id] ?? id).join(', ');
    }
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (value && typeof value === 'object') {
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
              value={formatFilterValue(id, value)}
              onClick={() => resetFacet(id)}
            />
          );
        })}
    </>
  );
}
