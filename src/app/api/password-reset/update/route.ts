import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * Update password using a password reset token
 * POST /api/password-reset/update
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const { token, password } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Get the customer service
    const customerService = server.get<CustomerService>('CustomerService');

    // Update password with token
    await customerService.passwordResetUpdate(token, password);

    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/password-reset/update',
        method: 'POST',
      },
      'Error updating password',
    );

    return NextResponse.json(
      { error: 'Failed to update password', details: (error as Error).message },
      { status: 500 },
    );
  }
}
