import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { SearchService } from '@/platform/services/search/SearchService';

/**
 * API endpoint to get product suggestions based on a search query
 * GET /api/search/suggestions?query=term&locale=en
 */
export async function GET(request: NextRequest) {
  try {
    const searchService = server.get<SearchService>('SearchService');

    const url = new URL(request.url);

    // Extract query and locale parameters
    const query = url.searchParams.get('query');
    const locale = url.searchParams.get('locale') || undefined;

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const suggestions = await searchService.getSuggestions(query, locale);

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
