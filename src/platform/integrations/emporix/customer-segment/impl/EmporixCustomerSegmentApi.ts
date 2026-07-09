import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type { CategoryTreeItemResponse, CustomerSegmentQueryParams, ItemAssignmentResponse } from '../../model';
import type { EmporixCustomerSegmentApi as IEmporixCustomerSegmentApi } from '../EmporixCustomerSegmentApi';

const createCustomerSegmentMetrics = (route: string) => createFetchMetricsParams('customer-segment', route);

@injectable('EmporixCustomerSegmentApi', 'Singleton')
class EmporixCustomerSegmentApi implements IEmporixCustomerSegmentApi {
  constructor(
    @inject('EmporixApiInvoker') protected readonly apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected readonly config: EmporixConfig,
  ) {}

  async getSegmentItems(params?: CustomerSegmentQueryParams): Promise<ItemAssignmentResponse[]> {
    const queryString = this.buildQueryString(params);
    const url = `/customer-segment/${this.config.tenant}/segments/items${queryString ? `?${queryString}` : ''}`;

    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'GET',
      },
      'session',
      undefined,
      createCustomerSegmentMetrics('/customer-segment/{tenant}/segments/items'),
    );
    if (!response.ok) {
      throw new Error(`Failed to retrieve customer segment items: ${response.statusText}`);
    }

    return response.json();
  }

  async getCategoryTrees(params?: CustomerSegmentQueryParams): Promise<CategoryTreeItemResponse[]> {
    const queryString = this.buildQueryString(params);
    const url = `/customer-segment/${this.config.tenant}/segments/items/category-trees${
      queryString ? `?${queryString}` : ''
    }`;

    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'GET',
      },
      'session',
      undefined,
      createCustomerSegmentMetrics('/customer-segment/{tenant}/segments/items/category-trees'),
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve customer segment category trees: ${response.statusText}`);
    }

    return response.json();
  }

  private buildQueryString(params?: CustomerSegmentQueryParams): string {
    const queryParams = new URLSearchParams();

    if (params) {
      if (params.q) {
        queryParams.append('q', params.q);
      }
      if (params.pageSize) {
        queryParams.append('pageSize', params.pageSize.toString());
      }
      if (params.pageNumber) {
        queryParams.append('pageNumber', params.pageNumber.toString());
      }
      if (params.sort) {
        queryParams.append('sort', params.sort);
      }
      if (params.fields) {
        queryParams.append('fields', params.fields);
      }
      if (params.legalEntityId) {
        queryParams.append('legalEntityId', params.legalEntityId);
      }
      if (params.siteCode) {
        queryParams.append('siteCode', params.siteCode);
      }
      if (params.onlyActive !== undefined) {
        queryParams.append('onlyActive', String(params.onlyActive));
      }
    }
    return queryParams.toString();
  }
}

export default EmporixCustomerSegmentApi;
