import {
  buildBatteryIncludedSortToken,
  isBatteryIncludedResponseDrivenSortField,
  parseBatteryIncludedSortToken,
} from './BatteryIncludedSortContract';
import type { SearchSortOption } from '@/platform/services/model/common';

export const BATTERY_INCLUDED_SORT_TOKEN_DELIMITER = ':';

export const BATTERY_INCLUDED_DEFAULT_SORTS: SearchSortOption[] = [
  {
    id: '_product_i18n.{locale}.name',
    labelKey: 'name',
    directions: ['asc', 'desc'],
    defaultDirection: 'asc',
  },
  {
    id: '_product_siteAware.{siteAware}.currencyAware.{currencyAware}.countryAware.{countryAware}.price.effectiveAmount',
    labelKey: 'price',
    directions: ['asc', 'desc'],
    defaultDirection: 'asc',
  },
];

export interface ResolvedBatteryIncludedSort {
  canonicalSort: string;
  upstreamSort: string;
}

export const resolveBatteryIncludedSort = (
  sort: string | undefined,
): ResolvedBatteryIncludedSort | undefined => {
  const parsed = parseBatteryIncludedSortToken(sort);
  if (!parsed) {
    return undefined;
  }

  if (!isBatteryIncludedResponseDrivenSortField(parsed.fieldName)) {
    return undefined;
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
