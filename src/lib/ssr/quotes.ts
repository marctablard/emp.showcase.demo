'use server';

import { cache } from 'react';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Quote } from '@/platform/services/model/quote';
import type { QuoteService } from '@/platform/services/quote/QuoteService';
import ssr from '@/platform/ssr';

/**
 * Get the quote service instance from the platform container
 */
const getQuoteService = () => ssr.get<QuoteService>('QuoteService');
const getLogger = () => ssr.get<LoggerService>('LoggerService');

/**
 * Get a specific quote by ID
 * This function is cached to prevent multiple quote fetches in a single request
 */
export const getQuoteById = cache(async (quoteId: string): Promise<Quote | null | undefined> => {
  try {
    const quoteService = getQuoteService();
    return await quoteService.getQuote(quoteId);
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error), quoteId },
      'SSR getQuoteById failed',
    );
    return undefined;
  }
});

export interface SsrQuotesPageResult {
  items: Quote[];
  totalCount?: number;
}

/**
 * Get all quotes for the current customer with optional pagination and sort.
 * This function is cached to prevent multiple quote fetches in a single request.
 * `pageNumber` is 0-based, matching the `SearchParams.page` convention used by
 * the client hook (`useQuotes`) and the `/api/quotes` route.
 */
export const getQuotes = cache(
  async (pageSize?: number, pageNumber?: number, sort?: string): Promise<SsrQuotesPageResult | undefined> => {
    try {
      const quoteService = getQuoteService();
      const result = await quoteService.getQuotes({ size: pageSize, page: pageNumber, sort });
      return { items: result.items, totalCount: result.total };
    } catch (error) {
      getLogger().error(
        { error: error instanceof Error ? error.message : String(error), pageSize, pageNumber, sort },
        'SSR getQuotes failed',
      );
      return undefined;
    }
  },
);
