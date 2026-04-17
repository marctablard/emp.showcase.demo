import { cache } from 'react';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SearchParams, SearchResult } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import type { SearchService } from '@/platform/services/search';
import ssr from '@/platform/ssr';

const getSearchService = () => ssr.get<SearchService>('SearchService');
const getLogger = () => ssr.get<LoggerService>('LoggerService');

const _searchProducts = cache(async (params: SearchParams<Product>): Promise<SearchResult<Product> | undefined> => {
  try {
    const searchResult = await getSearchService().searchProducts(params);
    return searchResult || null;
  } catch (error) {
    getLogger().error({ error: error instanceof Error ? error.message : String(error) }, 'SSR searchProducts failed');
    return undefined;
  }
});

export function searchProducts(params: SearchParams<Product>): Promise<SearchResult<Product> | undefined> {
  return _searchProducts(params);
}
