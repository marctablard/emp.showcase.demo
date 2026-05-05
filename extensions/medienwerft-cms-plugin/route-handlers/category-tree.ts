import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CMSCategoryService } from '../services/CMSCategoryService';

/**
 * GET handler for the category tree the CMS editor consumes.
 *
 * Designed to be re-exported from `app/api/categories/tree/route.ts`
 * as a one-liner:
 *
 * ```ts
 * export { categoryTreeGET as GET } from '@extensions/medienwerft-cms-plugin/route-handlers';
 * ```
 *
 * Two modes:
 * - `GET /api/categories/tree?site=<code>` — returns `Category[]`, the trees
 *   rooted at each catalog published to the site. Preferred entry point for
 *   editor code that does not already know a specific root id.
 * - `GET /api/categories/tree?categoryId=<id>` — returns the single `Category`
 *   tree rooted at the given id.
 *
 * Both modes accept `showUnpublished=true` to include unpublished categories.
 *
 * The handler depends on the extension's own `CMSCategoryService` and the
 * platform's `LoggerService` DI bindings.
 */
export async function categoryTreeGET(request: NextRequest): Promise<NextResponse> {
  try {
    const cmsCategoryService = server.get<CMSCategoryService>('CMSCategoryService');

    const url = new URL(request.url);
    const site = url.searchParams.get('site');
    const categoryId = url.searchParams.get('categoryId');
    const showUnpublished = url.searchParams.get('showUnpublished') === 'true';

    if (site) {
      const trees = await cmsCategoryService.getCategoryTreesForSite(site, showUnpublished);
      return NextResponse.json(trees);
    }

    if (!categoryId) {
      return NextResponse.json({ error: "Either 'site' or 'categoryId' query param is required" }, { status: 400 });
    }

    const categoryTree = await cmsCategoryService.getCategoryTree(categoryId, showUnpublished);

    if (!categoryTree) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(categoryTree);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/categories/tree',
        method: 'GET',
      },
      'Error fetching category tree',
    );
    return NextResponse.json({ error: 'Failed to fetch category tree' }, { status: 500 });
  }
}
