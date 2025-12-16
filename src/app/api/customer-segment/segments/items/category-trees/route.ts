import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { CustomerSegmentService } from '@/platform/services/customer-segment/CustomerSegmentService';
import { CustomerSegmentQueryOptions } from '@/platform/services/model/customer-segment';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const options: CustomerSegmentQueryOptions = {
      legalEntityId: searchParams.get('legalEntityId') || undefined,
      siteCode: searchParams.get('siteCode') || undefined,
    };

    const customerSegmentService = server.get<CustomerSegmentService>('CustomerSegmentService');
    const categoryTrees = await customerSegmentService.getCategoryTrees(options);

    return NextResponse.json(categoryTrees);
  } catch (error) {
    console.error('Error fetching customer segment category trees:', error);
    return NextResponse.json({ error: 'Failed to fetch customer segment category trees' }, { status: 500 });
  }
}
