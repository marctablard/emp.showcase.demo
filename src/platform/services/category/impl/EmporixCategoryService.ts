import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCategoryApi } from '@/platform/integrations/emporix/category/EmporixCategoryApi';
import type { EmporixCategory } from '@/platform/integrations/emporix/model';
import { Category } from '@/platform/services/model/category';
import type { CategoryMapper } from '@/platform/services/model/category/CategoryMapper';
import { CategoryService } from '../CategoryService';

/**
 * Emporix implementation of the CategoryService
 * Provides methods to retrieve category information from the Emporix API
 */
@injectable('CategoryService', 'Singleton')
export class EmporixCategoryService implements CategoryService {
  constructor(
    @inject('EmporixCategoryApi') private categoryApi: EmporixCategoryApi,
    @inject('EmporixCategoryMapper') private categoryMapper: CategoryMapper<EmporixCategory>,
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
      console.error('Error fetching category by ID:', error);
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
      console.error('Error fetching category by slug:', error);
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
      console.error('Error fetching category by code:', error);
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
      console.error('Error fetching categories:', error);
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
      console.error('Error fetching category parents:', error);
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
      console.error('Error fetching category subcategories:', error);
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
      console.error('Error fetching categories for product:', error);
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
      console.error('Error fetching category tree:', error);
      return null;
    }
  }

  async assignParents(category: Category, parents: Map<string, Category>) {
    if (category.parent && typeof category.parent === 'string') {
      category.parent = parents.get(category.parent);
    }
  }
}

export default EmporixCategoryService;
