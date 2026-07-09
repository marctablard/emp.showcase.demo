import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCatalogApi } from '@/platform/integrations/emporix/catalog/EmporixCatalogApi';
import type { EmporixCategoryApi } from '@/platform/integrations/emporix/category/EmporixCategoryApi';
import type { EmporixCategory } from '@/platform/integrations/emporix/model';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Category } from '@/platform/services/model/category';
import type { CategoryMapper } from '@/platform/services/model/category/CategoryMapper';
import type { CategoryService } from '../CategoryService';

/**
 * Emporix implementation of the CategoryService
 * Provides methods to retrieve category information from the Emporix API
 */
@injectable('CategoryService', 'Singleton')
export class EmporixCategoryService implements CategoryService {
  constructor(
    @inject('EmporixCategoryApi') private categoryApi: EmporixCategoryApi,
    @inject('EmporixCategoryMapper') private categoryMapper: CategoryMapper<EmporixCategory>,
    @inject('LoggerService') private logger: LoggerService,
    @inject('EmporixCatalogApi') private catalogApi: EmporixCatalogApi,
  ) {
    this.categoryApi = categoryApi;
    this.categoryMapper = categoryMapper;
    this.catalogApi = catalogApi;
  }

  /**
   * Get a category by its ID
   * @param id The category ID
   * @returns Promise with the category or null if not found
   */
  async getCategoryById(id: string): Promise<Category | null> {
    try {
      const category = await this.categoryApi.getCategory(id);
      if (!category) {
        return null;
      }
      return this.categoryMapper.mapToService(category);
    } catch (error) {
      this.logger.error({ err: error, categoryId: id }, 'Error fetching category by ID');
      return null;
    }
  }

  /**
   * Get a category by its slug
   * @param slug The category slug
   * @returns Promise with the category or null if not found
   */
  async getCategoryBySlug(slug: string): Promise<Category | null> {
    try {
      // Use the query capability of the API to find by slug
      const query = { localizedSlug: slug };
      const response = await this.categoryApi.getCategories(query);

      if (!response.items || response.items.length === 0) {
        return null;
      }

      return this.categoryMapper.mapToService(response.items[0]);
    } catch (error) {
      this.logger.error({ err: error, categorySlug: slug }, 'Error fetching category by slug');
      return null;
    }
  }

  /**
   * Get a category by its code
   * @param code The category code
   * @returns Promise with the category or null if not found
   */
  async getCategoryByCode(code: string): Promise<Category | null> {
    try {
      // Use the query capability of the API to find by code
      const query = { code };
      const response = await this.categoryApi.getCategories(query);

      if (!response.items || response.items.length === 0) {
        return null;
      }

      return this.categoryMapper.mapToService(response.items[0]);
    } catch (error) {
      this.logger.error({ err: error, categoryCode: code }, 'Error fetching category by code');
      return null;
    }
  }

  /**
   * Get all categories
   * @returns Promise with an array of categories
   */
  async getCategories(): Promise<Category[]> {
    try {
      const response = await this.categoryApi.getCategories();

      if (!response.items) {
        return [];
      }

      return response.items.map((category) => this.categoryMapper.mapToService(category));
    } catch (error) {
      this.logger.error({ err: error }, 'Error fetching categories');
      return [];
    }
  }

  /**
   * Get parent categories for a specific category
   * @param categoryId The category ID
   * @returns Promise with an array of parent categories
   */
  async getCategoryParents(categoryId: string): Promise<Category[]> {
    try {
      const parents = await this.categoryApi.getCategoryParents(categoryId);

      if (!parents || parents.length === 0) {
        return [];
      }

      return parents.map((parent) => this.categoryMapper.mapToService(parent));
    } catch (error) {
      this.logger.error({ err: error, categoryId }, 'Error fetching category parents');
      return [];
    }
  }

  /**
   * Get subcategories for a specific category
   * @param categoryId The category ID
   * @returns Promise with an array of subcategories
   */
  async getCategorySubcategories(categoryId: string): Promise<Category[]> {
    try {
      const subcategories = await this.categoryApi.getCategorySubcategories(categoryId);

      if (!subcategories || subcategories.items.length === 0) {
        return [];
      }

      return subcategories.items.map((subcategory) => this.categoryMapper.mapToService(subcategory));
    } catch (error) {
      this.logger.error({ err: error, categoryId }, 'Error fetching category subcategories');
      return [];
    }
  }

