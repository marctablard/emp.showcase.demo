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

function decodeBase64Payload(base64: string): string {
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(base64);
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Reads the legal-entity claim without validating or exposing the JWT.
 * Token signature validation remains the responsibility of the OAuth/API layer.
 */
export function decodeTokenLegalEntityId(...tokens: Array<string | undefined>): string | undefined {
  for (const token of tokens) {
    if (!token) {
      continue;
    }
    try {
      const payload = token.split('.')[1];
      if (!payload) {
        continue;
      }
      const base64 = payload
        .replaceAll('-', '+')
        .replaceAll('_', '/')
        .padEnd(Math.ceil(payload.length / 4) * 4, '=');
      const decoded = JSON.parse(decodeBase64Payload(base64)) as {
        legalEntityId?: unknown;
        legal_entity_id?: unknown;
        context?: unknown;
      };
      const context =
        decoded.context && typeof decoded.context === 'object'
          ? (decoded.context as { legalEntityId?: unknown })
          : undefined;
      const candidate = decoded.legalEntityId ?? decoded.legal_entity_id ?? context?.legalEntityId;
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    } catch {
      // A missing or malformed claim keeps the existing unscoped refresh behavior.
    }
  }
  return undefined;
}
