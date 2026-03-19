// c:\Workspace\emporix-showcase\src\platform\services\search\SearchService.d.ts
import { SearchParams, SearchResult } from '../model/common';
import { Product } from '../model/product';
import { SearchSuggestions } from '../model/search';

export interface SearchService {
  /**
   * Search for products based on the provided parameters
   */
  searchProducts(params: SearchParams<Product>, locale?: string, site?: string): Promise<SearchResult<Product>>;

  /**
   * Get product suggestions based on a search query
   * @param query Search query string
   * @param locale Optional locale for localized content
   * @returns SearchSuggestions object containing query completions, products, and categories
   */
  getSuggestions(params: SearchParams<Product>): Promise<SearchSuggestions>;

  /**
   * Get highlighted products
   */
  getHighlights(): Promise<Product[]>;

  /**
   * Get product recommendations based on a product ID
   */
  getRecommendations(productId: string, locale?: string, site?: string): Promise<Product[]>;
}
