import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createEmporixApiError } from '@/platform/integrations/emporix/common/EmporixApiError';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import { buildPaginatedResponse, buildSearchQuery } from '../../common/util/common';
import type { EmporixConfig } from '../../config';
import type { EmporixPaginatedResponse, EmporixSearchParams } from '../../model';
import type {
  EmporixCreateQuoteRequest,
  EmporixQuoteCreationResponse,
  EmporixQuoteHistory,
  EmporixQuoteReason,
} from '../../model/quote';
import type { EmporixQuote } from '../../model/quote';
import type { EmporixQuoteApi as IEmporixQuoteApi } from '../EmporixQuoteApi';

const createQuoteMetrics = (route: string) => createFetchMetricsParams('quote', route);

@injectable('EmporixQuoteApi', 'Singleton')
class EmporixQuoteApi implements IEmporixQuoteApi {
  constructor(
    @inject('EmporixApiInvoker') protected apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected config: EmporixConfig,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  /**
   * Common method to handle PATCH operations on quotes
   */
  async patchQuote(
    quoteId: string,
    body: any,
    scope: 'public' | 'session' | 'customer-saas' | 'service' = 'public',
  ): Promise<void> {
    const endpoint = `/quote/${this.config.tenant}/quotes/${quoteId}`;
    const firstOpPath =
      Array.isArray(body) && body[0] && typeof body[0] === 'object' && 'path' in body[0]
        ? String((body[0] as { path?: string }).path)
        : undefined;

    const response = await this.apiClient.authenticatedFetch(
      endpoint,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      },
      scope,
      undefined,
      createQuoteMetrics('/quote/{tenant}/quotes/{id}'),
    );

    if (!response.ok) {
      const responseBody = await response.text();

      this.logger.error(
        {
          endpoint,
          method: 'PATCH',
          quoteId,
          scope,
          operationPath: firstOpPath,
          operationCount: Array.isArray(body) ? body.length : undefined,
          status: response.status,
          statusText: response.statusText,
          hasResponseBody: responseBody.length > 0,
          responseBodyLength: responseBody.length,
        },
        'Emporix quote patch failed',
      );

      throw await createEmporixApiError(
        `Failed to update quote ${quoteId}${firstOpPath ? ` (${firstOpPath})` : ''}`,
        new Response(responseBody, {
          status: response.status,
          statusText: response.statusText,
        }),
      );
    }
  }

  async createQuote(createQuoteRequest: EmporixCreateQuoteRequest): Promise<EmporixQuoteCreationResponse> {
    const response = await this.apiClient.authenticatedFetch(
      `/quote/${this.config.tenant}/quotes`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(createQuoteRequest),
      },
      // From-cart quote creation requires the customer's `session` token
      // (carries `legalEntityId` for B2B + `quote.quote_manage_own` scope per
      // resources/emporix/quote.yml). Manual-payload creation from a CUSTOMER
      // token is rejected by Emporix with 403, so this endpoint is
      // intentionally scoped to `session` — the showcase only issues
      // QuoteCreateFromCartRequest bodies here.
      'session',
      undefined,
      createQuoteMetrics('/quote/{tenant}/quotes'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to create quote: ${response.statusText} ${errorDetails}`);
    }

    const json = await response.json();
    return { quoteId: json.id };
  }

  async getQuotes(params: EmporixSearchParams<EmporixQuote>): Promise<EmporixPaginatedResponse<EmporixQuote>> {
    const { body, query } = buildSearchQuery(params);
    const response = await this.apiClient.authenticatedFetch(
      `/quote/${this.config.tenant}/quotes?q=${body}&${query}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Total-Count': 'true',
        },
        cache: 'no-store',
      },
      'service',
      undefined,
      createQuoteMetrics('/quote/{tenant}/quotes'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to fetch quotes: ${response.statusText} ${errorDetails}`);
    }

    const paginatedResponse = await buildPaginatedResponse<EmporixQuote>(params, response);
    return paginatedResponse;
  }

  async getQuote(quoteId: string): Promise<EmporixQuote> {
    const response = await this.apiClient.authenticatedFetch(
      `/quote/${this.config.tenant}/quotes/${quoteId}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      },
      'session',
      undefined,
      createQuoteMetrics('/quote/{tenant}/quotes/{id}'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to fetch quote ${quoteId}: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  async getQuoteReasons(): Promise<EmporixQuoteReason[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/quote/${this.config.tenant}/quote-reasons`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
      'service',
      undefined,
      createQuoteMetrics('/quote/{tenant}/quote-reasons'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to fetch quote reasons: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  async getQuoteReason(quoteReasonId: string): Promise<EmporixQuoteReason> {
    const response = await this.apiClient.authenticatedFetch(
      `/quote/${this.config.tenant}/quote-reasons/${quoteReasonId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: '*/*',
        },
      },
      'session',
      undefined,
      createQuoteMetrics('/quote/{tenant}/quote-reasons/{id}'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to fetch quote reason ${quoteReasonId}: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  async getQuoteHistory(quoteId: string): Promise<EmporixQuoteHistory> {
    const response = await this.apiClient.authenticatedFetch(
      `/quote/${this.config.tenant}/quotes/${quoteId}/history`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
      'service',
      undefined,
      createQuoteMetrics('/quote/{tenant}/quotes/{id}/history'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to fetch quote history: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }
}

export default EmporixQuoteApi;
