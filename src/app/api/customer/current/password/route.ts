import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CustomerService, PasswordChangeDto } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * POST /api/customer/current/password
 * Change the password of the current customer
 */
export async function POST(request: NextRequest) {
  try {
    const customerService = server.get<CustomerService>('CustomerService');

    const currentCustomer = await customerService.getCustomer();

    if (!currentCustomer) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const passwordData: PasswordChangeDto = await request.json();

    if (!passwordData.currentPassword) {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
    }

    if (!passwordData.newPassword) {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 });
    }

    await customerService.changePassword(passwordData);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = errorMessage.includes('Unauthorized') ? 401 : errorMessage.includes('Bad Request') ? 400 : 500;

    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/customer/current/password',
        method: 'POST',
        statusCode,
      },
      'Error changing customer password',
    );

    return NextResponse.json({ error: `Failed to change password: ${errorMessage}` }, { status: statusCode });
  }
}
