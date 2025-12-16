import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import { buildPaginatedResponse, buildSearchQuery } from '../../common/util/common';
import type { EmporixConfig } from '../../config';
import { EmporixPaginatedResponse, EmporixProduct, EmporixSearchParams } from '../../model';
import { EmporixProductApi as IEmporixProductApi } from '../EmporixProductApi';

@injectable('EmporixProductApi', 'Singleton')
class EmporixProductApi implements IEmporixProductApi {
  constructor(
    @inject('EmporixApiInvoker') protected apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected config: EmporixConfig,
  ) {}

  async getProducts(page?: number, pageSize?: number): Promise<EmporixPaginatedResponse<EmporixProduct>> {
    const params: EmporixSearchParams<EmporixProduct> = {
      page: page || 0,
      size: pageSize || 20,
    };
    const { body: _body, query } = buildSearchQuery(params);
    const response = await this.apiClient.authenticatedFetch(
      `/product/${this.config.tenant}/products?${query}`,
      { method: 'GET', headers: { 'X-Total-Count': 'true' } },
      'public',
    );

    return buildPaginatedResponse(params, response);
  }

  async searchProducts(params: EmporixSearchParams<EmporixProduct>): Promise<EmporixPaginatedResponse<EmporixProduct>> {
    const { body, query } = buildSearchQuery(params);
    const response = await this.apiClient.authenticatedFetch(
      `/product/${this.config.tenant}/products/search?${query}`,
      {
        method: 'POST',
        headers: {
          'X-Total-Count': 'true',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: body }),
      },
      'public',
    );
    return buildPaginatedResponse(params, response);
  }

  async getProduct(id: string): Promise<EmporixProduct | undefined> {
    const response = await this.apiClient.authenticatedFetch(
      `/product/${this.config.tenant}/products/${id}?expand=parentVariant,template`,
      { method: 'GET' },
      'public',
    );
    if (!response.ok) {
      if (response.status == 404) {
        return undefined;
      } else {
        throw new Error(`Failed to get product: ${response.statusText}`);
      }
    }
    return await response.json();
  }
}
export default EmporixProductApi;
