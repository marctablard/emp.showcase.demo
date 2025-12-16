import { ItemAssignmentResponse } from '@platform/integrations/emporix/model';
import { Mapper } from '../Mapper';
import { CategoryTree, ItemAssignment } from './customer-segment';

/**
 * Mapper for transforming Emporix item assignments and category trees to internal models.
 */
export interface CustomerSegmentMapper extends Mapper<ItemAssignmentResponse, ItemAssignment> {
  /**
   * Maps Emporix category tree response to internal CategoryTree model
   */
  mapCategoryTrees(source: any[]): CategoryTree[];
}
