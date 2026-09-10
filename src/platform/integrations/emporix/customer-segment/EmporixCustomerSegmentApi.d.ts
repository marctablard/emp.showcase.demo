import {
  CategoryTreeItemResponse,
  CustomerSegmentQueryParams,
  ItemAssignmentPageResponse,
  SegmentResponse,
} from '../model';

export interface EmporixCustomerSegmentApi {
  /**
   * Retrieve the segments assigned to the current customer (`GET /customer-segment/{tenant}/me/segments`).
   * Feature-detecting: resolves `null` (never throws for an HTTP-level outcome) when the endpoint is
   * not available — non-`ok` status, missing JSON `content-type`, empty body, or a body that is not
   * a JSON array. Errors thrown by the invoker itself (network, token refresh) are propagated.
   * @param params Query parameters (`legalEntityId`, `siteCode`)
   * @returns Promise with the segment array, or `null` when the endpoint is unavailable
   */
  getMySegments(params?: CustomerSegmentQueryParams): Promise<SegmentResponse[] | null>;

  /**
   * Retrieve customer segments visible to the current session (`GET /customer-segment/{tenant}/segments`).
   * @param params Query parameters for filtering and pagination
   * @returns Promise with array of segments
   */
  getSegments(params?: CustomerSegmentQueryParams): Promise<SegmentResponse[]>;

  /**
   * Retrieve one page of item assignments for all customer segments
   * @param params Query parameters for filtering and pagination
   * @returns Promise with the page items and the `X-Total-Count` total
   */
  getSegmentItems(params?: CustomerSegmentQueryParams): Promise<ItemAssignmentPageResponse>;

  /**
   * Retrieve category trees for customer segments
   * @param params Query parameters (language, legalEntityId, siteCode)
   * @returns Promise with array of category tree items
   */
  getCategoryTrees(params?: CustomerSegmentQueryParams): Promise<CategoryTreeItemResponse[]>;
}
