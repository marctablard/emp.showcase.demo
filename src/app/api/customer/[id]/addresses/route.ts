import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: customerId } = await params;

  try {
    const customerService = server.get<CustomerService>('CustomerService');
    const addresses = await customerService.getAddresses(customerId === 'current' ? undefined : customerId);

    return NextResponse.json(addresses);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/customer/${customerId}/addresses`,
        method: 'GET',
        customerId,
      },
      'Error fetching customer addresses',
    );
    return NextResponse.json({ error: 'Failed to fetch customer addresses' }, { status: 500 });
  }
}

/**
 * POST handler for creating a new address
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: customerId } = await params;

  try {
    // Only the current user can add addresses
    if (customerId !== 'current') {
      return NextResponse.json({ error: 'You can only add addresses for the current customer' }, { status: 403 });
    }

    const data = await request.json();
    // Get the current customer ID from the CustomerService
    const customerService = server.get<CustomerService>('CustomerService');

    // Create address using the CustomerService
    // This handles the mapping internally
    const result = await customerService.createAddress(data);

    // Get the updated address list to find our new address
    const addresses = await customerService.getAddresses(undefined);
    const newAddress = addresses.find((addr) => (addr as any).id === result.id || (addr as any)._id === result.id);

    return NextResponse.json(newAddress, { status: 201 });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/customer/${customerId}/addresses`,
        method: 'POST',
        customerId,
      },
      'Error creating customer address',
    );
    return NextResponse.json({ error: 'Failed to create customer address' }, { status: 500 });
  }
}
