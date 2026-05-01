import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createEmporixApiError } from '@/platform/integrations/emporix/common/EmporixApiError';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type { EmporixReturnCreateRequest, EmporixReturnId, EmporixReturnResponse } from '../../model/return';
import type { EmporixReturnApi as IEmporixReturnApi } from '../EmporixReturnApi';

const createReturnMetrics = (route: string) => createFetchMetricsParams('return', route);

/**
 * Implementation of the Emporix Return API
 * Uses the Returns Service endpoints: GET /return/{tenant}/returns
 */
@injectable('EmporixReturnApi', 'Singleton')
class EmporixReturnApi implements IEmporixReturnApi {
  constructor(
    @inject('EmporixApiInvoker') protected apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected config: EmporixConfig,
  ) {
    this.apiClient = apiClient;
    this.config = config;
  }

  /**
   * Get all returns for the current customer
   * Requires scope: returns.returns_read_own
   */
  async getReturns(
    pageNumber: number = 1,
    pageSize: number = 16,
    sort?: string,
    query?: string,
  ): Promise<{ items: EmporixReturnResponse[]; totalCount?: number }> {
    let url = `/return/${this.config.tenant}/returns?pageNumber=${pageNumber}&pageSize=${pageSize}`;

    if (sort) {
      url += `&sort=${encodeURIComponent(sort)}`;
    }

    if (query) {
      url += `&q=${encodeURIComponent(query)}`;
    }

    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'GET',
        headers: {
          'X-Total-Count': 'true',
        },
      },
      'session',
      undefined,
      createReturnMetrics('/return/{tenant}/returns'),
    );

    if (!response.ok) {
      throw await createEmporixApiError('Get returns', response);
    }

    const totalCountHeader = response.headers.get('x-total-count');
    const parsedTotalCount = totalCountHeader ? parseInt(totalCountHeader, 10) : Number.NaN;
    const items = (await response.json()) as EmporixReturnResponse[];

    return {
      items,
      totalCount: Number.isFinite(parsedTotalCount) ? parsedTotalCount : undefined,
    };
  }

  /**
   * Get a specific return by ID
   * Requires scope: returns.returns_read_own
   */
  async getReturn(returnId: string): Promise<EmporixReturnResponse | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/return/${this.config.tenant}/returns/${returnId}`,
      { method: 'GET' },
      'session',
      undefined,
      createReturnMetrics('/return/{tenant}/returns/{id}'),
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw await createEmporixApiError('Get return', response);
    }

    return await response.json();
  }

  /**
   * Create a new return
   * Requires scope: returns.returns_manage_own
   */
  async createReturn(request: EmporixReturnCreateRequest): Promise<EmporixReturnId> {
    const response = await this.apiClient.authenticatedFetch(
      `/return/${this.config.tenant}/returns`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      },
      'session',
      undefined,
      createReturnMetrics('/return/{tenant}/returns'),
    );

    if (!response.ok) {
      throw await createEmporixApiError('Create return', response);
    }

    return await response.json();
  }
}

export default EmporixReturnApi;
