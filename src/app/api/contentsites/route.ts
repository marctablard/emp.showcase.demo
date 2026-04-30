import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { ContentSitesService } from '@/platform/services/contentsites/ContentSitesService';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const name = searchParams.get('name') || undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined;
    const size = searchParams.get('size') ? parseInt(searchParams.get('size')!, 10) : undefined;

    const contentSitesService = server.get<ContentSitesService>('ContentSitesService');

    const result = await contentSitesService.getContentSites({
      ...(name && { name }),
      ...(page !== undefined && { page }),
      ...(size !== undefined && { size }),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching content sites:', error);
    return NextResponse.json({ error: 'Failed to fetch content sites' }, { status: 500 });
  }
}
