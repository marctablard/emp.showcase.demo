import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CategoryService } from '@/platform/services/category/CategoryService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * API endpoint to get a category tree
 * GET /api/categories/tree?categoryId=root&showUnpublished=false
 */
export async function GET(request: NextRequest) {
  try {
    const categoryService = server.get<CategoryService>('CategoryService');

    const url = new URL(request.url);
    const categoryId = url.searchParams.get('categoryId') || 'root';
    const showUnpublished = url.searchParams.get('showUnpublished') === 'true';

    const categoryTree = await categoryService.getCategoryTree(categoryId, showUnpublished);

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
