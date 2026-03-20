import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { ContentPagesService } from '@/platform/services/contentpages/ContentPagesService';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const name = searchParams.get('name') || undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined;
    const size = searchParams.get('size') ? parseInt(searchParams.get('size')!, 10) : undefined;

    const contentPagesService = server.get<ContentPagesService>('ContentPagesService');

    const result = await contentPagesService.getContentPages({
      ...(name && { name }),
      ...(page !== undefined && { page }),
      ...(size !== undefined && { size }),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching content pages:', error);
    return NextResponse.json({ error: 'Failed to fetch content pages' }, { status: 500 });
  }
}
