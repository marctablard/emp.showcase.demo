import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { CustomerService } from '@/platform/services/customer/CustomerService';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: customerId } = await params;
    const customerService = server.get<CustomerService>('CustomerService');
    const customer = await customerService.getCustomer(customerId === 'current' ? undefined : customerId);

    if (!customer) {
      // Return 204 No Content if no customer is found
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 });
  }
}
