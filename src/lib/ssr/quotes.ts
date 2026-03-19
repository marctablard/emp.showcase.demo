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

/**
 * Get all quotes for the current customer with optional pagination
 * This function is cached to prevent multiple quote fetches in a single request
 */
export const getQuotes = cache(async (pageSize?: number, pageNumber?: number): Promise<Quote[] | undefined> => {
  try {
    const quoteService = getQuoteService();
    const result = await quoteService.getQuotes({ size: pageSize, page: pageNumber });
    return result.items;
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error), pageSize, pageNumber },
      'SSR getQuotes failed',
    );
    return undefined;
  }
});
