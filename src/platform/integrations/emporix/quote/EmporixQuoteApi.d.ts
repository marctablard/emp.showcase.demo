import type { EmporixPaginatedResponse, EmporixSearchParams } from '../model/common';
import type {
  EmporixCreateQuoteReasonRequest,
  EmporixCreateQuoteRequest,
  EmporixQuoteCreationResponse,
  EmporixQuoteHistory,
  EmporixQuoteReason,
  EmporixQuoteReasonCreationResponse,
} from '../model/quote';
import type { EmporixQuote } from '../model/quote-list';

/**
 * Interface for Quote API operations
 */
export interface EmporixQuoteApi {
  /**
   * Create a new quote from current cart and checkout data
   */
  createQuote(createQuoteRequest: EmporixCreateQuoteRequest): Promise<EmporixQuoteCreationResponse>;

  /**
   * Get a list of quotes with optional filters
   */
  getQuotes(params: EmporixSearchParams<EmporixQuote>): Promise<EmporixPaginatedResponse<EmporixQuote>>;

  /**
   * Get a specific quote by ID
   */
  getQuote(quoteId: string): Promise<EmporixQuote>;

  /**
   * Get all available quote reasons
   */
  getQuoteReasons(): Promise<EmporixQuoteReason[]>;

  /**
   * Get a specific quote reason by ID
   * @param quoteReasonId The ID of the quote reason to retrieve
   * @returns Promise with the retrieved quote reason
   */
  getQuoteReason(quoteReasonId: string): Promise<EmporixQuoteReason>;

  /**
   * Get quote history for a specific quote
   * @param quoteId The ID of the quote to get history for
   * @returns Promise with the quote history array
   */
  getQuoteHistory(quoteId: string): Promise<EmporixQuoteHistory>;

  /**
   * Common method to handle PATCH operations on quotes
   */
  patchQuote(quoteId: string, body: any, scope: 'public' | 'session' | 'customer-saas' | 'service'): Promise<void>;
}
