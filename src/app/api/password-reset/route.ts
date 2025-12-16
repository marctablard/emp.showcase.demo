import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { CustomerService } from '@/platform/services/customer/CustomerService';

/**
 * Request a password reset for a customer's email address
 * POST /api/password-reset
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get the customer service
    const customerService = server.get<CustomerService>('CustomerService');

    // Request password reset
    await customerService.passwordReset(email);

    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error requesting password reset:', error);

    return NextResponse.json(
      { error: 'Failed to request password reset', details: (error as Error).message },
      { status: 500 },
    );
  }
}
