import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type {
  EmporixBrand,
  EmporixPaginatedResponse,
  EmporixSearchParams,
} from '@/platform/integrations/emporix/model';
import type EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import { buildPaginatedResponse, buildSearchQuery } from '../../common/util/common';
import type { EmporixBrandApi as IEmporixBrandApi } from '../EmporixBrandApi';

/**
 * Implementation of BrandApi for Emporix brand data.
 * Provides methods to retrieve brand information from the Emporix API.
 */
@injectable('EmporixBrandApi', 'Singleton')
class EmporixBrandApi implements IEmporixBrandApi {
  constructor(@inject('EmporixApiInvoker') protected apiInvoker: EmporixApiInvoker) {}

  /**
   * Retrieves a list of all brands with pagination support.
   * @param page The page number to retrieve (0-based)
   * @param pageSize The number of brands per page
   * @returns A paginated response containing brand data
   */
  async getBrands(page?: number, pageSize?: number): Promise<EmporixPaginatedResponse<EmporixBrand>> {
    const params: EmporixSearchParams<EmporixBrand> = {
      page: page || 0,
      size: pageSize || 20,
    };
    const { query } = buildSearchQuery(params);
    const response = await this.apiInvoker.authenticatedFetch(
      `/brand/brands?${query}`,
      { method: 'GET', headers: { 'X-Total-Count': 'true' } },
      'public',
    );

    return buildPaginatedResponse(params, response);
  }

  /**
   * Retrieves a specific brand by its ID.
   * @param id The brand ID to retrieve
   * @returns The brand data or undefined if not found
   */
  async getBrand(id: string): Promise<EmporixBrand | undefined> {
    const response = await this.apiInvoker.authenticatedFetch(`/brand/brands/${id}`, { method: 'GET' }, 'public');

    if (!response.ok) {
      if (response.status === 404) {
        return undefined;
      } else {
        throw new Error(`Failed to get brand: ${response.statusText}`);
      }
    }

    return await response.json();
  }
}

export default EmporixBrandApi;
