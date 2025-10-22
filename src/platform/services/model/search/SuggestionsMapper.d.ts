import { Product } from '../product';
import { CategorySuggestion, SearchSuggestions } from './SearchSuggestions';

/**
 * Interface for mapping search suggestion responses from API to domain models
 */
export interface SuggestionsMapper {
  /**
   * Maps query completions from the API response
   * @param item - The query completion item from the API response
   * @returns Array of query completion strings
   */
  mapQueryCompletions(item: any): string[];

  /**
   * Maps category suggestions from the API response
   * @param item - The category facet item from the API response
   * @returns Array of category suggestions
   */
  mapCategorySuggestions(item: any): CategorySuggestion[];

  /**
   * Maps product suggestions from the API response
   * @param item - The document item from the API response
   * @returns Array of product models
   */
  mapProductSuggestions(item: any): Product[];

  /**
   * Filters API response items by siteCode for document items
   * @param apiResponse - The complete API response array
   * @param siteCode - The site code to filter by
   * @returns Filtered API response array
   */
  filterBySite(apiResponse: any[], siteCode?: string): any[];

  /**
   * Maps the complete API response to a search suggestions object
   * @param apiResponse - The complete API response array
   * @returns Search suggestions object containing query completions, products, and categories
   */
  mapSearchSuggestions(apiResponse: any[]): SearchSuggestions;
}
