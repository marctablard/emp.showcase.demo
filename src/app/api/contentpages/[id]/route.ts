import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { ContentPagesService } from '@/platform/services/contentpages/ContentPagesService';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const contentPagesService = server.get<ContentPagesService>('ContentPagesService');
    const contentPage = await contentPagesService.getContentPage(id);

    if (!contentPage) {
      return NextResponse.json({ error: 'Content page not found' }, { status: 404 });
    }

    return NextResponse.json(contentPage);
  } catch (error) {
    console.error('Error fetching content page:', error);
    return NextResponse.json({ error: 'Failed to fetch content page' }, { status: 500 });
  }
}
