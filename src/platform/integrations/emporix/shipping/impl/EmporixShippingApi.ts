import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import { DEFAULT_CACHE_REVALIDATE } from '../../common/cache-defaults';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type { EmporixFindSiteRequest, EmporixShippingSite } from '../../model';
import type { EmporixShippingMethod } from '../../model/shipping';
import type { EmporixShippingApi as IEmporixShippingApi } from '../EmporixShippingApi';

const createShippingMetrics = (route: string) => createFetchMetricsParams('shipping', route);

@injectable('EmporixShippingApi', 'Singleton')
class EmporixShippingApi implements IEmporixShippingApi {
  constructor(
    @inject('EmporixApiInvoker') protected apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected config: EmporixConfig,
  ) {
    this.apiClient = apiClient;
    this.config = config;
  }

  async getShippingMethod(siteId: string, zoneId: string, methodId: string): Promise<EmporixShippingMethod | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/shipping/${this.config.tenant}/${siteId}/zones/${zoneId}/methods/${methodId}`,
      { method: 'GET' },
      'public',
      undefined,
      createShippingMetrics('/shipping/{tenant}/{id}/zones/{id}/methods/{id}'),
      DEFAULT_CACHE_REVALIDATE,
    );
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      } else {
        throw new Error(`Failed to get shipping method: ${response.statusText}`);
      }
    }
    return await response.json();
  }

  async getShippingMethods(siteId: string, zoneId: string): Promise<EmporixShippingMethod[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/shipping/${this.config.tenant}/${siteId}/zones/${zoneId}/methods`,
      { method: 'GET' },
      'public',
      undefined,
      createShippingMetrics('/shipping/{tenant}/{id}/zones/{id}/methods'),
      DEFAULT_CACHE_REVALIDATE,
    );

    if (!response.ok) {
      throw new Error(`Failed to get shipping methods: ${response.statusText}`);
    }

    return await response.json();
  }

  async findSite(request: EmporixFindSiteRequest): Promise<EmporixShippingSite[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/shipping/${this.config.tenant}/findSite`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      },
      'public',
      undefined,
      createShippingMetrics('/shipping/{tenant}/findSite'),
    );

    if (!response.ok) {
      throw new Error(`Failed to find site: ${response.statusText}`);
    }

    const result = await response.json();
    return Array.isArray(result) ? result : [result];
  }
}

export default EmporixShippingApi;
