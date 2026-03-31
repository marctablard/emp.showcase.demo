import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import type { CategoryService } from '@/platform/services/category/CategoryService';
import type { Category } from '@/platform/services/model/category';
import ssr from '@/platform/ssr';

async function loadNavigationCategoryTrees(siteCode: string, showUnpublished: boolean): Promise<Category[]> {
  const categoryService = ssr.get<CategoryService>('CategoryService');
  return categoryService.getNavigationCategoryTrees(siteCode, showUnpublished);
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
  async (siteCode: string, showUnpublished?: boolean): Promise<Category[]> => {
    const pub = showUnpublished === true;
    return unstable_cache(
      async () => loadNavigationCategoryTrees(siteCode, pub),
      ['navigation-category-trees', siteCode, pub ? '1' : '0'],
      { revalidate: false, tags: navigationTreesCacheTags(siteCode, pub) },
    )();
  },
);
