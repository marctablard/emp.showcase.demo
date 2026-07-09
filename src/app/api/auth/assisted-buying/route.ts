import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { parseAssistedBuyingTokenParams } from '@/lib/common/assisted-buying';
import { completeAssistedBuyingSignIn } from '@/lib/server/complete-assisted-buying-sign-in';
import server from '@/platform/server';
import type { AuthService } from '@/platform/services/auth/AuthService';
import type { CustomerNamingService } from '@/platform/services/customer/CustomerNamingService';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { AssistedBuyingTokens } from '@/platform/services/model/auth/auth';

type AssistedBuyingRequestBody = {
  accessToken?: string;
  expiresIn?: number;
  saasToken?: string;
};

/**
 * POST /api/auth/assisted-buying
 * Stores assisted buying tokens and prepares the Emporix customer session.
 */
export async function POST(request: NextRequest) {
  const logger = server.get<LoggerService>('LoggerService');

  let body: AssistedBuyingRequestBody;
  try {
    body = (await request.json()) as AssistedBuyingRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const searchParams = new URLSearchParams();
  if (typeof body.accessToken === 'string') {
    searchParams.set('customerToken', body.accessToken);
  }
  if (body.expiresIn !== undefined) {
    searchParams.set('customerTokenExpiresIn', String(body.expiresIn));
  }
  if (typeof body.saasToken === 'string') {
    searchParams.set('saasToken', body.saasToken);
  }

  const tokens: AssistedBuyingTokens | null = parseAssistedBuyingTokenParams(searchParams);
  if (!tokens) {
    return NextResponse.json({ error: 'accessToken, expiresIn, and saasToken are required' }, { status: 400 });
  }

  try {
    const authService = server.get<AuthService>('AuthService');
    await authService.loginWithAssistedBuying(tokens);

    const customerService = server.get<CustomerService>('CustomerService');
    const customer = await customerService.getCustomer();
    if (!customer?.email) {
      return NextResponse.json({ error: 'Failed to resolve assisted buying customer' }, { status: 401 });
    }

    const customerNamingService = server.get<CustomerNamingService>('CustomerNamingService');
    const signInResult = await completeAssistedBuyingSignIn();

    if (!signInResult.success) {
      return NextResponse.json(
        { error: signInResult.error || 'Failed to complete assisted buying sign-in' },
        { status: 401 },
      );
    }

    return NextResponse.json({
      email: customer.email,
      name: customerNamingService.getFullName(customer),
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/auth/assisted-buying',
        method: 'POST',
      },
      'Assisted buying login error',
    );

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Assisted buying login failed' },
      { status: 401 },
    );
  }
}
