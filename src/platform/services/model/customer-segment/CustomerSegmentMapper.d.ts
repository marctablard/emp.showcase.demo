import {
  CategoryTreeItemResponse,
  ItemAssignmentResponse,
  SegmentResponse,
} from '@platform/integrations/emporix/model';
import { Mapper } from '../Mapper';
import { CategoryTree, ItemAssignment, Segment } from './customer-segment';

/**
 * Mapper for transforming Emporix item assignments, segments and category trees to internal models.
 */
export interface CustomerSegmentMapper extends Mapper<ItemAssignmentResponse, ItemAssignment> {
  /**
   * Maps an Emporix segment to the internal `Segment` model (only `id`, `name`, `status`,
   * `siteCode`, `validity`). Returns `undefined` when `id` is not a string (tolerant shape).
   */
  mapSegment(source: SegmentResponse): Segment | undefined;

  /**
   * Maps Emporix category tree response to internal hierarchical CategoryTree model
   */
  mapCategoryTrees(source: CategoryTreeItemResponse[]): CategoryTree[];
}
