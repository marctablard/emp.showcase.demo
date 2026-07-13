import type { EmporixPaginatedResponse, EmporixSearchParams } from '../../model';

const RAW_SEARCH_CRITERIA_KEY = 'compoundLogicalQuery';

/**
 * Translate Search Parameters to Query and Body (for POST)
 * @param params
 * @returns { body : q-Parameter for Search-Criteria, query : Query-Parameters }
 */
export function buildSearchQuery<T>(
  params: EmporixSearchParams<T>,
  filterAsQuery: boolean = false,
): { body: string; query: string } {
  const queryParams = new URLSearchParams();

  if (params.page) {
    queryParams.append('pageNumber', params.page.toString());
  }
  if (params.size) {
    queryParams.append('pageSize', params.size.toString());
  }
  if (params.sort) {
    queryParams.append('sort', params.sort);
  }
  if (params.expand) {
    queryParams.append('expand', params.expand.join(','));
  }
  let query: string = params.query ?? '';
  if (params.criteria) {
    Object.entries(params.criteria).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      if (filterAsQuery) {
        queryParams.append(key, '' + value);
      } else {
        if (query.length > 0) {
          query += ' ';
        }
        const strValue = String(value);
        if (key === RAW_SEARCH_CRITERIA_KEY) {
          query += strValue;
          return;
        }

        const safeValue = strValue.includes(' ') && !strValue.startsWith('(') ? `(${strValue})` : strValue;
        query += `${key}:${safeValue}`;
      }
    });
  }

  return { body: query, query: filterAsQuery ? queryParams.toString() : queryParams.toString() };
}

/**
 * Emporix list endpoints may return a JSON array or a wrapper `{ items: [...] }`.
 * Using a non-array as `items` breaks `.map()` downstream.
 */
export function extractItemsFromPaginatedJsonBody<T>(body: unknown): T[] {
  if (Array.isArray(body)) {
    return body as T[];
  }
  if (
    body !== null &&
    typeof body === 'object' &&
    'items' in body &&
    Array.isArray((body as { items: unknown }).items)
  ) {
    return (body as { items: T[] }).items;
  }
  return [];
}

/**
 * Builds a PaginatedResponse object from a HTTP Response object
 * @param params search parameters
 * @param response HTTP response object
 * @returns PaginatedResponse object
 */
export async function buildPaginatedResponse<T>(
  params: EmporixSearchParams<any>,
  response: Response,
): Promise<EmporixPaginatedResponse<T>> {
  const total: number = Number(response.headers.get('x-total-count')) || -1;
  const body: unknown = await response.json();
  const items = extractItemsFromPaginatedJsonBody<T>(body);

  if (Array.isArray(body)) {
    return {
      items,
      page: params.page || 0,
      size: params.size || 20,
      total,
    };
  }

  const paginatedBody = body as {
    page?: number;
    size?: number;
    total?: number;
  };

  return {
    items,
    page: paginatedBody.page ?? (params.page || 0),
    size: paginatedBody.size ?? (params.size || 20),
    total: paginatedBody.total ?? total,
  };
}

export function checkTokenValidity(token?: string, expiryAt?: number, threshold: number = 6000): boolean {
  if (!token) {
    return false;
  }
  if (!expiryAt) {
    return true;
  }
  return Date.now() <= expiryAt - threshold;
}
