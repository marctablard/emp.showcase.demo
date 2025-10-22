import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import { buildPaginatedResponse, buildSearchQuery } from '../../common/util/common';
import type { EmporixConfig } from '../../config';
import { EmporixPaginatedResponse, EmporixSearchParams } from '../../model';
import {
  EmporixCreateQuoteReasonRequest,
  EmporixCreateQuoteRequest,
  EmporixQuoteCreationResponse,
  EmporixQuoteHistory,
  EmporixQuoteReason,
  EmporixQuoteReasonCreationResponse,
} from '../../model/quote';
import { EmporixQuote } from '../../model/quote';
import type { EmporixQuoteApi as IEmporixQuoteApi } from '../EmporixQuoteApi';

@injectable('EmporixQuoteApi', 'Singleton')
class EmporixQuoteApi implements IEmporixQuoteApi {
  constructor(
    @inject('EmporixApiInvoker') private apiClient: EmporixApiClient,
    @inject('EmporixConfig') private config: EmporixConfig,
  ) {}

  /**
   * Common method to handle PATCH operations on quotes
   */
  async patchQuote(
    quoteId: string,
    body: any,
    scope: 'public' | 'session' | 'customer-saas' | 'service' = 'public',
  ): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/quote/${this.config.tenant}/quotes/${quoteId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      },
      scope,
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to update quote ${body.path} : ${response.statusText} ${errorDetails}`);
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
      //TODO: Changed to service now as the customer cannot create quotes with cartId and without company addresses.
      // Should be reverted to session later.
      'service',
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
        },
      },
      'service',
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
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to fetch quote ${quoteId}: ${response.statusText} ${errorDetails}`);
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
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to fetch quote reason ${quoteReasonId}: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  async createQuoteReason(
    createQuoteReasonRequest: EmporixCreateQuoteReasonRequest,
  ): Promise<EmporixQuoteReasonCreationResponse> {
    const response = await this.apiClient.authenticatedFetch(
      `/quote/${this.config.tenant}/quote-reasons`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createQuoteReasonRequest),
      },
      'service',
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to create quote reason: ${response.statusText} ${errorDetails}`);
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
      },
      'service',
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to fetch quote history: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }
}

export default EmporixQuoteApi;
