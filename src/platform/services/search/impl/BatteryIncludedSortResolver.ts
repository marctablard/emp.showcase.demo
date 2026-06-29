import type { BatteryIncludedFacetCount } from '@/platform/integrations/batteryincluded/model';
import type { SearchSortDirection, SearchSortOption } from '@/platform/services/model/common';
import {
  buildBatteryIncludedSortToken,
  getBatteryIncludedSortDirections,
  isBatteryIncludedResponseDrivenSortField,
  isBatteryIncludedSortFacet,
  parseBatteryIncludedSortToken,
  resolveBatteryIncludedSortLabel,
} from './BatteryIncludedSortContract';

const BATTERY_INCLUDED_SAFE_FALLBACK_SORTS: SearchSortOption[] = [
  {
    id: '_product_i18n.brand.name',
    label: 'Brand',
    directions: ['asc', 'desc'],
    defaultDirection: 'asc',
  },
];

export interface ResolvedBatteryIncludedSort {
  canonicalSort: string;
  upstreamSort: string;
}

export const resolveBatteryIncludedAvailableSorts = (facetCounts?: BatteryIncludedFacetCount[]): SearchSortOption[] => {
  if (!facetCounts?.length) {
    return BATTERY_INCLUDED_SAFE_FALLBACK_SORTS;
  }

  const explicitSorts = facetCounts
    .filter((facet) => isBatteryIncludedSortFacet(facet))
    .map((facet) => {
      const directions = getBatteryIncludedSortDirections(facet);
      const defaultDirection: SearchSortDirection = directions.includes('asc') ? 'asc' : directions[0];

      return {
        id: facet.field_name,
        label: resolveBatteryIncludedSortLabel(facet),
        directions,
        defaultDirection,
      };
    });

  if (explicitSorts.length > 0) {
    return explicitSorts;
  }

  return BATTERY_INCLUDED_SAFE_FALLBACK_SORTS;
};

export const resolveBatteryIncludedSort = (
  sort: string | undefined,
  availableSorts?: SearchSortOption[],
): ResolvedBatteryIncludedSort | undefined => {
  const parsed = parseBatteryIncludedSortToken(sort);
  if (!parsed) {
    return undefined;
  }

  const matchingSort = availableSorts?.find((sortOption) => sortOption.id === parsed.fieldName);
  if (matchingSort) {
    if (!matchingSort.directions.includes(parsed.direction)) {
      return undefined;
    }
  } else {
    const fallbackSort = BATTERY_INCLUDED_SAFE_FALLBACK_SORTS.find((sortOption) => sortOption.id === parsed.fieldName);

    if (fallbackSort) {
      if (!fallbackSort.directions.includes(parsed.direction)) {
        return undefined;
      }
    } else if (!isBatteryIncludedResponseDrivenSortField(parsed.fieldName)) {
      return undefined;
    }
  }

  const canonicalSort = buildBatteryIncludedSortToken(parsed.fieldName, parsed.direction);

  return {
    canonicalSort,
    upstreamSort: canonicalSort,
  };
};

export const normalizeBatteryIncludedSort = (sort: string | undefined): string | undefined => {
  const parsed = parseBatteryIncludedSortToken(sort);
  return parsed ? buildBatteryIncludedSortToken(parsed.fieldName, parsed.direction) : undefined;
};
