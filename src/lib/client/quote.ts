import { getLogger } from '@/lib/logger/use-logger-client';
import type { Quote } from '@/platform/services/model/quote';

/**
 * Get quote by ID from the API
 */
export async function getQuoteById(id: string): Promise<Quote | null> {
  try {
    const response = await fetch(`/api/quotes/${id}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch quote: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    getLogger().error({ err: error, quoteId: id }, 'Failed to get quote');
    return null;
  }
}
