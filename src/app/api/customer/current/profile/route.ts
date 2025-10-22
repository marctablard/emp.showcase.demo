import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { CustomerService, CustomerUpdateDto } from '@/platform/services/customer/CustomerService';

/**
 * PATCH /api/customer/current/profile
 * Update the current customer's profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const customerService = server.get<CustomerService>('CustomerService');

    // Get the current customer to check if logged in
    const currentCustomer = await customerService.getCustomer();

    if (!currentCustomer) {
      // Return 401 if no customer is logged in
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse the request body with the profile update data
    const profileData: CustomerUpdateDto = await request.json();

    // Update the customer profile
    const updatedCustomer = await customerService.updateCustomerProfile(profileData);

    // Return the updated customer data
    return NextResponse.json(updatedCustomer);
  } catch (error) {
    console.error('Error updating customer profile:', error);

    // Check if error is due to validation
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = errorMessage.includes('validation') ? 400 : 500;

    return NextResponse.json({ error: `Failed to update customer profile: ${errorMessage}` }, { status: statusCode });
  }
}
