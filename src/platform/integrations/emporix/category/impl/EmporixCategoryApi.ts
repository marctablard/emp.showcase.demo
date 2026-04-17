import { inject } from 'inversify';
import { omit } from 'lodash';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type {
  EmporixCategory,
  EmporixCategoryAssignment,
  EmporixCategoryAssignmentQuery,
  EmporixCategoryParent,
  EmporixCategoryTree,
  EmporixPaginatedResponse,
  EmporixSearchParams,
} from '@/platform/integrations/emporix/model';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import type EmporixCommonUtil from '../../common/util/EmporixCommonUtil';
import { buildPaginatedResponse, buildSearchQuery } from '../../common/util/common';
import type { EmporixConfig } from '../../config';
import type { EmporixCategoryQuery } from '../EmporixCategoryApi';
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
    @inject('LoggerService') private logger: LoggerService,
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

  async getCategoriesByIds(
    categoryIds: string[],
    options?: { showRoots?: boolean; showUnpublished?: boolean; pageSize?: number },
  ): Promise<EmporixCategory[]> {
    const trimmed = [...new Set(categoryIds.map((id) => id.trim()).filter(Boolean))];
    if (trimmed.length === 0) {
      return [];
    }

    const maxPageSize = Math.min(Math.max(options?.pageSize ?? 100, 50), 500);
    /** Keep `q=id:(…)` bounded; then paginate within each chunk when the API returns partial pages. */
    const idChunkSize = 200;
    const byId = new Map<string, EmporixCategory>();

    for (let offset = 0; offset < trimmed.length; offset += idChunkSize) {
      const chunk = trimmed.slice(offset, offset + idChunkSize);
      const q = `id:(${chunk.join(',')})`;
      let pageNumber = 1;

      while (true) {
        const pageSize = Math.min(maxPageSize, Math.max(chunk.length, 50));
        const response = await this.getCategories({
          pageNumber,
          pageSize,
          q,
          showRoots: options?.showRoots ?? true,
          showUnpublished: options?.showUnpublished ?? false,
        });

        const items = response.items ?? [];
        for (const cat of items) {
          byId.set(cat.id, cat);
        }

        const resolvedAllInChunk = chunk.every((id) => byId.has(id));
        if (resolvedAllInChunk) {
          break;
        }
        if (items.length === 0) {
          break;
        }
        if (items.length < pageSize) {
          break;
        }
        const total = response.total;
        if (total >= 0 && pageNumber * pageSize >= total) {
          break;
        }
        pageNumber += 1;
        if (pageNumber > 100) {
          this.logger.warn(
            { event: 'get_categories_by_ids_page_cap', chunkSize: chunk.length, pageNumber },
            'getCategoriesByIds stopped paginating after safety page cap',
          );
          break;
        }
      }
    }

    return trimmed.map((id) => byId.get(id)).filter((c): c is EmporixCategory => Boolean(c));
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
   * Retrieves category trees for root ids via GET /category/{tenant}/category-trees (non-deprecated).
   */
  async getCategoryTrees(categoryIds: string[], showUnpublished?: boolean): Promise<EmporixCategoryTree[]> {
    const trimmed = [...new Set(categoryIds.map((id) => id.trim()).filter(Boolean))];
    if (trimmed.length === 0) {
      return [];
    }

    // OpenAPI: categoryIds is an array. Emporix expects repeated query keys (categoryIds=a&categoryIds=b),
    // not a single comma-separated value — the latter can yield HTTP 200 with an empty array.
    const params = new URLSearchParams();
    for (const id of trimmed) {
      params.append('categoryIds', id);
    }
    if (showUnpublished === true) {
      params.set('showUnpublished', 'true');
    }

    const path = `/category/${this.config.tenant}/category-trees?${params.toString()}`;

    const tokenType = showUnpublished ? 'service' : 'public';
    const authOptions = showUnpublished ? { scopes: ['category:read'] } : undefined;

    const response = await this.apiInvoker.authenticatedFetch(
      path,
      {
        method: 'GET',
        headers: {
          'X-Version': 'v2',
        },
      },
      tokenType,
      authOptions,
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      this.logger.warn(
        {
          status: response.status,
          statusText: response.statusText,
          bodyPreview: errBody.slice(0, 2000),
        },
        'Emporix category-trees error response',
      );
      throw new Error(`Failed to get category trees: ${response.statusText}`);
    }

    return (await response.json()) as EmporixCategoryTree[];
  }

  /**
   * Retrieves all category trees for the tenant (no categoryIds filter).
   */
  async getAllCategoryTrees(showUnpublished?: boolean): Promise<EmporixCategoryTree[]> {
    const params = new URLSearchParams();
    if (showUnpublished === true) {
      params.set('showUnpublished', 'true');
    }
    const qs = params.toString();
    const path = `/category/${this.config.tenant}/category-trees${qs ? `?${qs}` : ''}`;

    const tokenType = showUnpublished ? 'service' : 'public';
    const authOptions = showUnpublished ? { scopes: ['category:read'] } : undefined;

    const response = await this.apiInvoker.authenticatedFetch(
      path,
      {
        method: 'GET',
        headers: {
          'X-Version': 'v2',
        },
      },
      tokenType,
      authOptions,
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      this.logger.warn(
        {
          status: response.status,
          statusText: response.statusText,
          bodyPreview: errBody.slice(0, 2000),
        },
        'Emporix category-trees (all) error response',
      );
      throw new Error(`Failed to get category trees: ${response.statusText}`);
    }

    return (await response.json()) as EmporixCategoryTree[];
  }

  async searchCategoryTreesForCategoryIds(categoryIds: string[]): Promise<EmporixCategoryTree[]> {
    const trimmed = [...new Set(categoryIds.map((id) => id.trim()).filter(Boolean))];
    if (trimmed.length === 0) {
      return [];
    }

    const path = `/category/${this.config.tenant}/category-trees/search`;

    const response = await this.apiInvoker.authenticatedFetch(
      path,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Version': 'v2',
        },
        body: JSON.stringify({ categoryIds: trimmed }),
      },
      'public',
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      this.logger.warn(
        {
          status: response.status,
          statusText: response.statusText,
          bodyPreview: errBody.slice(0, 2000),
        },
        'Emporix category-trees search error response',
      );
      throw new Error(`Failed to search category trees: ${response.statusText}`);
    }

    return (await response.json()) as EmporixCategoryTree[];
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
