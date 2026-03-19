import { EmporixReturnCreateRequest, EmporixReturnId, EmporixReturnResponse } from '../model/return';

export interface EmporixReturnsPage {
  items: EmporixReturnResponse[];
  totalCount?: number;
}

/**
 * Interface for the Emporix Return API
 */
export interface EmporixReturnApi {
  /**
   * Get all returns for the current customer
   * @param pageNumber Optional page number (default: 1)
   * @param pageSize Optional page size (default: 16)
   * @param sort Optional sort parameter
   * @param query Optional query parameter for filtering
   * @returns Promise with returns and optional total count
   */
  getReturns(pageNumber?: number, pageSize?: number, sort?: string, query?: string): Promise<EmporixReturnsPage>;

  /**
   * Get a specific return by ID
   * @param returnId The ID of the return to retrieve
   * @returns Promise with the return or null if not found
   */
  getReturn(returnId: string): Promise<EmporixReturnResponse | null>;

  /**
   * Create a new return
   * Requires scope: returns.returns_manage_own
   * @param request The return creation request
   * @returns Promise with the created return ID
   */
  createReturn(request: EmporixReturnCreateRequest): Promise<EmporixReturnId>;
}
