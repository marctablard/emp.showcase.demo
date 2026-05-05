import type { Category } from '@/platform/services/model/category';

/**
 * Category-tree operations the CMS plugin exposes on top of the platform.
 *
 * These methods used to hang off the platform `CategoryService`; they were
 * moved here so the platform contract stays narrow and only the CMS plugin
 * owns CMS-specific traversals.
 *
 * The DI binding name `CMSCategoryService` is what consumers (the route
 * handler at `route-handlers/category-tree.ts`, the storefront's
 * `StorefrontCMSComponentDecoratorService`) ask for.
 */
export interface CMSCategoryService {
  /**
   * Resolve a category from an opaque URL identifier. Cascades through:
   *   1. slug match (any locale)
   *   2. category code
   *   3. Emporix UUID
   *
   * Returns `null` only when none of the three match.
   */
  getCategoryByIdentifier(identifier: string): Promise<Category | null>;

  /**
   * Get the full category tree rooted at the given category id (must be a
   * root category). Returns `null` when the id does not resolve.
   */
  getCategoryTree(categoryId: string, showUnpublished?: boolean): Promise<Category | null>;

  /**
   * Get all category trees for a site, derived from the catalogs published
   * to that site. Each catalog may contribute one or more root category
   * IDs; the full tree (with nested children) is fetched for each root.
   */
  getCategoryTreesForSite(site: string, showUnpublished?: boolean): Promise<Category[]>;
}
