import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CustomerSegmentService } from '@/platform/services/customer-segment/CustomerSegmentService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CustomerSegmentQueryOptions } from '@/platform/services/model/customer-segment';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const options: CustomerSegmentQueryOptions = {
      q: searchParams.get('q') || undefined,
      pageSize: parseInt(searchParams.get('pageSize') || '', 10) || undefined,
      pageNumber: parseInt(searchParams.get('pageNumber') || '', 10) || undefined,
      sort: searchParams.get('sort') || undefined,
      fields: searchParams.get('fields') || undefined,
    };

    const customerSegmentService = server.get<CustomerSegmentService>('CustomerSegmentService');
    const items = await customerSegmentService.getSegmentItems(options);

    return NextResponse.json(items);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/customer-segment/segments/items',
        method: 'GET',
      },
      'Error fetching customer segment items',
    );
    return NextResponse.json({ error: 'Failed to fetch customer segment items' }, { status: 500 });
  }
}
