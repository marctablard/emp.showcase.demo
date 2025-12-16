import { Category } from '../model/category';
import { CustomerSegmentQueryOptions, ItemAssignment } from '../model/customer-segment';

/**
 * Service for customer segment-related operations
 */
export interface CustomerSegmentService {
  /**
   * Retrieve all items assignments for all customer segments
   * @param options Query options for filtering and pagination
   * @returns Promise with array of item assignments
   */
  getSegmentItems(options?: CustomerSegmentQueryOptions): Promise<ItemAssignment[]>;

  /**
   * Retrieve category trees for customer segments
   * @param options Query options (language, legalEntityId, siteCode)
   * @returns Promise with array of categories representing the trees
   */
  getCategoryTrees(options?: CustomerSegmentQueryOptions): Promise<Category[]>;
}
