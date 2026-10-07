import type { BatteryIncludedBrowseVariables } from '@/platform/integrations/batteryincluded/model';
import { SearchParams, SearchResult } from '../model/common';
import { Product, ProductRecommendations } from '../model/product';
import { SearchSuggestions } from '../model/search';
import type { ProductFetchOptions } from '../product/ProductService';

export interface RecommendationsOptions {
  /**
   * Customer segment scope (COP-4822). `undefined` → unscoped (anonymous / unsegmented / `all`);
   * a non-empty array → recommendations restricted to products of these segments;
   * `[]` → empty scope: the implementation returns `[]` without any upstream call (fail closed).
   */
  segmentIds?: string[];
}

export interface SearchService {
  /**
   * Search for products based on the provided parameters
   */
  searchProducts(params: SearchParams<Product>, locale?: string, site?: string): Promise<SearchResult<Product>>;

  /**
   * Load a single catalog product by URL id using the bound search engine.
   * Battery Included: visibility-scoped browse. Emporix: Product GET.
   */
  getCatalogProductById(
    id: string,
    options?: ProductFetchOptions,
    locale?: string,
    site?: string,
  ): Promise<Product | undefined>;

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
  getHighlights(visibility?: BatteryIncludedBrowseVariables): Promise<Product[]>;

  /**
   * Get product recommendations based on a product ID.
   * `options.segmentIds` follows the `RecommendationsOptions` contract: `undefined` unscoped,
   * array scoped, `[]` empty result with no upstream call.
   */
  getRecommendations(
    productId: string,
    locale?: string,
    site?: string,
    limit?: number,
    visibility?: BatteryIncludedBrowseVariables,
    options?: RecommendationsOptions,
  ): Promise<ProductRecommendations>;
}
