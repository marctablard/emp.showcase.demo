import { SearchParams, SearchResult } from '../model/common';
import type {
  CreateQuoteInput,
  QuoteHistory,
  QuoteReason,
  QuoteReasonCreationResponse,
  QuoteScope,
  QuoteUpdateRequest,
} from '../model/quote';
import { Quote } from '../model/quote';

export interface QuoteService {
  /**
   * Create a new quote
   */
  createQuote(input: CreateQuoteInput): Promise<{ quoteId: string }>;

  /**
   * Get a list of quotes with optional filters
   */
  getQuotes(params?: SearchParams<Quote>): Promise<SearchResult<Quote>>;

  /**
   * Get a specific quote by ID
   */
  getQuote(quoteId: string): Promise<Quote>;

  /**
   * Updates a quote with single or multiple operations
   * @param quoteId - The ID of the quote to update
   * @param operations - Single operation or array of patch operations to apply
   * @param scope - The scope to update the quote in, defaults to 'public'
   * @returns Promise that resolves when the update is complete
   */
  updateQuote(
    quoteId: string,
    operations: QuoteUpdateRequest | QuoteUpdateRequest[],
    scope?: QuoteScope,
  ): Promise<void>;

  /**
   * Set or update the quote user comment (additionalInfo mixin) using the service patch scope.
   */
  addQuoteUserComment(quoteId: string, input: { comment: string; reference?: string }): Promise<void>;

  /**
   * Get a specific quote reason by ID
   * @param quoteReasonId - The ID of the quote reason to retrieve
   * @returns Promise with the quote reason details
   */
  getQuoteReason(quoteReasonId: string): Promise<QuoteReason>;

  /**
   * Create a new quote reason
   * @param quoteId - The ID of the quote
   * @param comment - The comment for the quote reason
   * @param locale - The locale for the message
   * @param reasonType - The type of reason ('DECLINE' or 'CHANGE')
   * @returns Promise with the ID of the created quote reason
   */
  createQuoteReason(quoteId: string, comment: string, locale: string, reasonType: string): Promise<string>;

  /**
   * Get quote history for a specific quote
   * @param quoteId - The ID of the quote to get history for
   * @returns Promise with the quote history
   */
  getQuoteHistory(quoteId: string): Promise<QuoteHistory>;
}
