import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import { DEFAULT_CACHE_REVALIDATE } from '../../common/cache-defaults';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type { EmporixTaxConfiguration } from '../../model/tax';
import type { EmporixTaxApi as IEmporixTaxApi } from '../EmporixTaxApi';

const createTaxMetrics = (route: string) => createFetchMetricsParams('tax', route);

@injectable('EmporixTaxApi', 'Singleton')
class EmporixTaxApi implements IEmporixTaxApi {
  constructor(
    @inject('EmporixApiInvoker') protected apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected config: EmporixConfig,
  ) {
    this.apiClient = apiClient;
    this.config = config;
  }

  async getTaxConfiguration(locationCode: string): Promise<EmporixTaxConfiguration | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/tax/${this.config.tenant}/taxes/${encodeURIComponent(locationCode)}`,
      {
        method: 'GET',
      },
      'service',
      { scopes: ['tax.tax_read'] },
      createTaxMetrics('/tax/{tenant}/taxes/{locationCode}'),
      DEFAULT_CACHE_REVALIDATE,
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      } else {
        throw new Error(`Failed to get tax configuration: ${response.statusText}`);
      }
    }

    return await response.json();
  }
}

export default EmporixTaxApi;
