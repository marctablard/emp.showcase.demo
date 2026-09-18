import { CategoryTree, CustomerSegmentQueryOptions, ItemAssignment, Segment } from '../model/customer-segment';

/**
 * Service for customer segment-related operations
 */
export interface CustomerSegmentService {
  /**
   * Retrieve the current customer's active segments for a site.
   * Official source is `GET /customer-segment/{tenant}/segments/me` (“Retrieving own customer
   * segments”). `200` + `[]` is unsegmented, not an error. Unavailable or shape-drifted
   * responses reject so `ProductsModeService` fails closed — `GET /segments` is the catalogue,
   * not membership, and is never used as a fallback.
   * Segments are filtered to `status` ACTIVE (or absent), `siteCode` absent or equal to the
   * requested site (`options.siteCode` or the session site) and `validity` containing "now".
   * @param options `siteCode` overrides the session site
   * @returns Promise with the filtered segments (empty array = no segments)
   */
  getMySegments(options?: { siteCode?: string }): Promise<Segment[]>;

  /**
   * Retrieve all item assignments for all customer segments (every page is fetched).
   * @param options Query options for filtering (`q`, `sort`, `fields`, `legalEntityId`, `siteCode`)
   * @returns Promise with the flat array of item assignments
   */
  getSegmentItems(options?: CustomerSegmentQueryOptions): Promise<ItemAssignment[]>;

  /**
   * Retrieve hierarchical category trees for customer segments
   * @param options Query options (legalEntityId, siteCode)
   * @returns Promise with array of root category trees (nested `subcategories`)
   */
  getCategoryTrees(options?: CustomerSegmentQueryOptions): Promise<CategoryTree[]>;
}
