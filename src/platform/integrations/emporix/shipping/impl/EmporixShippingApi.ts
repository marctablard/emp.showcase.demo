import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import { EmporixFindSiteRequest, EmporixShippingSite } from '../../model';
import { EmporixShippingMethod } from '../../model/shipping';
import { EmporixShippingApi as IEmporixShippingApi } from '../EmporixShippingApi';

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
    );

    if (!response.ok) {
      throw new Error(`Failed to find site: ${response.statusText}`);
    }

    const result = await response.json();
    return Array.isArray(result) ? result : [result];
  }
}

export default EmporixShippingApi;
