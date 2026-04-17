import type { Quote } from '..';

/**
 * Interface for mapping external quote data to application Quote model
 */
export interface QuoteMapper<T> {
  /**
   * Maps external quote data to the application Quote model
   * @param sourceQuote External quote data
   * @returns Mapped Quote entity
   */
  mapToService(sourceQuote: T): Promise<Quote> | Quote;
}
