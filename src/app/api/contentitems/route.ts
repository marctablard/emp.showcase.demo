import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { ContentItemsService } from '@/platform/services/contentitems/ContentItemsService';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const siteId = searchParams.get('siteId') || undefined;
    const pageId = searchParams.get('pageId') || undefined;
    const productId = searchParams.get('productId') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined;
    const size = searchParams.get('size') ? parseInt(searchParams.get('size')!, 10) : undefined;
    const sort = searchParams.get('sort') || undefined;

    const contentItemsService = server.get<ContentItemsService>('ContentItemsService');

    const result = await contentItemsService.getContentItems({
      ...(siteId && { siteId }),
      ...(pageId && { pageId }),
      ...(productId && { productId }),
      ...(categoryId && { categoryId }),
      ...(page !== undefined && { page }),
      ...(size !== undefined && { size }),
      ...(sort && { sort }),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching content items:', error);
    return NextResponse.json({ error: 'Failed to fetch content items' }, { status: 500 });
  }
}
