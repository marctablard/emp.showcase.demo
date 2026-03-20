import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { ContentSitesService } from '@/platform/services/contentsites/ContentSitesService';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const contentSitesService = server.get<ContentSitesService>('ContentSitesService');
    const contentSite = await contentSitesService.getContentSite(id);

    if (!contentSite) {
      return NextResponse.json({ error: 'Content site not found' }, { status: 404 });
    }

    return NextResponse.json(contentSite);
  } catch (error) {
    console.error('Error fetching content site:', error);
    return NextResponse.json({ error: 'Failed to fetch content site' }, { status: 500 });
  }
}
