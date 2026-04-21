import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import { DEFAULT_CACHE_REVALIDATE } from '../../common/cache-defaults';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import { buildPaginatedResponse, buildSearchQuery } from '../../common/util/common';
import type { EmporixConfig } from '../../config';
import type { EmporixPaginatedResponse, EmporixProduct, EmporixSearchParams } from '../../model';
import type { EmporixProductApi as IEmporixProductApi } from '../EmporixProductApi';

const createProductMetrics = (route: string) => createFetchMetricsParams('product', route);

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
      undefined,
      createProductMetrics('/product/{tenant}/products'),
      DEFAULT_CACHE_REVALIDATE,
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
      undefined,
      createProductMetrics('/product/{tenant}/products/search'),
    );
    return buildPaginatedResponse(params, response);
  }

  async getProduct(id: string): Promise<EmporixProduct | undefined> {
    const response = await this.apiClient.authenticatedFetch(
      `/product/${this.config.tenant}/products/${id}?expand=parentVariant,template`,
      { method: 'GET' },
      'public',
      undefined,
      createProductMetrics('/product/{tenant}/products/{id}'),
      DEFAULT_CACHE_REVALIDATE,
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
