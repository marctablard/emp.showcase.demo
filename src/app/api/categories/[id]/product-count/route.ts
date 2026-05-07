import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CategoryService } from '@/platform/services/category/CategoryService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * Public, idempotent read — same value for all shoppers on the same site. The upstream call is
 * already deduped per-request via the SSR helper and cached by `unstable_cache`; here we add a
 * short CDN cache to absorb client-side fan-out from the PLP tree / carousel.
 */
const PUBLIC_CACHE_CONTROL = 'public, s-maxage=600, stale-while-revalidate=60';

export interface CategoryProductCountResponse {
  categoryId: string;
  count: number;
}

/**
 * GET /api/categories/{id}/product-count
 *
 * Returns the total number of products assigned to the given category (including subcategories).
 * Failures in the upstream Emporix call surface as a 500 with an error payload; the response
 * body otherwise always contains a non-negative `count`.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<CategoryProductCountResponse | { error: string }>> {
  const { id } = await params;
  const categoryId = id?.trim();

  if (!categoryId) {
    return NextResponse.json({ error: 'Missing category id' }, { status: 400 });
  }

  try {
    const categoryService = server.get<CategoryService>('CategoryService');
    const count = await categoryService.getProductCountForCategory(categoryId, {
      withSubcategories: true,
      hideUnpublishedProducts: true,
    });

    return NextResponse.json({ categoryId, count }, { headers: { 'Cache-Control': PUBLIC_CACHE_CONTROL } });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/categories/${categoryId}/product-count`,
        method: 'GET',
        categoryId,
      },
      'Error fetching category product count',
    );
    return NextResponse.json({ error: 'Failed to fetch category product count' }, { status: 500 });
  }
}
