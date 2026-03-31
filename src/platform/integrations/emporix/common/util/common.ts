import { EmporixPaginatedResponse, EmporixSearchParams } from '../../model';

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
  let query: string = '';
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
        const safeValue = String(value).includes(' ') ? `(${value})` : String(value);
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
  return {
    items,
    page: params.page || 0,
    size: params.size || 20,
    total: total,
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
