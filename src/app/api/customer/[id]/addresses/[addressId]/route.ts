import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { CustomerService } from '@/platform/services/customer/CustomerService';

/**
 * PUT handler for updating an existing address
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; addressId: string }> }) {
  try {
    const { id: customerId, addressId } = await params;

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
    console.error('Error updating customer address:', error);
    return NextResponse.json({ error: 'Failed to update customer address' }, { status: 500 });
  }
}

/**
 * DELETE handler for removing an address
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; addressId: string }> }) {
  try {
    const { id: customerId, addressId } = await params;

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
    console.error('Error deleting customer address:', error);
    return NextResponse.json({ error: 'Failed to delete customer address' }, { status: 500 });
  }
}
