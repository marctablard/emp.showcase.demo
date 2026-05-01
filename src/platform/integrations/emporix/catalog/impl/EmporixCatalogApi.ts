import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import { DEFAULT_CACHE_REVALIDATE } from '../../common/cache-defaults';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import { buildPaginatedResponse, buildSearchQuery } from '../../common/util/common';
import type { EmporixConfig } from '../../config';
import type { EmporixCatalog, EmporixPaginatedResponse, EmporixSearchParams } from '../../model';
import type { EmporixCatalogApi as IEmporixCatalogApi } from '../EmporixCatalogApi';

const createCatalogMetrics = (route: string) => createFetchMetricsParams('catalog', route);

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
      undefined,
      createCatalogMetrics('/catalog/{tenant}/catalogs'),
      DEFAULT_CACHE_REVALIDATE,
    );

    return buildPaginatedResponse(params, response);
  }

  async getCatalog(id: string): Promise<EmporixCatalog | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/catalog/${this.config.tenant}/catalogs/${id}`,
      { method: 'GET' },
      'public',
      undefined,
      createCatalogMetrics('/catalog/{tenant}/catalogs/{id}'),
      DEFAULT_CACHE_REVALIDATE,
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
