import type { Return } from '@/platform/services/model/return';

const REQUEST_CACHE_TTL_MS = 60_000;
const returnsRequestCache = new Map<string, { expiresAt: number; value: ReturnsPageResult }>();
const inflightReturnsRequests = new Map<string, Promise<ReturnsPageResult>>();

/**
 * Item to return - contains item ID and quantity
 */
export interface CreateReturnItem {
  id: string;
  quantity: number;
  reasonCode?: ReturnReasonCode;
  reasonDetails?: string;
}

/**
 * Return reason code - mandatory per Emporix Returns API
 */
export type ReturnReasonCode = 'DEFECTIVE' | 'WRONG_ITEM' | 'NOT_AS_DESCRIBED' | 'CHANGED_MIND' | 'SIZE_FIT' | 'OTHER';

export const RETURN_REASON_CODES: ReturnReasonCode[] = [
  'DEFECTIVE',
  'WRONG_ITEM',
  'NOT_AS_DESCRIBED',
  'CHANGED_MIND',
  'SIZE_FIT',
  'OTHER',
];

/**
 * Response from create return API
 */
export interface CreateReturnResponse {
  id: string;
}

export interface ReturnsPageResult {
  items: Return[];
  totalCount?: number;
}

/**
 * Create a new return for an order
 * @param orderId The ID of the order to create return for
 * @param items Array of items to return with quantities
 * @returns Promise with the created return ID
 */
export async function createReturn(
  orderId: string,
  items: CreateReturnItem[],
  reasonCode: ReturnReasonCode,
  reasonDetails?: string,
): Promise<CreateReturnResponse> {
  const normalizedReasonDetails = typeof reasonDetails === 'string' ? reasonDetails.trim() : '';
  const response = await fetch('/api/returns', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orderId,
      items,
      reasonCode,
      reasonDetails: normalizedReasonDetails || undefined,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create return');
  }

  return response.json();
}

/**
 * Fetch returns for the current customer with optional filtering.
 * @param options.pageSize Page size (default: 60, API max: 60)
 * @param options.pageNumber Page number (default: 1)
 * @param options.query Emporix q-parameter value for server-side filtering
 */
export async function fetchReturns(
  pageSize?: number,
  pageNumber?: number,
  query?: string,
  sort?: string,
  forceRefresh: boolean = false,
): Promise<Return[]> {
  const result = await fetchReturnsPage(pageSize, pageNumber, query, sort, forceRefresh);
  return result.items;
}

export async function fetchReturnsPage(
  pageSize?: number,
  pageNumber?: number,
  query?: string,
  sort?: string,
  forceRefresh: boolean = false,
): Promise<ReturnsPageResult> {
  const params = new URLSearchParams();
  if (pageSize) params.set('pageSize', pageSize.toString());
  if (pageNumber) params.set('pageNumber', pageNumber.toString());
  if (query) params.set('query', query);
  if (sort) params.set('sort', sort);

  const queryString = params.toString();
  const url = `/api/returns${queryString ? `?${queryString}` : ''}`;
  if (!forceRefresh) {
    const now = Date.now();
    const cached = returnsRequestCache.get(url);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }
  }

  const inflightRequest = inflightReturnsRequests.get(url);
  if (inflightRequest) {
    return inflightRequest;
  }
  const requestPromise = (async (): Promise<ReturnsPageResult> => {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch returns');
    }

    const totalCountHeader = response.headers.get('x-total-count');
    const parsedTotalCount = totalCountHeader ? parseInt(totalCountHeader, 10) : Number.NaN;
    const items = (await response.json()) as Return[];
    const value = {
      items,
      totalCount: Number.isFinite(parsedTotalCount) ? parsedTotalCount : undefined,
    };

    returnsRequestCache.set(url, {
      expiresAt: Date.now() + REQUEST_CACHE_TTL_MS,
      value,
    });

    return value;
  })();

  inflightReturnsRequests.set(url, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inflightReturnsRequests.delete(url);
  }
}

/**
 * Builds the Emporix `q` value to filter returns by one or more order IDs.
 * Uses the `orders._id` field supported by the Returns API.
 * @see https://developer.emporix.io/api-references-1/readme/api-reference-29/returns
 */
function buildOrderIdsQuery(orderIds: string[]): string {
  const uniqueSortedOrderIds = [...new Set(orderIds)].sort();
  if (uniqueSortedOrderIds.length === 1) {
    return `orders._id:${uniqueSortedOrderIds[0]}`;
  }
  return `orders._id:(${uniqueSortedOrderIds.join(',')})`;
}

/**
 * Fetch all returns that reference the given order IDs.
 * Filters server-side via the Emporix `q` parameter so pagination
 * is scoped per-order (a single order won't exceed 60 returns).
 */
export async function fetchReturnsForOrderIds(orderIds: string[]): Promise<Return[]> {
  if (orderIds.length === 0) return [];
  return fetchReturns(undefined, undefined, buildOrderIdsQuery(orderIds));
}

/**
 * Fetch all returns that reference a specific order.
 */
export async function fetchReturnsForOrder(orderId: string): Promise<Return[]> {
  return fetchReturnsForOrderIds([orderId]);
}

/**
 * Fetch a specific return by ID
 * @param returnId The ID of the return to fetch
 * @returns Promise with the return
 */
export async function fetchReturnById(returnId: string): Promise<Return> {
  const response = await fetch(`/api/returns/${returnId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Return not found');
    }
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch return');
  }

  return response.json();
}
