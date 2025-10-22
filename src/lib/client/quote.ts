import server from '@/platform/server';
import { Quote } from '@/platform/services/model/quote';
import { QuoteService } from '@/platform/services/quote/QuoteService';

/**
 * Get quote by ID using the quote service
 */
export async function getQuoteById(id: string): Promise<Quote | null> {
  try {
    const quoteService = server.get<QuoteService>('QuoteService');
    return await quoteService.getQuote(id);
  } catch (error) {
    console.error(`Failed to get quote ${id}:`, error);
    return null;
  }
}
