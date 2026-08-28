import type { SearchParams } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import { extractFiltersFromSearchParams } from '@/utils/filterUtils';

function firstStringParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function createBrowseInitialSearch(
  rawParams: Record<string, string | string[]>,
  customerSegments: boolean,
  site: string,
  locale: string,
): { initialSearch: SearchParams<Product>; q?: string } {
  const q = firstStringParam(rawParams.q);
  const page = firstStringParam(rawParams.page);
  const size = firstStringParam(rawParams.size);
  const sort = firstStringParam(rawParams.sort);

  const filters = extractFiltersFromSearchParams(rawParams);

  const initialSearch: SearchParams<Product> = {
    page: page ? Number.parseInt(page, 10) : 0,
    size: size ? Number.parseInt(size, 10) : 12,
    query: q,
    sort,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    customerSegments,
    site,
    locale,
  };

  return { initialSearch, q };
}
