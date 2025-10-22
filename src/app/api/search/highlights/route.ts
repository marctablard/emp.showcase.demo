import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { SearchService } from '@/platform/services/search/SearchService';

/**
 * API endpoint to get highlighted products
 * GET /api/search/highlights
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
  try {
    const searchService = server.get<SearchService>('SearchService');

    const highlights = await searchService.getHighlights();

    return NextResponse.json({ products: highlights });
  } catch (error) {
    console.error('Error fetching highlighted products:', error);
    return NextResponse.json({ error: 'Failed to fetch highlighted products' }, { status: 500 });
  }
}
