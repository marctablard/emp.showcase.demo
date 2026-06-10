import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { getSessionForSite } from '@/lib/ssr/session';
import type { CategoryService } from '@/platform/services/category/CategoryService';
import type { Category } from '@/platform/services/model/category';
import type { SearchService } from '@/platform/services/search';
import type { BatteryIncludedCategoryTreeService } from '@/platform/services/search/BatteryIncludedCategoryTreeService';
import BatteryIncludedSearchService from '@/platform/services/search/impl/BatteryIncludedSearchService';
import type { NavigationCategoryTreeRequestContext } from '@/platform/services/search/impl/batteryincluded-category-tree';
import ssr from '@/platform/ssr';

async function loadNavigationCategoryTrees(siteCode: string, showUnpublished: boolean): Promise<Category[]> {
  const categoryService = ssr.get<CategoryService>('CategoryService');
  return categoryService.getNavigationCategoryTrees(siteCode, showUnpublished);
}

async function loadBatteryIncludedNavigationCategoryTrees(
  context: NavigationCategoryTreeRequestContext,
): Promise<Category[] | null> {
  const treeService = ssr.get<BatteryIncludedCategoryTreeService>('BatteryIncludedCategoryTreeService');
  const snapshot = await treeService.getSnapshot(context);
  return snapshot?.roots ?? null;
}

function navigationTreesCacheTags(siteCode: string, showUnpublished: boolean): string[] {
  const pub = showUnpublished ? '1' : '0';
  return [`navigation-category-trees:${siteCode}:${pub}`];
}

/**
 * Dedupes parallel callers in one React request (`cache`) and reuses Emporix-backed work
 * across navigations for the same site (`unstable_cache`). `revalidate: false` keeps trees
 * until redeploy or `revalidateTag('navigation-category-trees:${site}:…')`; site changes use
 * a different cache key.
 */
export const getCachedNavigationCategoryTrees = cache(
  async (siteCode: string, locale: string, showUnpublished?: boolean): Promise<Category[]> => {
    const pub = showUnpublished === true;
    const searchService = ssr.get<SearchService>('SearchService');
    if (searchService instanceof BatteryIncludedSearchService) {
      const session = await getSessionForSite(siteCode);
      const roots = await loadBatteryIncludedNavigationCategoryTrees({
        siteCode,
        locale,
        country: session?.country,
        showUnpublished: pub,
      });
      if (roots) {
        return roots;
      }
    }

    return unstable_cache(
      async () => loadNavigationCategoryTrees(siteCode, pub),
      ['navigation-category-trees', siteCode, pub ? '1' : '0'],
      { revalidate: false, tags: navigationTreesCacheTags(siteCode, pub) },
    )();
  },
);
