import { CategoryTreeItemResponse, CustomerSegmentQueryParams, ItemAssignmentResponse } from '../model';

export interface EmporixCustomerSegmentApi {
  /**
   * Retrieve all items assignments for all customer segments
   * @param params Query parameters for filtering and pagination
   * @returns Promise with array of item assignments
   */
  getSegmentItems(params?: CustomerSegmentQueryParams): Promise<ItemAssignmentResponse[]>;

  /**
   * Retrieve category trees for customer segments
   * @param params Query parameters (language, legalEntityId, siteCode)
   * @returns Promise with array of category tree items
   */
  getCategoryTrees(params?: CustomerSegmentQueryParams): Promise<CategoryTreeItemResponse[]>;
}
