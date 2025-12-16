import { inject } from 'inversify';
import { omit } from 'lodash';
import { injectable } from '@/platform/core/di/injectable';
import {
  EmporixCategory,
  EmporixCategoryAssignment,
  EmporixCategoryAssignmentQuery,
  EmporixCategoryParent,
  EmporixPaginatedResponse,
  EmporixSearchParams,
} from '@/platform/integrations/emporix/model';
import EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import EmporixCommonUtil from '../../common/util/EmporixCommonUtil';
import { buildPaginatedResponse, buildSearchQuery } from '../../common/util/common';
import type { EmporixConfig } from '../../config';
import { EmporixCategoryQuery } from '../EmporixCategoryApi';
import type { EmporixCategoryApi as IEmporixCategoryApi } from '../EmporixCategoryApi';

/**
 * Implementation of CategoryApi for Emporix category data.
 * Provides methods to retrieve category information from the Emporix API.
 */
@injectable('EmporixCategoryApi', 'Singleton')
class EmporixCategoryApi implements IEmporixCategoryApi {
  constructor(
    @inject('EmporixApiInvoker') protected apiInvoker: EmporixApiInvoker,
    @inject('EmporixConfig') protected config: EmporixConfig,
    @inject('EmporixCommonUtil') protected commonUtil: EmporixCommonUtil,
  ) {}

  /**
   * Retrieves a list of all categories with pagination and filtering support.
   * @param query Query parameters for filtering and pagination
   * @returns A paginated response containing category data
   */
  async getCategories(query?: EmporixCategoryQuery): Promise<EmporixPaginatedResponse<EmporixCategory>> {
    let queryParams = '';

    const params = {
      page: query?.pageNumber,
      size: query?.pageNumber ? query?.pageSize || 20 : undefined,
    };

    // Build the query string with all the filters
    const { query: baseQuery } = buildSearchQuery(params);

    // Use the common utility to add all query parameters, excluding pagination params
    queryParams = this.commonUtil.addObjectFieldsToQuery(omit(query, ['pageNumber', 'pageSize']), baseQuery);

    const url = `/category/${this.config.tenant}/categories?${queryParams}`;

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      { method: 'GET', headers: { 'X-Total-Count': 'true' } },
      'public',
    );

