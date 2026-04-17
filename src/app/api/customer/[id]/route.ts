import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: customerId } = await params;

  try {
    const customerService = server.get<CustomerService>('CustomerService');
    const customer = await customerService.getCustomer(customerId === 'current' ? undefined : customerId);

    if (!customer) {
      // Return 204 No Content if no customer is found
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json(customer);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/customer/${customerId}`,
        method: 'GET',
        customerId,
      },
      'Error fetching customer',
    );
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 });
  }
}
