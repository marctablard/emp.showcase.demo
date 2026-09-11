import type { SearchFilterValue, SearchFilters } from '@/platform/services/model/common';

const CATEGORY_IDS_FILTER_KEY = 'categoryIds';

function toAllowedSet(allowedCategoryIds: ReadonlySet<string> | string[]): ReadonlySet<string> {
  return Array.isArray(allowedCategoryIds) ? new Set(allowedCategoryIds) : allowedCategoryIds;
}

function sanitizeCategoryIdsValue(
  value: SearchFilterValue,
  allowed: ReadonlySet<string>,
): SearchFilterValue | undefined {
  if (typeof value === 'string') {
    return allowed.has(value) ? value : undefined;
  }
  if (Array.isArray(value)) {
    const kept = value.filter((id) => allowed.has(id));
    return kept.length > 0 ? kept : undefined;
  }
  return undefined;
}

/**
 * Restricts the `categoryIds` filter to ids contained in the allowed set (COP-4822 AC5).
 *
 * - every non-`categoryIds` filter is kept untouched
 * - string / string[] `categoryIds` values keep only allowed ids
 * - the `categoryIds` key is removed when nothing remains
 * - returns `undefined` when the resulting filter set is empty
 *
 * Pure and I/O-free so it can be shared by API routes and server pages.
 */
/** `true` when the caller supplied a `categoryIds` filter (AC5 only needs a scope then). */
export function hasCategoryIdsFilter(filters: SearchFilters | undefined): boolean {
  return Boolean(filters && CATEGORY_IDS_FILTER_KEY in filters);
}

export function sanitizeCategoryFilters(
  filters: SearchFilters | undefined,
  allowedCategoryIds: ReadonlySet<string> | string[],
): SearchFilters | undefined {
  if (!filters) {
    return undefined;
  }
  if (!(CATEGORY_IDS_FILTER_KEY in filters)) {
    return Object.keys(filters).length > 0 ? filters : undefined;
  }

  const { [CATEGORY_IDS_FILTER_KEY]: categoryIds, ...rest } = filters;
  const sanitized = sanitizeCategoryIdsValue(categoryIds, toAllowedSet(allowedCategoryIds));
  const result: SearchFilters = sanitized === undefined ? rest : { ...rest, [CATEGORY_IDS_FILTER_KEY]: sanitized };

  return Object.keys(result).length > 0 ? result : undefined;
}
