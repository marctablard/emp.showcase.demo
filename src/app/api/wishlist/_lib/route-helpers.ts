import { NextResponse } from 'next/server';
import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session';

/** Returns a 401 NextResponse if the current session is anonymous / missing, else null. */
export async function requireAuthenticatedCustomer(): Promise<NextResponse | null> {
  const sessionService = server.get<SessionService>('SessionService');
  const session = await sessionService.getCurrent();
  if (!session || !isAuthenticatedSessionCustomerId(session.customerId)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  return null;
}

/**
 * Detects "wishlist (item) not found" errors thrown by the service layer so routes can map
 * them to 404. The thrown messages are the contract between service and routes — keep them
 * in sync if you rename either side.
 */
export function isWishlistNotFoundError(error: unknown): error is Error {
  return error instanceof Error && /^Wishlist (item )?not found$/.test(error.message);
}

interface LogContext {
  path: string;
  method: string;
  productId?: string;
}

/** Standard logger output for a wishlist route failure. */
export function logRouteError(error: unknown, ctx: LogContext, message: string): void {
  const logger = server.get<LoggerService>('LoggerService');
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...ctx,
    },
    message,
  );
}
