import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { SearchService } from '@/platform/services/search/SearchService';

/**
 * API endpoint to get product suggestions based on a search query
 * GET /api/search/suggestions?query=term&locale=en&site=main
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query');
  const locale = url.searchParams.get('locale') || undefined;
  const site = url.searchParams.get('site') || undefined;

  try {
    const searchService = server.get<SearchService>('SearchService');

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const suggestions = await searchService.getSuggestions({ query, locale, site });

    return NextResponse.json(suggestions);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/search/suggestions',
        method: 'GET',
        query,
        locale,
        site,
      },
      'Error fetching suggestions',
    );
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
