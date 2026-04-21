import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { mapCartGetError } from '@/lib/common/cart-api-error-mapping';
import server from '@/platform/server';
import type { CartService } from '@/platform/services/cart';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Cart } from '@/platform/services/model/cart';
import type { SessionService } from '@/platform/services/session';

/**
 * GET /api/cart
 *
 * Fetches the current cart. **Never creates a cart on GET** — callers must POST /api/cart
 * explicitly when they want a fresh cart. Legacy `?create=true` is ignored and logged as deprecated.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const legacyCreate = searchParams.get('create') === 'true';

    const cartService = server.get<CartService>('CartService');
    const sessionService = server.get<SessionService>('SessionService');
    const logger = server.get<LoggerService>('LoggerService');
    const session = await sessionService.getCurrent();
    if (!session) {
      return new Response(null, {
        status: 204,
      });
    }
    const sessionSiteHeader = { 'x-session-site-code': session.siteCode ?? '' };

    if (legacyCreate) {
      logger.warn(
        { path: '/api/cart', method: 'GET' },
        'Deprecated: GET /api/cart?create=true — use explicit POST /api/cart instead; ignoring create flag',
      );
    }

    const cart: Cart | null = await cartService.getCart();

    if (cart === null) {
      return new Response(null, { status: 204, headers: sessionSiteHeader });
    }
    return NextResponse.json(cart, { headers: sessionSiteHeader });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const mappedError = mapCartGetError(error);
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/cart',
        method: 'GET',
        ...mappedError.logContext,
      },
      'Error handling cart request',
    );
    return NextResponse.json(mappedError.response, { status: mappedError.status });
  }
}

/**
 * POST /api/carts
 * Create a new cart
 */
export async function POST(request: NextRequest) {
  try {
    const cartService = server.get<CartService>('CartService');
    const sessionService = server.get<SessionService>('SessionService');
    const session = await sessionService.getCurrent();
    if (!session) {
      return NextResponse.json({ error: 'Failed to get session context' }, { status: 500 });
    }
    // Get request body
    const body = await request.json();
    const currency = body.currency || session.currency;
    const siteCode = body.siteCode || session.siteCode;

    // Create a new cart
    const cartId = await cartService.createCart(currency, siteCode);
    const cart = await cartService.getCartById(cartId);

    return NextResponse.json(cart);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/cart',
        method: 'POST',
      },
      'Error creating cart',
    );
    return NextResponse.json({ error: 'Failed to create cart' }, { status: 500 });
  }
}
