import type { QuoteHistory } from '..';

/**
 * Interface for mapping external quote history data to application QuoteHistory model
 */
export interface QuoteHistoryMapper<T> {
  /**
   * Maps external quote history data to the application QuoteHistory model
   * @param sourceQuoteHistory External quote history data
   * @returns Mapped QuoteHistory entity
   */
  mapToService(sourceQuoteHistory: T): Promise<QuoteHistory> | QuoteHistory;
}
