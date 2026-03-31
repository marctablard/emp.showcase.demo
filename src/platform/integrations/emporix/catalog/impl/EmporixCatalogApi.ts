import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
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
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  async getCatalogs(params: EmporixSearchParams<any>): Promise<EmporixPaginatedResponse<EmporixCatalog>> {
    const { body: _body, query } = buildSearchQuery(params, true);
    this.logger.info(
      {
        path: `/catalog/${this.config.tenant}/catalogs`,
        query,
      },
      'Emporix catalogs request',
    );
    const response = await this.apiClient.authenticatedFetch(
      `/catalog/${this.config.tenant}/catalogs?${query}`,
      { method: 'GET', headers: { 'X-Total-Count': 'true' } },
      'public',
    );

    const result = await buildPaginatedResponse<EmporixCatalog>(params, response);
    this.logger.info(
      {
        itemCount: result.items.length,
        total: result.total,
        page: result.page,
      },
      'Emporix catalogs response',
    );
    return result;
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
