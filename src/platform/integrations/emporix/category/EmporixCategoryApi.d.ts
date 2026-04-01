import {
  EmporixCategory,
  EmporixCategoryAssignment,
  EmporixCategoryAssignmentQuery,
  EmporixCategoryParent,
  EmporixCategorySubcategory,
  EmporixPaginatedResponse,
} from '../model';

export interface EmporixCategoryQuery {
  /**
   * If set to true, only root categories (categories without parents) are retrieved.
   * Default: false
   */
  showRoots?: boolean;

  /**
   * If set to true, not published categories are retrieved as well.
   * Note: To get unpublished categories you need to have category.category_read_unpublished scope.
   * Default: false
   */
  showUnpublished?: boolean;

  /**
   * Page number to be retrieved. The number of the first page is 1.
   * Note: If the pageNumber parameter is passed, size of the pages must be specified in the pageSize parameter.
   * Default: 1
   */
  pageNumber?: number;

  /**
   * Number of categories to be retrieved per page.
   * Default: 60
   */
  pageSize?: number;

  /**
   * List of properties used to sort the results, separated by commas.
   * Example: sort={fieldName}:ASC,{fieldName2}:DESC
   */
  sort?: string;

  /**
   * Search by the code value. The equal case insensitive operator is used.
   */
  code?: string;

  /**
   * Search by the localizedName of the categories.
   */
  localizedName?: string;

  /**
   * Search by the localizeDescription of the categories.
   */
  localizedDescription?: string;

  /**
   * Search by the localizedSlug of the categories.
   */
  localizedSlug?: string;

  /**
   * Search by the ECN value. The equal operator is used.
   */
  ecn?: string;

  /**
   * Search by categories with 'validity.from' date field which is after specified value.
   * Format: 'yyyy-MM-dd'
   */
  validityFrom?: string;

  /**
   * Search by categories with 'validity.to' date field which is before specified value.
   * Format: 'yyyy-MM-dd'
   */
  validityTo?: string;

  /**
   * Search by categories with 'metadata.modifiedAt' date field which is after specified value.
   * Format: 'yyyy-MM-dd'
   */
  metadataModifiedAt?: string;
}

/**
 * Interface for accessing Emporix category data.
 * Provides methods to retrieve category information from the Emporix API.
 */
export interface EmporixCategoryApi {
  /**
   * Retrieves a list of all categories with pagination and filtering support.
   * @param query Query parameters for filtering and pagination
   * @returns A paginated response containing category data
   */
  getCategories(query?: EmporixCategoryQuery): Promise<EmporixPaginatedResponse<EmporixCategory>>;

  /**
   * Retrieves a specific category by its ID.
   * @param categoryId The category ID to retrieve
   * @returns The category data or null if not found
   */
  getCategory(categoryId: string): Promise<EmporixCategory | null>;

  /**
   * Retrieves the parent categories of a specific category.
   * @param categoryId The category ID to get parents for
   * @returns An array of parent categories
   */
  getCategoryParents(categoryId: string): Promise<EmporixCategoryParent[]>;

  /**
   * Retrieves the subcategories of a specific category.
   * @param categoryId The category ID to get subcategories for
   * @param page The page number to retrieve (0-based)
   * @param pageSize The number of subcategories per page
   * @returns A paginated response containing subcategory data
   */
  getCategorySubcategories(
    categoryId: string,
    page?: number,
    pageSize?: number,
  ): Promise<EmporixPaginatedResponse<EmporixCategorySubcategory>>;

  /**
   * Retrieves a list of categories for which the reference ID is assigned.
   * @param referenceId The reference ID (e.g., productId) to get categories for
   * @param expandSupercategoriesIds If true, includes supercategories IDs
   * @param page The page number to retrieve (0-based)
   * @param pageSize The number of categories per page
   * @returns A paginated response containing category data
   */
  getCategoriesByReferenceId(
    referenceId: string,
    expandSupercategoriesIds?: boolean,
    page?: number,
    pageSize?: number,
  ): Promise<EmporixPaginatedResponse<EmporixCategory>>;

  /**
   * Retrieves a category tree for a root category with a given ID.
   * Note: You can retrieve a category tree only for a root category.
   * It is not possible to get a category tree for a category that lies lower in the hierarchy.
   * @param categoryId The ID of the root category to get the tree for
   * @param showUnpublished If true, includes unpublished categories (requires appropriate scope)
   * @returns The category tree data or undefined if not found
   */
  getCategoryTree(categoryId: string, showUnpublished?: boolean): Promise<EmporixCategory | undefined>;

  /**
   * Retrieves all category trees for the tenant.
   * Calls GET /category/{tenant}/category-trees with a customer/session token.
   * Each tree item already contains nested subcategories.
   * @returns Array of root category objects with their subcategories pre-populated
   */
  getCategoryTrees(): Promise<EmporixCategory[]>;

  /**
   * Retrieves resources (such as products) assigned to a specified category.
   * @param categoryId The category ID to get assignments for
   * @param query Query parameters for filtering and pagination
   * @returns A paginated response containing category assignment data
   */
  getCategoryAssignments(
    categoryId: string,
    params?: EmporixSearchParams<EmporixCategoryAssignmentQuery>,
  ): Promise<EmporixPaginatedResponse<EmporixCategoryAssignment>>;
}
