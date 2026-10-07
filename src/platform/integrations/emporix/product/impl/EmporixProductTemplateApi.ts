import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import type {
  EmporixPaginatedResponse,
  EmporixProductTemplateDefinition,
  EmporixSearchParams,
} from '@/platform/integrations/emporix/model';
import { DEFAULT_CACHE_REVALIDATE } from '../../common/cache-defaults';
import type EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import { buildPaginatedResponse, buildSearchQuery } from '../../common/util/common';
import type { EmporixConfig } from '../../config';
import type { EmporixProductTemplateApi as IEmporixProductTemplateApi } from '../EmporixProductTemplateApi';

const createProductTemplateMetrics = (route: string) => createFetchMetricsParams('product', route);

/**
 * Product Templates API — tenant catalog of attribute definitions (localized names).
 */
@injectable('EmporixProductTemplateApi', 'Singleton')
class EmporixProductTemplateApi implements IEmporixProductTemplateApi {
  constructor(
    @inject('EmporixApiInvoker') protected apiInvoker: EmporixApiInvoker,
    @inject('EmporixConfig') protected config: EmporixConfig,
  ) {}

  async getProductTemplates(
    page?: number,
    pageSize?: number,
  ): Promise<EmporixPaginatedResponse<EmporixProductTemplateDefinition>> {
    const params: EmporixSearchParams<EmporixProductTemplateDefinition> = {
      page: page || 0,
      size: pageSize || 20,
    };
    const { query } = buildSearchQuery(params);
    const response = await this.apiInvoker.authenticatedFetch(
      `/product/${this.config.tenant}/product-templates?${query}`,
      { method: 'GET', headers: { 'X-Total-Count': 'true', 'Accept-Language': '*' } },
      'service',
      { scopes: ['product.product_template_read'] },
      createProductTemplateMetrics('/product/{tenant}/product-templates'),
      DEFAULT_CACHE_REVALIDATE,
    );

    return buildPaginatedResponse(params, response);
  }

  async getProductTemplate(id: string, version?: string): Promise<EmporixProductTemplateDefinition | undefined> {
    const versionQuery = version ? `?version=${encodeURIComponent(version)}` : '';
    // Requires product.product_template_read — not available on the public/anonymous client.
    const response = await this.apiInvoker.authenticatedFetch(
      `/product/${this.config.tenant}/product-templates/${encodeURIComponent(id)}${versionQuery}`,
      { method: 'GET', headers: { 'Accept-Language': '*' } },
      'service',
      { scopes: ['product.product_template_read'] },
      createProductTemplateMetrics('/product/{tenant}/product-templates/{id}'),
      DEFAULT_CACHE_REVALIDATE,
    );

    if (!response.ok) {
      if (response.status === 404 || response.status === 403) {
        return undefined;
      }
      throw new Error(`Failed to get product template: ${response.statusText}`);
    }

    return await response.json();
  }
}

export default EmporixProductTemplateApi;
