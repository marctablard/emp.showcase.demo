import type { SearchFilters } from '@/platform/services/model/common';
import {
  BATTERY_INCLUDED_CATEGORY_IDS_FILTER,
  BATTERY_INCLUDED_PUBLISHED_FILTER,
} from '@/platform/services/model/category/batteryincluded-category';
import type { BatteryIncludedBrowseVariables, BatteryIncludedVisibilityFilters } from '@/platform/integrations/batteryincluded/model';

export interface BatteryIncludedVisibilitySource {
  locale?: string;
  site?: string;
  country?: string;
  currency?: string;
}

function normalizeCategoryIds(values: readonly string[]): string[] {
  const seen = new Set<string>();

  values.forEach((value) => {
    const normalized = value.trim();
    if (normalized.length > 0) {
      seen.add(normalized);
    }
  });

  return [...seen];
}

function toCategoryIdArray(value: SearchFilters[string] | undefined): string[] | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : undefined;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = normalizeCategoryIds(value);
  return normalized.length > 0 ? normalized : undefined;
}

export function buildBatteryIncludedVisibilityVariables(
  source: BatteryIncludedVisibilitySource,
): BatteryIncludedBrowseVariables {
  return {
    ...(source.locale ? { locale: source.locale } : {}),
    ...(source.site ? { siteAware: source.site } : {}),
    ...(source.country ? { countryAware: source.country } : {}),
    ...(source.currency ? { currencyAware: source.currency } : {}),
  };
}

export function buildBatteryIncludedVisibilityFilters(
  rootCategoryIds: readonly string[],
): BatteryIncludedVisibilityFilters | null {
  const normalizedRootCategoryIds = normalizeCategoryIds(rootCategoryIds);
  if (normalizedRootCategoryIds.length === 0) {
    return null;
  }

  return {
    [BATTERY_INCLUDED_PUBLISHED_FILTER]: 'true',
    [BATTERY_INCLUDED_CATEGORY_IDS_FILTER]: normalizedRootCategoryIds,
  };
}

export function mergeBatteryIncludedVisibilityFilters(
  filters: SearchFilters | undefined,
  rootCategoryIds: readonly string[],
): SearchFilters | null {
  const scopedFilters = buildBatteryIncludedVisibilityFilters(rootCategoryIds);
  if (!scopedFilters) {
    return null;
  }

  const mergedFilters: SearchFilters = {
    ...(filters ?? {}),
    [BATTERY_INCLUDED_PUBLISHED_FILTER]: 'true',
  };

  const requestedCategoryIds = toCategoryIdArray(filters?.[BATTERY_INCLUDED_CATEGORY_IDS_FILTER]);
  if (requestedCategoryIds) {
    const publishedRootIds = new Set(scopedFilters[BATTERY_INCLUDED_CATEGORY_IDS_FILTER] as string[]);
    const intersectedCategoryIds = requestedCategoryIds.filter((id) => publishedRootIds.has(id));

    if (intersectedCategoryIds.length === 0) {
      return null;
    }

    mergedFilters[BATTERY_INCLUDED_CATEGORY_IDS_FILTER] = intersectedCategoryIds;
  } else {
    mergedFilters[BATTERY_INCLUDED_CATEGORY_IDS_FILTER] = scopedFilters[BATTERY_INCLUDED_CATEGORY_IDS_FILTER] as string[];
  }

  return mergedFilters;
}