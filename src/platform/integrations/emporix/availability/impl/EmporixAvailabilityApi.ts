import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import { buildPaginatedResponse } from '../../common/util/common';
import type { EmporixConfig } from '../../config';
import type { EmporixPaginatedResponse, EmporixSearchParams } from '../../model';
import type { EmporixAvailability } from '../../model/availability';
import type { EmporixAvailabilityApi as IEmporixAvailabilityApi } from '../EmporixAvailabilityApi';

@injectable('EmporixAvailabilityApi', 'Singleton')
class EmporixAvailabilityApi implements IEmporixAvailabilityApi {
  constructor(
    @inject('EmporixApiInvoker') protected apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected config: EmporixConfig,
  ) {}

  async getAvailabilitiesBySite(
    site: string,
    page?: number,
    pageSize?: number,
  ): Promise<EmporixPaginatedResponse<EmporixAvailability>> {
    const params = new URLSearchParams();
    if (page !== undefined) params.append('pageNumber', page.toString());
    if (pageSize !== undefined) params.append('pageSize', pageSize.toString());

    const query = params.toString();
    const queryString = query ? `?${query}` : '';

    const response = await this.apiClient.authenticatedFetch(
      `/availability/${this.config.tenant}/availability/site/${site}${queryString}`,
      { method: 'GET', headers: { 'X-Total-Count': 'true' } },
      'public',
    );

    if (!response.ok) {
      throw new Error(`Failed to get availabilities: ${response.statusText}`);
    }

    return buildPaginatedResponse({ page: page || 1, size: pageSize || 20 }, response);
  }

  async searchProductAvailabilities(
    site: string,
    productIds: string[],
    page?: number,
    pageSize?: number,
  ): Promise<EmporixPaginatedResponse<EmporixAvailability>> {
    const params = new URLSearchParams();
    params.append('site', site);
    if (page !== undefined) params.append('pageNumber', page.toString());
    if (pageSize !== undefined) params.append('pageSize', pageSize.toString());

    const query = params.toString();
    const queryString = query ? `?${query}` : '';

    const response = await this.apiClient.authenticatedFetch(
      `/availability/${this.config.tenant}/availability/search${queryString}`,
      {
        method: 'POST',
        headers: {
          'X-Total-Count': 'true',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productIds),
      },
      'public',
    );

    if (!response.ok) {
      throw new Error(`Failed to search product availabilities: ${response.statusText}`);
    }

    const searchParams: EmporixSearchParams<any> = { page: page || 1, size: pageSize || 20 };
    return buildPaginatedResponse(searchParams, response);
  }

  async getProductAvailability(productId: string, site: string): Promise<EmporixAvailability | undefined> {
    const response = await this.apiClient.authenticatedFetch(
      `/availability/${this.config.tenant}/availability/${productId}/${site}`,
      { method: 'GET' },
      'public',
    );

    if (!response.ok) {
      if (response.status === 404) {
        return undefined;
      }
      throw new Error(`Failed to get product availability: ${response.statusText}`);
    }

    return await response.json();
  }
}

export default EmporixAvailabilityApi;
