import type { BatteryIncludedSearchParams } from '@/platform/integrations/batteryincluded/model';
import type { SearchFilterValue, SearchFilters } from '@/platform/services/model/common';

type BatteryIncludedFilters = NonNullable<BatteryIncludedSearchParams<unknown>['filters']>;

const RANGE_FILTER_KEYS = new Set(['from', 'till']);

function normalizeScalarFilterValue(value: string | string[]): string | string[] | undefined {
  if (Array.isArray(value)) {
    const normalized = value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    return normalized.length > 0 ? normalized : undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeRangeFilterValue(value: SearchFilterValue): Record<string, string> | undefined {
  if (typeof value === 'string' || Array.isArray(value)) {
    return undefined;
  }

  const normalized = Object.entries(value).reduce<Record<string, string>>((accumulator, [nestedKey, nestedValue]) => {
    if (!RANGE_FILTER_KEYS.has(nestedKey) || typeof nestedValue !== 'string') {
      return accumulator;
    }

    const trimmedValue = nestedValue.trim();
    if (trimmedValue.length > 0) {
      accumulator[nestedKey] = trimmedValue;
    }

    return accumulator;
  }, {});

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export class BatteryIncludedFacetsQueryBuilder {
  static build(filters?: SearchFilters): BatteryIncludedFilters | undefined {
    if (!filters) {
      return undefined;
    }

    const normalizedFilters = Object.entries(filters).reduce<BatteryIncludedFilters>((accumulator, [key, value]) => {
      const normalizedValue =
        typeof value === 'string' || Array.isArray(value)
          ? normalizeScalarFilterValue(value)
          : normalizeRangeFilterValue(value);

      if (normalizedValue !== undefined) {
        accumulator[key] = normalizedValue;
      }

      return accumulator;
    }, {});

    return Object.keys(normalizedFilters).length > 0 ? normalizedFilters : undefined;
  }
}
