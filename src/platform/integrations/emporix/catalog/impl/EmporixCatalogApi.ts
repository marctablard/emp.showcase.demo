import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import { buildPaginatedResponse, buildSearchQuery } from '../../common/util/common';
import type { EmporixConfig } from '../../config';
import { EmporixCatalog, EmporixPaginatedResponse, EmporixSearchParams } from '../../model';
import { EmporixCatalogApi as IEmporixCatalogApi } from '../EmporixCatalogApi';

@injectable('EmporixCatalogApi', 'Singleton')
class EmporixCatalogApi implements IEmporixCatalogApi {
  constructor(
    @inject('EmporixApiInvoker') protected apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected config: EmporixConfig,
  ) {}

  async getCatalogs(params: EmporixSearchParams<any>): Promise<EmporixPaginatedResponse<EmporixCatalog>> {
    const { body: _body, query } = buildSearchQuery(params, true);
    const response = await this.apiClient.authenticatedFetch(
      `/catalog/${this.config.tenant}/catalogs?${query}`,
      { method: 'GET', headers: { 'X-Total-Count': 'true' } },
      'public',
    );

    return buildPaginatedResponse(params, response);
  }

  async getCatalog(id: string): Promise<EmporixCatalog | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/catalog/${this.config.tenant}/catalogs/${id}`,
      { method: 'GET' },
      'public',
    );
    if (!response.ok) {
      if (response.status == 404) {
        return null;
      } else {
        throw new Error(`Failed to get catalog: ${response.statusText}`);
      }
    }
    return await response.json();
  }
}

export default EmporixCatalogApi;
