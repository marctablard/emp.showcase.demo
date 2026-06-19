import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Pill } from '@/components/ui/pill';
import { type ProductFilterKey, dk } from '@/i18n/dynamic-key';
import { isDedicatedCategorySelectionFilter, parseFlatCategoryFilterValue } from '@/lib/search/category-selection';
import { parseCategoryIdsFilterValue } from '@/lib/search/parse-category-ids-filter';
import { BATTERY_INCLUDED_BREADCRUMB_FILTER } from '@/platform/services/model/category/batteryincluded-category';
import type { BatteryIncludedFacet, SearchFilterValue } from '@/platform/services/model/common';
import { getFilterLabelFallback } from './util/search';

type CategorySelectionFilterValue = string | string[] | Record<string, string>;

function isCategorySelectionFilterValue(value: SearchFilterValue): value is CategorySelectionFilterValue {
  if (typeof value === 'string' || Array.isArray(value)) {
    return true;
  }

  return Object.values(value).every((entry) => typeof entry === 'string');
}

interface SearchActiveFiltersProps {
  activeFilters: Record<string, SearchFilterValue>;
  resetFacet: (facetId: string) => void;
  resetAllFacets: () => void;
  categoryFilterLabelsById?: Record<string, string>;
  batteryIncludedFacets?: BatteryIncludedFacet[];
}

function formatRangeFacetValue(value: Record<string, string | string[]>) {
  const from = typeof value.from === 'string' ? value.from : undefined;
  const till = typeof value.till === 'string' ? value.till : undefined;

  if (from && till) {
    return `${from} - ${till}`;
  }
  if (from) {
    return `>= ${from}`;
  }
  if (till) {
    return `<= ${till}`;
  }

  return Object.entries(value)
    .map(([key, entry]) => `${key}: ${entry}`)
    .join(', ');
}

export function SearchActiveFilters({
  activeFilters,
  resetFacet,
  categoryFilterLabelsById,
  batteryIncludedFacets,
}: SearchActiveFiltersProps) {
  const t = useTranslations('product');
  const filters = Object.entries(activeFilters);
  const batteryIncludedFacetsById = new Map(batteryIncludedFacets?.map((facet) => [facet.id, facet]) ?? []);

  const getFilterTitle = (facetId: string): string => {
    const batteryIncludedFacetLabel = batteryIncludedFacetsById.get(facetId)?.label;

    if (batteryIncludedFacetLabel) {
      return batteryIncludedFacetLabel;
    }

    const labelId = isDedicatedCategorySelectionFilter(facetId) ? 'categoryIds' : facetId;
    return t(dk<ProductFilterKey>(`filters.${labelId}`), {
      defaultValue: getFilterLabelFallback(labelId),
    });
  };

  const formatFilterValue = (facetId: string, value: SearchFilterValue): string => {
    if (facetId === 'categoryIds') {
      if (!isCategorySelectionFilterValue(value)) {
        return '';
      }

      const ids = parseCategoryIdsFilterValue(value);
      if (ids.length === 0) {
        return '';
      }
      return ids.map((id) => categoryFilterLabelsById?.[id] ?? id).join(', ');
    }
    if (facetId === BATTERY_INCLUDED_BREADCRUMB_FILTER) {
      if (!isCategorySelectionFilterValue(value)) {
        return '';
      }

      const values = parseFlatCategoryFilterValue(value);
      if (values.length === 0) {
        return '';
      }
      return values.map((entry) => categoryFilterLabelsById?.[entry] ?? entry).join(', ');
    }

    const batteryIncludedFacet = batteryIncludedFacetsById.get(facetId);
    if (batteryIncludedFacet?.kind === 'range' && value && typeof value === 'object' && !Array.isArray(value)) {
      return formatRangeFacetValue(value);
    }

    const resolveBatteryIncludedLabel = (candidate: string): string => {
      if (!batteryIncludedFacet || batteryIncludedFacet.kind === 'range') {
        return candidate;
      }

      const matchingOption = batteryIncludedFacet.options.find((option) => option.id === candidate);
      return matchingOption?.label ?? candidate;
    };

    if (typeof value === 'string') {
      return resolveBatteryIncludedLabel(value);
    }
    if (Array.isArray(value)) {
      return value.map(resolveBatteryIncludedLabel).join(', ');
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
              label={getFilterTitle(id)}
              value={formatFilterValue(id, value)}
              onClick={() => resetFacet(id)}
            />
          );
        })}
    </>
  );
}
