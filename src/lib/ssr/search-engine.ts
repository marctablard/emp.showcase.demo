import type { SearchService } from '@/platform/services/search';
import BatteryIncludedSearchService from '@/platform/services/search/impl/BatteryIncludedSearchService';
import ssr from '@/platform/ssr';

export type SearchEngineType = 'batteryincluded' | 'emporix';

/**
 * Returns the active search engine type by inspecting the currently bound SearchService.
 * This is server-only and should not be used in client components.
 */
export function getActiveSearchEngine(): SearchEngineType {
  const searchService = ssr.get<SearchService>('SearchService');
  return searchService instanceof BatteryIncludedSearchService ? 'batteryincluded' : 'emporix';
}
