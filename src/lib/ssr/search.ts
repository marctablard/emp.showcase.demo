import { cache } from 'react';
import { SearchParams, SearchResult } from '@/platform/services/model/common';
import { Product } from '@/platform/services/model/product';
import { SearchService } from '@/platform/services/search';
import ssr from '@/platform/ssr';

const getSearchService = () => ssr.get<SearchService>('SearchService');

const _searchProducts = cache(async (params: SearchParams<Product>): Promise<SearchResult<Product> | undefined> => {
  try {
    const searchResult = await getSearchService().searchProducts(params);
    return searchResult || null;
  } catch (_err) {
    return undefined;
  }
});

export function searchProducts(params: SearchParams<Product>): Promise<SearchResult<Product> | undefined> {
  return _searchProducts(params);
}
