import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * Request a password reset for a customer's email address
 * POST /api/password-reset
 */
export async function POST(request: NextRequest) {
  let email: string | undefined;

  try {
    // Parse the request body
    const body = await request.json();
    email = body.email;

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
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/password-reset',
        method: 'POST',
        email,
      },
      'Error requesting password reset',
    );

    return NextResponse.json(
      { error: 'Failed to request password reset', details: (error as Error).message },
      { status: 500 },
    );
  }
}
