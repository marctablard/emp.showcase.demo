import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCategoryApi } from '@/platform/integrations/emporix/category/EmporixCategoryApi';
import type { EmporixCategory, EmporixCategoryTree } from '@/platform/integrations/emporix/model';
import type { CatalogPublishedRootCategoryService } from '@/platform/services/catalog/impl/CatalogPublishedRootCategoryService';
import { filterEmporixCategoryTreesByCatalogIds } from '@/platform/services/category/impl/filter-emporix-category-trees-for-catalog';
import {
  mapListCategoryRowsToNavigationCategories,
  selectTopLevelCategoryListRows,
} from '@/platform/services/category/impl/navigation-categories-from-list-response';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Category } from '@/platform/services/model/category';
import type { CategoryMapper } from '@/platform/services/model/category/CategoryMapper';
import { mapEmporixCategoryTreeToCategory } from '@/platform/services/model/category/impl/EmporixCategoryMapper';
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
    @inject('CatalogPublishedRootCategoryService')
    private catalogPublishedRootCategoryService: CatalogPublishedRootCategoryService,
    @inject('LoggerService') private logger: LoggerService,
  ) {
    this.categoryApi = categoryApi;
    this.categoryMapper = categoryMapper;
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

  async getCategoriesByIds(
    ids: string[],
    options?: { showRoots?: boolean; showUnpublished?: boolean },
  ): Promise<Category[]> {
    try {
      const items = await this.categoryApi.getCategoriesByIds(ids, {
        showRoots: options?.showRoots ?? false,
        showUnpublished: options?.showUnpublished === true,
        pageSize: Math.max(100, ids.length),
      });
      return items.map((c) => this.categoryMapper.mapToService(c));
    } catch (error) {
      this.logger.error({ err: error, idCount: ids.length }, 'Error fetching categories by ids');
      throw error;
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

  async getNavigationCategoryTrees(siteCode: string, showUnpublished?: boolean): Promise<Category[]> {
    try {
      const catalogIds = await this.catalogPublishedRootCategoryService.getRootCategoryIdsForSite(siteCode);
      if (catalogIds.length === 0) {
        return [];
      }

      const listed = await this.categoryApi.getCategoriesByIds(catalogIds, {
        // Catalog ids are not always tree roots; showRoots would drop assigned non-roots.
        showRoots: false,
        showUnpublished: showUnpublished === true,
        pageSize: Math.max(100, catalogIds.length),
      });

      const rootsForTreeApi =
        listed.length > 0 ? selectTopLevelCategoryListRows(listed).map((row) => row.id) : catalogIds;

      const fetchTreesBatch = async (ids: string[]): Promise<EmporixCategoryTree[]> => {
        if (ids.length === 0) {
          return [];
        }
        try {
          return await this.categoryApi.getCategoryTrees(ids, showUnpublished);
        } catch (err) {
          this.logger.warn({ err, siteCode, idCount: ids.length }, 'Emporix batch category-trees request failed');
          return [];
        }
      };

      const rootSet = new Set(rootsForTreeApi);
      const catalogSet = new Set(catalogIds);
      const sameRootIdSet = rootSet.size === catalogSet.size && catalogIds.every((id) => rootSet.has(id));

      // Prefer catalog ids first: one category-trees round-trip when those ids are valid roots
      // (avoids a wasted call when list-derived "top" ids do not resolve to trees).
      let trees: EmporixCategoryTree[] = await fetchTreesBatch(catalogIds);

      if (trees.length === 0 && listed.length > 0 && !sameRootIdSet) {
        trees = await fetchTreesBatch(rootsForTreeApi);
      }

      if (trees.length === 0) {
        this.logger.warn(
          { siteCode, catalogCategoryIdCount: catalogIds.length },
          'category-trees batch empty; loading all tenant trees and matching catalog categoryIds (roots or descendants)',
        );
        try {
          const allRoots = await this.categoryApi.getAllCategoryTrees(showUnpublished);
          trees = filterEmporixCategoryTreesByCatalogIds(allRoots, catalogIds);
        } catch (err) {
          this.logger.warn({ err, siteCode }, 'getAllCategoryTrees failed');
        }
      }

      if (trees.length > 0) {
        const mapped = trees.map((t) => mapEmporixCategoryTreeToCategory(t));
        const order = new Map(trees.map((t, index) => [t.id, index]));
        return mapped.sort((x, y) => (order.get(x.id) ?? 999) - (order.get(y.id) ?? 999));
      }

      if (listed.length > 0) {
        return mapListCategoryRowsToNavigationCategories(listed, (row) => this.categoryMapper.mapToService(row));
      }

      return [];
    } catch (error) {
      this.logger.error({ err: error, siteCode }, 'Error fetching navigation category trees');
      return [];
    }
  }

  async assignParents(category: Category, parents: Map<string, Category>) {
    if (category.parent && typeof category.parent === 'string') {
      category.parent = parents.get(category.parent);
    }
  }
}

export default EmporixCategoryService;
