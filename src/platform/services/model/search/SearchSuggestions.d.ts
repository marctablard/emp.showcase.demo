import { Product } from '../product';

/**
 * Interface for category suggestion in search results
 */
export interface CategorySuggestion {
  name: string;
  highlighted?: string;
  count: number;
  idPath?: string;
  /**
   * Emporix category id. When set, suggestion links use `filters[categoryIds]`
   * instead of a BatteryIncluded display path.
   */
  categoryId?: string;
}

/**
 * Interface for search suggestions response including products, query completions, and categories
 */
export interface SearchSuggestions {
  queryCompletions: string[];
  products: Product[];
  categories: CategorySuggestion[];
}
