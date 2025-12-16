import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { SearchService } from '@/platform/services/search';

/**
 * API endpoint to search for products
 * GET /api/search?query=term&page=0&size=20&sort=name:asc
 */
export async function GET(request: NextRequest) {
  try {
    const searchService = server.get<SearchService>('SearchService');
    const url = new URL(request.url);

    // Extract search parameters from the URL
    const query = url.searchParams.get('query') || undefined;
    const page = url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!) : 0;
    const size = url.searchParams.get('size') ? parseInt(url.searchParams.get('size')!) : 20;
    const sort = url.searchParams.get('sort') || undefined;

    // Extract filters if present (format: filters[key]=value or filters[key][]=value1&filters[key][]=value2)
    const filters: Record<string, string | string[]> = {};
    for (const [key, value] of url.searchParams.entries()) {
      if (key.startsWith('filters[') && key.endsWith(']')) {
        const filterKey = key.slice(8, -1);
        if (key.endsWith('[]')) {
          const actualKey = filterKey.slice(0, -2);
          if (!filters[actualKey]) {
            filters[actualKey] = [];
          }
          if (Array.isArray(filters[actualKey])) {
            (filters[actualKey] as string[]).push(value);
          }
        } else {
          filters[filterKey] = value;
        }
      }
    }

    // Perform the search
    const searchResults = await searchService.searchProducts({
      query,
      page,
      size,
      sort,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    });

    return NextResponse.json(searchResults);
  } catch (error) {
    console.error('Error searching products:', error);
    return NextResponse.json({ error: 'Failed to search products' }, { status: 500 });
  }
}
