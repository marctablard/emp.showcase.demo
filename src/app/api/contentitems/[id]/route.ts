import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { ContentItemsService } from '@/platform/services/contentitems/ContentItemsService';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const contentItemsService = server.get<ContentItemsService>('ContentItemsService');
    const contentItem = await contentItemsService.getContentItem(id);

    if (!contentItem) {
      return NextResponse.json({ error: 'Content item not found' }, { status: 404 });
    }

    return NextResponse.json(contentItem);
  } catch (error) {
    console.error('Error fetching content item:', error);
    return NextResponse.json({ error: 'Failed to fetch content item' }, { status: 500 });
  }
}
