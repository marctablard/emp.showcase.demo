import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { CustomerService } from '@/platform/services/customer/CustomerService';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: customerId } = await params;

    const customerService = server.get<CustomerService>('CustomerService');
    const addresses = await customerService.getAddresses(customerId === 'current' ? undefined : customerId);

    return NextResponse.json(addresses);
  } catch (error) {
    console.error('Error fetching customer addresses:', error);
    return NextResponse.json({ error: 'Failed to fetch customer addresses' }, { status: 500 });
  }
}

/**
 * POST handler for creating a new address
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: customerId } = await params;

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
    console.error('Error creating customer address:', error);
    return NextResponse.json({ error: 'Failed to create customer address' }, { status: 500 });
  }
}
