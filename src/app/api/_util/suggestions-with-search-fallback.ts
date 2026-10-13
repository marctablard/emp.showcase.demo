import type { SearchParams } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import type { SearchSuggestions } from '@/platform/services/model/search';
import type { SearchService } from '@/platform/services/search/SearchService';

export const FALLBACK_SUGGESTION_PRODUCTS = 6;

/**
 * Engine suggest, with the full search as product fallback: suggest is keyword-based and applies
 * stricter visibility (e.g. per-currency prices), while the full search also interprets
 * natural-language queries. Completions and categories always come from suggest.
 */
export async function getSuggestionsWithSearchFallback(
  searchService: SearchService,
  params: SearchParams<Product>,
): Promise<SearchSuggestions> {
  const suggestions = await searchService.getSuggestions(params);
  if (suggestions.products?.length || !params.query?.trim()) {
    return suggestions;
  }
  const searchResult = await searchService.searchProducts({
    ...params,
    page: 0,
    size: FALLBACK_SUGGESTION_PRODUCTS,
  });
  return { ...suggestions, products: searchResult.items ?? [] };
}
