import { sanitizeCategoryFilters } from '@/lib/search/sanitize-category-filters';
import type { SearchParams } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import { extractFiltersFromSearchParams } from '@/utils/filterUtils';

function firstStringParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Segment scope of the current customer in `assigned` products mode (COP-4822).
 * Resolved server-side (`getProductsModeContext` + `getSegmentCategoryScope`); never taken from the URL.
 */
export interface BrowseSegmentScope {
  segmentIds: string[];
  /** Category ids accepted by the AC5 filter sanitiser (`SegmentCategoryScope.allowedCategoryIds`). */
  allowedCategoryIds: string[];
}

export function createBrowseInitialSearch(
  rawParams: Record<string, string | string[]>,
  site: string,
  locale: string,
  scope?: BrowseSegmentScope,
): { initialSearch: SearchParams<Product>; q?: string } {
  const q = firstStringParam(rawParams.q);
  const page = firstStringParam(rawParams.page);
  const size = firstStringParam(rawParams.size);
  const sort = firstStringParam(rawParams.sort);

  const rawFilters = extractFiltersFromSearchParams(rawParams);
  const filters = Object.keys(rawFilters).length > 0 ? rawFilters : undefined;

  const initialSearch: SearchParams<Product> = {
    page: page ? Number.parseInt(page, 10) : 0,
    size: size ? Number.parseInt(size, 10) : 12,
    query: q,
    sort,
    filters: scope ? sanitizeCategoryFilters(filters, scope.allowedCategoryIds) : filters,
    ...(scope ? { segmentIds: scope.segmentIds } : {}),
    site,
    locale,
  };

  return { initialSearch, q };
}