  /**
   * Get categories assigned to a product by its ID
   * @param productId The product ID
   * @param includeParents Whether to include parent categories
   * @returns Promise with an array of categories
   */
  async getCategoriesForProduct(productId: string, includeParents = false): Promise<Category[]> {
    try {
      const categoriesResponse = await this.categoryApi.getCategoriesByReferenceId(productId, includeParents);

      if (!categoriesResponse || !categoriesResponse.items || categoriesResponse.items.length === 0) {
        return [];
      }
      const result = categoriesResponse.items.map(this.categoryMapper.mapToService);
      if (includeParents) {
        // Collect all supercategory IDs from all categories
        const parentIds: string[] = categoriesResponse.items
          .filter((category) => Array.isArray(category.supercategoriesIds) && category.supercategoriesIds.length > 0)
          .flatMap((category) => category.supercategoriesIds || [])
          .filter((id): id is string => !!id);

        const mappedParents = new Map<string, Category>();
        if (parentIds.length > 0) {
          const parents = await Promise.all(parentIds.map((id) => this.categoryApi.getCategory(id)));
          parents
            .filter((parent) => !!parent)
            .forEach((parent) => {
              mappedParents.set(parent.id, this.categoryMapper.mapToService(parent));
            });
        }
        result.forEach((category) => {
          this.assignParents(category, mappedParents);
          // build hierarchies
          Array.from(mappedParents.values()).forEach((parent) => {
            this.assignParents(parent, mappedParents);
          });
        });
      }
      return result;
    } catch (error) {
      this.logger.error({ err: error, productId }, 'Error fetching categories for product');
      return [];
    }
  }

  /**
   * Get a complete category tree for a root category
   * @param categoryId The ID of the root category
   * @param showUnpublished Whether to include unpublished categories
   * @returns Promise with the category tree or null if not found
   */
  async getCategoryTree(categoryId: string, showUnpublished?: boolean): Promise<Category | null> {
    try {
      const categoryTree = await this.categoryApi.getCategoryTree(categoryId, showUnpublished);

      if (!categoryTree) {
        return null;
      }

      return this.categoryMapper.mapToService(categoryTree);
    } catch (error) {
      this.logger.error({ err: error, categoryId }, 'Error fetching category tree');
      return null;
    }
  }

  /**
   * Retrieve all category trees for the tenant.
   */
  async getCategoryTrees(): Promise<Category[]> {
    try {
      const trees = await this.categoryApi.getCategoryTrees();
      return trees.map((tree) => this.categoryMapper.mapToService(tree));
    } catch (error) {
      this.logger.error({ err: error }, 'Error fetching category trees');
      return [];
    }
  }

  /**
   * Retrieve category trees scoped to a specific site.
   * Mirrors the b2b-showcase approach:
   *   1. Fetch catalogs published for the site → extract root categoryIds
   *   2. Fetch all category trees
   *   3. Filter to only the site's root categories
   */
  async getCategoryTreesForSite(siteCode: string): Promise<Category[]> {
    try {
      const catalogResponse = await this.catalogApi.getCatalogs({
        size: 100,
        criteria: { publishedSite: siteCode },
      });
      const rootCategoryIds = new Set((catalogResponse.items ?? []).flatMap((c) => c.categoryIds ?? []));

      const allTrees = await this.getCategoryTrees();

      return rootCategoryIds.size > 0 ? allTrees.filter((t) => rootCategoryIds.has(t.id)) : allTrees;
    } catch (error) {
      this.logger.error({ err: error, siteCode }, 'Error fetching category trees for site');
      return [];
    }
  }

  /**
   * Get the product IDs assigned to a category.
   */
  async getSiteRootCategoryIds(siteCode: string): Promise<Set<string>> {
    try {
      const catalogResponse = await this.catalogApi.getCatalogs({
        size: 100,
        criteria: { publishedSite: siteCode },
      });
      return new Set((catalogResponse.items ?? []).flatMap((c) => c.categoryIds ?? []));
    } catch (error) {
      this.logger.error({ err: error, siteCode }, 'Error fetching site root category IDs');
      return new Set();
    }
  }

  async getProductIdsForCategory(
    categoryId: string,
    options?: { page?: number; pageSize?: number; withSubcategories?: boolean; segmentsIds?: string },
  ): Promise<{ ids: string[]; total: number; page: number; pageSize: number }> {
    try {
      const page = options?.page ?? 0;
      const pageSize = options?.pageSize ?? 20;
      const response = await this.categoryApi.getCategoryAssignments(categoryId, {
        page,
        size: pageSize,
        criteria: {
          assignmentType: 'PRODUCT',
          withSubcategories: options?.withSubcategories ?? true,
          ...(options?.segmentsIds ? { segmentsIds: options.segmentsIds } : {}),
        },
      });
      const ids = (response.items ?? []).filter((a) => a.ref?.type?.toLowerCase() === 'product').map((a) => a.ref.id);
      return { ids, total: response.total ?? 0, page, pageSize };
    } catch (error) {
      this.logger.error({ err: error, categoryId }, 'Error fetching product IDs for category');
      return { ids: [], total: 0, page: 0, pageSize: options?.pageSize ?? 20 };
    }
  }

  async assignParents(category: Category, parents: Map<string, Category>) {
    if (category.parent && typeof category.parent === 'string') {
      category.parent = parents.get(category.parent);
    }
  }
}

export default EmporixCategoryService;
