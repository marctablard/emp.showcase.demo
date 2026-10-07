import { Product } from '../product';

/**
 * Interface for category suggestion in search results
 */
export interface CategorySuggestion {
  name: string;
  highlighted?: string;
  count: number;
  idPath?: string;
}

/**
 * Interface for search suggestions response including products, query completions, and categories
 */
export interface SearchSuggestions {
  queryCompletions: string[];
  products: Product[];
  categories: CategorySuggestion[];
}
