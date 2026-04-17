import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * PUT handler for updating an existing address
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; addressId: string }> }) {
  const { id: customerId, addressId } = await params;

  try {
    // Only the current user can update addresses
    if (customerId !== 'current') {
      return NextResponse.json({ error: 'You can only update addresses for the current customer' }, { status: 403 });
    }

    const data = await request.json();

    // Get the CustomerService
    const customerService = server.get<CustomerService>('CustomerService');

    // Update address using the CustomerService
    // This handles the mapping internally
    await customerService.updateAddress(addressId, data);

    // Get the updated address list
    const addresses = await customerService.getAddresses(undefined);
    const updatedAddress = addresses.find((addr) => (addr as any).id === addressId || (addr as any)._id === addressId);

    return NextResponse.json(updatedAddress);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/customer/${customerId}/addresses/${addressId}`,
        method: 'PUT',
        customerId,
        addressId,
      },
      'Error updating customer address',
    );
    return NextResponse.json({ error: 'Failed to update customer address' }, { status: 500 });
  }
}

/**
 * DELETE handler for removing an address
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; addressId: string }> }) {
  const { id: customerId, addressId } = await params;

  try {
    // Only the current user can delete addresses
    if (customerId !== 'current') {
      return NextResponse.json({ error: 'You can only delete addresses for the current customer' }, { status: 403 });
    }

    // Get the CustomerService
    const customerService = server.get<CustomerService>('CustomerService');

    // Delete address using the CustomerService
    await customerService.deleteAddress(addressId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/customer/${customerId}/addresses/${addressId}`,
        method: 'DELETE',
        customerId,
        addressId,
      },
      'Error deleting customer address',
    );
    return NextResponse.json({ error: 'Failed to delete customer address' }, { status: 500 });
  }
}
