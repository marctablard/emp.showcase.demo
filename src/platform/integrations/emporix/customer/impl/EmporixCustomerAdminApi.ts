import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createEmporixApiError } from '@/platform/integrations/emporix/common/EmporixApiError';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type {
  EmporixCustomerAdmin,
  EmporixCustomerAdminCreateRequest,
  EmporixCustomerAdminUpdateRequest,
} from '../../model/customer';
import type { EmporixCustomerAdminApi as IEmporixCustomerAdminApi } from '../EmporixCustomerAdminApi';

const createCustomerMetrics = (route: string) => createFetchMetricsParams('customer', route);

function toCustomerListQueryString(pageNumber?: number, pageSize?: number, sort?: string, query?: string): string {
  const queryParams = new URLSearchParams();

  if (pageNumber !== undefined) {
    queryParams.append('pageNumber', pageNumber.toString());
  }

  if (pageSize !== undefined) {
    queryParams.append('pageSize', pageSize.toString());
  }

  if (sort) {
    queryParams.append('sort', sort);
  }

  if (query) {
    queryParams.append('q', query);
  }

  const encoded = queryParams.toString();
  return encoded ? `?${encoded}` : '';
}

/**
 * Read the live list count header. OpenAPI documents `Count` (number retrieved);
 * some deployments also return `x-total-count`. Never fall back to page length.
 */
function parseListTotalCount(headers: Headers): number | undefined {
  const raw = headers.get('x-total-count') ?? headers.get('Count');
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const rawBody = await response.clone().text();
  if (!rawBody) {
    return '';
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return rawBody;
  }
}

@injectable('EmporixCustomerAdminApi', 'Singleton')
class EmporixCustomerAdminApi implements IEmporixCustomerAdminApi {
  constructor(
    @inject('EmporixApiInvoker') protected readonly apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected readonly config: EmporixConfig,
    @inject('LoggerService') protected readonly logger: LoggerService,
  ) {}

  async getCustomers(
    pageNumber: number = 1,
    pageSize: number = 60,
    sort?: string,
    query?: string,
    tokenType: 'service' | 'session' = 'session',
  ): Promise<{ items: EmporixCustomerAdmin[]; totalCount?: number }> {
    const url = `customer/${this.config.tenant}/customers${toCustomerListQueryString(pageNumber, pageSize, sort, query)}`;

    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      },
      tokenType,
      undefined,
      createCustomerMetrics('/customer/{tenant}/customers'),
    );

    if (!response.ok) {
      throw new Error(`Failed to list customers: ${response.statusText}`);
    }

    const items = (await response.json()) as EmporixCustomerAdmin[];
    return {
      items,
      totalCount: parseListTotalCount(response.headers),
    };
  }

  async getCustomer(
    customerNumber: string,
    tokenType: 'service' | 'session' = 'session',
  ): Promise<EmporixCustomerAdmin | null> {
    const url = `customer/${this.config.tenant}/customers/${encodeURIComponent(customerNumber)}`;

    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      },
      tokenType,
      undefined,
      createCustomerMetrics('/customer/{tenant}/customers/{customerNumber}'),
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get customer: ${response.statusText}`);
    }

    return (await response.json()) as EmporixCustomerAdmin;
  }

  async createCustomer(customer: EmporixCustomerAdminCreateRequest, legalEntityId: string): Promise<{ id: string }> {
    const url = `customer/${this.config.tenant}/customers?sendPasswordResetNotifications=true`;
    const {
      password: _omittedPassword,
      b2b: _omittedB2b,
      ...inviteBody
    } = customer as EmporixCustomerAdminCreateRequest & {
      password?: string;
      b2b?: unknown;
    };
    if (!legalEntityId) {
      throw new Error('Legal entity ID is required to create a customer');
    }

    const requestHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(inviteBody),
      },
      'service',
      undefined,
      createCustomerMetrics('/customer/{tenant}/customers'),
    );

    const logContext = {
      operation: 'Create customer',
      tokenType: 'service',
      method: 'POST',
      url,
      requestHeaders,
      requestBody: inviteBody,
      selectedLegalEntityId: legalEntityId,
      responseStatus: response.status,
      responseStatusText: response.statusText,
      responseBody: await readResponseBody(response),
    };
    if (response.ok) {
      this.logger.info(logContext, 'EXTERNAL Create customer response');
    } else {
      this.logger.error(logContext, 'EXTERNAL Create customer response');
    }

    if (!response.ok) {
      throw await createEmporixApiError('Create customer', response);
    }

    const location = (await response.json()) as { id: string };
    return { id: location.id };
  }

  async updateCustomer(
    customerNumber: string,
    customer: EmporixCustomerAdminUpdateRequest,
    tokenType: 'service' | 'session' = 'session',
  ): Promise<void> {
    const url = `customer/${this.config.tenant}/customers/${encodeURIComponent(customerNumber)}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'PATCH',
        headers: requestHeaders,
        body: JSON.stringify(customer),
      },
      tokenType,
      undefined,
      createCustomerMetrics('/customer/{tenant}/customers/{customerNumber}'),
    );

    const logContext = {
      operation: 'Update customer',
      tokenType,
      method: 'PATCH',
      url,
      requestHeaders,
      requestBody: customer,
      responseStatus: response.status,
      responseBody: await readResponseBody(response),
    };
    if (response.ok) {
      this.logger.info(logContext, 'EXTERNAL Update customer response');
    } else {
      this.logger.error(logContext, 'EXTERNAL Update customer response');
    }

    if (!response.ok) {
      throw await createEmporixApiError('Update customer', response);
    }
  }

  async deleteCustomer(customerNumber: string, tokenType: 'service' | 'session' = 'session'): Promise<void> {
    const url = `customer/${this.config.tenant}/customers/${encodeURIComponent(customerNumber)}`;

    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
        },
      },
      tokenType,
      undefined,
      createCustomerMetrics('/customer/{tenant}/customers/{customerNumber}'),
    );

    if (!response.ok && response.status !== 202) {
      throw await createEmporixApiError('Delete customer', response);
    }
  }
}

export default EmporixCustomerAdminApi;