    return buildPaginatedResponse(params, response);
  }

  /**
   * Retrieves a specific category by its ID.
   * @param categoryId The category ID to retrieve
   * @returns The category data or null if not found
   */
  async getCategory(categoryId: string): Promise<EmporixCategory | null> {
    const response = await this.apiInvoker.authenticatedFetch(
      `/category/${this.config.tenant}/categories/${categoryId}`,
      {
        method: 'GET',
        headers: {
          'X-Version': 'v2', // Required for this endpoint as per API docs
        },
      },
      'public',
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      } else {
        throw new Error(`Failed to get category: ${response.statusText}`);
      }
    }

    return await response.json();
  }

  /**
   * Retrieves the parent categories of a specific category.
   * @param categoryId The category ID to get parents for
   * @returns An array of parent categories
   */
  async getCategoryParents(categoryId: string): Promise<EmporixCategoryParent[]> {
    const response = await this.apiInvoker.authenticatedFetch(
      `/category/${this.config.tenant}/categories/${categoryId}/parents`,
      {
        method: 'GET',
        headers: {
          'X-Version': 'v2', // Required for this endpoint as per API docs
        },
      },
      'public',
    );

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      } else {
        throw new Error(`Failed to get category parents: ${response.statusText}`);
      }
    }

    return await response.json();
  }

  /**
   * Retrieves the subcategories of a specific category.
   * @param categoryId The category ID to get subcategories for
   * @param page The page number to retrieve (0-based)
   * @param pageSize The number of subcategories per page
   * @returns A paginated response containing subcategory data
   */
  async getCategorySubcategories(
    categoryId: string,
    page?: number,
    pageSize?: number,
  ): Promise<EmporixPaginatedResponse<EmporixCategory>> {
    const params: EmporixSearchParams<EmporixCategory> = {
      page: page || 0,
      size: pageSize || 20,
    };
    const { query } = buildSearchQuery(params);
    const url = `/category/${this.config.tenant}/categories/${categoryId}/subcategories?${query}`;

    try {
      const response = await this.apiInvoker.authenticatedFetch(
        url,
        {
          method: 'GET',
          headers: {
            'X-Total-Count': 'true',
            'X-Version': 'v2', // Required for this endpoint as per API docs
          },
        },
        'public',
      );
      return buildPaginatedResponse(params, response);
    } catch (error: any) {
      if (error.status === 404) {
        return { items: [], page: 0, size: 0, total: 0 };
      }
      throw error;
    }
  }

  /**
   * Retrieves a list of categories for which the reference ID is assigned.
   * @param referenceId The reference ID (e.g., productId) to get categories for
   * @param expandSupercategoriesIds If true, includes supercategories IDs
   * @param page The page number to retrieve (0-based)
   * @param pageSize The number of categories per page
   * @returns A paginated response containing category data
   */
  async getCategoriesByReferenceId(
    referenceId: string,
    expandSupercategoriesIds?: boolean,
    page?: number,
    pageSize?: number,
  ): Promise<EmporixPaginatedResponse<EmporixCategory>> {
    const params: EmporixSearchParams<EmporixCategory> = {
      page: page,
      size: page ? pageSize || 20 : undefined,
    };

    const { query } = buildSearchQuery(params);
    let url = `/category/${this.config.tenant}/assignments/references/${referenceId}?${query}`;

    // Add expandSupercategoriesIds parameter if specified
    if (expandSupercategoriesIds !== undefined) {
      url += `&expandSupercategoriesIds=${expandSupercategoriesIds}`;
    }

    try {
      const response = await this.apiInvoker.authenticatedFetch(
        url,
        {
          method: 'GET',
          headers: {
            'X-Total-Count': 'true',
            'X-Version': 'v2', // Required for this endpoint as per API docs
          },
        },
        'public',
      );
      return buildPaginatedResponse(params, response);
    } catch (error: any) {
      if (error.status === 404) {
        return { items: [], page: 0, size: 0, total: 0 };
      }
      throw error;
    }
  }

  /**
   * Retrieves a category tree for a root category with a given ID.
   * Note: You can retrieve a category tree only for a root category.
   * It is not possible to get a category tree for a category that lies lower in the hierarchy.
   * @param categoryId The ID of the root category to get the tree for
   * @param showUnpublished If true, includes unpublished categories (requires appropriate scope)
   * @returns The category tree data or undefined if not found
   */
  async getCategoryTree(categoryId: string, showUnpublished?: boolean): Promise<EmporixCategory | undefined> {
    try {
      let url = `/category/${this.config.tenant}/category-trees/${categoryId}`;

      // Add showUnpublished parameter if specified
      if (showUnpublished !== undefined) {
        url += `?showUnpublished=${showUnpublished}`;
      }

      // Use service access token for unpublished categories, otherwise use public token
      const tokenType = showUnpublished ? 'service' : 'public';
      const authOptions = showUnpublished ? { scopes: ['category:read'] } : undefined;

      const response = await this.apiInvoker.authenticatedFetch(
        url,
        {
          method: 'GET',
          headers: {
            'X-Version': 'v2', // Required for this endpoint as per API docs
          },
        },
        tokenType,
        authOptions,
      );

      if (!response.ok) {
        if (response.status === 404) {
          return undefined;
        } else {
          throw new Error(`Failed to get category tree: ${response.statusText}`);
        }
      }

      return await response.json();
    } catch (error: any) {
      if (error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Retrieves resources (such as products) assigned to a specified category.
   * @param categoryId The category ID to get assignments for
   * @param query Query parameters for filtering and pagination
   * @returns A paginated response containing category assignment data
   */
  async getCategoryAssignments(
    categoryId: string,
    params?: EmporixSearchParams<EmporixCategoryAssignmentQuery>,
  ): Promise<EmporixPaginatedResponse<EmporixCategoryAssignment>> {
    if (!params) {
      params = {};
    }
    // Build the query string with all the filters
    const { body: _body, query: baseQuery } = buildSearchQuery(params, true);

    const url = `/category/${this.config.tenant}/categories/${categoryId}/assignments?${baseQuery}`;

    try {
      const response = await this.apiInvoker.authenticatedFetch(
        url,
        {
          method: 'GET',
          headers: {
            'X-Total-Count': 'true',
            'X-Version': 'v2', // Required for this endpoint as per API docs
          },
        },
        'public',
      );
      return buildPaginatedResponse(params, response);
    } catch (error: any) {
      if (error.status === 404) {
        return { items: [], page: 0, size: 0, total: 0 };
      }
      throw error;
    }
  }
}

export default EmporixCategoryApi;
