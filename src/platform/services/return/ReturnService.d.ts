import { Return } from '../model/return';

/**
 * Paginated return list from upstream, including optional total for response headers.
 */
export interface ReturnListResult {
  items: Return[];
  /** Total number of matching returns when the upstream API provides it */
  totalCount?: number;
}

/**
 * Item to return - contains item ID and quantity
 */
export interface CreateReturnItem {
  id: string;
  quantity: number;
  reason?: {
    code: string;
    details?: string;
  };
}

/**
 * Interface for return service.
 * Defines methods for return operations.
 */
export interface ReturnService {
  /**
   * Get all returns for the current user
   * @param pageNumber Optional page number (default: 1)
   * @param pageSize Optional page size (default: 60)
   * @param sort Optional sort parameter
   * @param query Optional query parameter for filtering
   * @returns Promise with array of returns
   */
  getReturns(pageNumber?: number, pageSize?: number, sort?: string, query?: string): Promise<Return[]>;

  /**
   * List returns with optional total count (for APIs that expose `x-total-count`).
   * @param pageNumber Optional page number (default: 1)
   * @param pageSize Optional page size (default: 60)
   * @param sort Optional sort parameter
   * @param query Optional query parameter for filtering
   */
  listReturns(pageNumber?: number, pageSize?: number, sort?: string, query?: string): Promise<ReturnListResult>;

  /**
   * Get a specific return by ID
   * @param returnId The ID of the return to retrieve
   * @returns Promise with the return or undefined if not found
   */
  getReturn(returnId: string): Promise<Return | undefined>;

  /**
   * Create a new return for an order
   * @param orderId The ID of the order to create return for
   * @param items Array of items to return with quantities
   * @param reasonCode The reason code for the return (mandatory per Emporix API)
   * @returns Promise with the created return ID
   */
  createReturn(orderId: string, items: CreateReturnItem[], reasonCode: string, reasonDetails?: string): Promise<string>;
}
