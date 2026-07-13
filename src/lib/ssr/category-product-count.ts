import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import type { CategoryService } from '@/platform/services/category/CategoryService';
import ssr from '@/platform/ssr';

/**
 * TTL for cached per-category product counts. One hour keeps the UI fresh after catalog
 * changes while still absorbing the vast majority of fan-out traffic from tree/carousel
 * rendering. Counts are a best-effort display value; eventual consistency is acceptable.
 */
const CATEGORY_PRODUCT_COUNT_REVALIDATE_SECONDS = 3600;

function categoryProductCountCacheTags(siteCode: string): string[] {
  return [`navigation-category-trees:${siteCode}:0`, `category-product-count:${siteCode}`];
}

async function loadProductCountForCategory(categoryId: string): Promise<number> {
  const categoryService = ssr.get<CategoryService>('CategoryService');
  return categoryService.getProductCountForCategory(categoryId, {
    withSubcategories: true,
    hideUnpublishedProducts: true,
  });
}

/**
 * Request-scoped dedupe (`cache`) + cross-request durable cache (`unstable_cache`) for the
 * per-category product count endpoint. Tagged with `navigation-category-trees:<site>:0` so any
 * tree invalidation implicitly refreshes counts, plus a dedicated `category-product-count:<site>`
 * tag for targeted invalidation.
 */
export const getCachedCategoryProductCount = cache(async (siteCode: string, categoryId: string): Promise<number> => {
  const trimmedId = categoryId?.trim();
  if (!trimmedId) {
    return 0;
  }
  return unstable_cache(
    async () => loadProductCountForCategory(trimmedId),
    ['category-product-count', siteCode, trimmedId],
    {
      revalidate: CATEGORY_PRODUCT_COUNT_REVALIDATE_SECONDS,
      tags: categoryProductCountCacheTags(siteCode),
    },
  )();
});
