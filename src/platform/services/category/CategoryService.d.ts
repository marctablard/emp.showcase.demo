import type { Category } from '../model/category';

export interface CategoryService {
  getCategoryById(id: string): Promise<Category | null>;

  /**
   * Batch fetch by id (Emporix: one GET /categories with q=id:(…)).
   */
  getCategoriesByIds(ids: string[], options?: { showRoots?: boolean; showUnpublished?: boolean }): Promise<Category[]>;

  getCategoryBySlug(slug: string): Promise<Category | null>;

  getCategoryByCode(code: string): Promise<Category | null>;

  getCategories(): Promise<Category[]>;

  getCategoryParents(categoryId: string): Promise<Category[]>;

  getCategorySubcategories(categoryId: string): Promise<Category[]>;

  /**
   * Get categories assigned to a product by its ID
   * @param productId The product ID
   * @param includeParents Whether to include parent categories
   * @returns Promise with an array of categories
   */
  getCategoriesForProduct(productId: string, includeParents?: boolean): Promise<Category[]>;

  /**
   * Get a complete category tree for a root category
   * @param categoryId The ID of the root category
   * @param showUnpublished Whether to include unpublished categories
   * @returns Promise with the category tree or null if not found
   */
  getCategoryTree(categoryId: string, showUnpublished?: boolean): Promise<Category | null>;

  /**
   * Category trees for storefront navigation (catalog roots for site → GET /category-trees).
   */
  getNavigationCategoryTrees(siteCode: string, showUnpublished?: boolean): Promise<Category[]>;

  /**
   * Number of **products** assigned to a category, including subcategories by default.
   *
   * Uses `GET /category/{tenant}/categories/{categoryId}/assignments` with `X-Total-Count: true`
   * (see {@link https://developer.emporix.io/api-references/.../category-assignment-resources}).
   *
   * Returns `0` on upstream failure so UI callers can treat the count as best-effort.
   */
  getProductCountForCategory(
    categoryId: string,
    options?: {
      withSubcategories?: boolean;
      hideUnpublishedProducts?: boolean;
    },
  ): Promise<number>;
}
