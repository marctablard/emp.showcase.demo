import type { BatteryIncludedFacetCount } from '@/platform/integrations/batteryincluded/model';
import type { SearchSortDirection } from '@/platform/services/model/common';

export const BATTERY_INCLUDED_SORT_TOKEN_DELIMITER = ':';

const SEARCH_SORT_DIRECTION_VALUES: SearchSortDirection[] = ['asc', 'desc'];
const BATTERY_INCLUDED_RESPONSE_DRIVEN_SORT_FIELD_PATTERN = /^[A-Za-z0-9_]+$/;

const normalizeSearchSortDirection = (value: string): SearchSortDirection | undefined => {
  const normalized = value.trim().toLowerCase();
  return SEARCH_SORT_DIRECTION_VALUES.find((direction) => direction === normalized);
};

export const parseBatteryIncludedSortToken = (
  sort?: string,
): {
  fieldName: string;
  direction: SearchSortDirection;
} | null => {
  if (!sort) {
    return null;
  }

  const [fieldName, rawDirection, ...rest] = sort.split(BATTERY_INCLUDED_SORT_TOKEN_DELIMITER);
  if (!fieldName?.trim() || !rawDirection || rest.length > 0) {
    return null;
  }

  const direction = normalizeSearchSortDirection(rawDirection);
  if (!direction) {
    return null;
  }

  return {
    fieldName: fieldName.trim(),
    direction,
  };
};

export const buildBatteryIncludedSortToken = (fieldName: string, direction: SearchSortDirection): string =>
  `${fieldName}${BATTERY_INCLUDED_SORT_TOKEN_DELIMITER}${direction}`;

export const isBatteryIncludedResponseDrivenSortField = (fieldName: string): boolean => {
  const normalizedFieldName = fieldName.trim();

  return (
    normalizedFieldName.length > 0 && BATTERY_INCLUDED_RESPONSE_DRIVEN_SORT_FIELD_PATTERN.test(normalizedFieldName)
  );
};

const resolveBatteryIncludedSortDirection = (
  facet: BatteryIncludedFacetCount,
  rowValue: string,
): SearchSortDirection | undefined => {
  const direction = normalizeSearchSortDirection(rowValue);
  if (direction) {
    return direction;
  }

  const parsed = parseBatteryIncludedSortToken(rowValue);
  return parsed && parsed.fieldName === facet.field_name.trim() ? parsed.direction : undefined;
};

export const getBatteryIncludedSortDirections = (facet: BatteryIncludedFacetCount): SearchSortDirection[] => {
  if (facet.type !== 'select' || !facet.counts?.length) {
    return [];
  }

  const directions: SearchSortDirection[] = [];

  for (const row of facet.counts) {
    const direction = resolveBatteryIncludedSortDirection(facet, row.value);
    if (!direction || directions.includes(direction)) {
      return [];
    }

    directions.push(direction);
  }

  return directions;
};

export const isBatteryIncludedSortFacet = (facet: BatteryIncludedFacetCount): boolean => {
  return facet.field_name.trim().length > 0 && getBatteryIncludedSortDirections(facet).length > 0;
};

export const resolveBatteryIncludedSortLabel = (facet: BatteryIncludedFacetCount): string => {
  const fieldLabel = facet.field_label?.trim();
  return fieldLabel && fieldLabel.length > 0 ? fieldLabel : facet.field_name;
};
