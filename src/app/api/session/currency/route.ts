import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { CURRENCY_COOKIE_NAME } from '@/lib/common/cookie-names';
import server from '@/platform/server';
import type { CartService } from '@/platform/services/cart';
import {
  CART_CURRENCY_UPDATE_ERROR_CODE,
  type CartCurrencyUpdateErrorCode,
  isCartCurrencyUpdateError,
} from '@/platform/services/cart/errors';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session/SessionService';

const RECOVERABLE_CART_ERROR_CODES = new Set<CartCurrencyUpdateErrorCode>([
  CART_CURRENCY_UPDATE_ERROR_CODE.CART_NOT_FOUND,
  CART_CURRENCY_UPDATE_ERROR_CODE.STALE_CART_ID,
]);

/**
 * PUT /api/session/currency
 * Update session currency
 */
export async function PUT(request: NextRequest) {
  try {
    const cartService = server.get<CartService>('CartService');
    const sessionService = server.get<SessionService>('SessionService');
    const logger = server.get<LoggerService>('LoggerService');
    const session = await sessionService.getCurrent();
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    const data = await request.json();
    const currency = typeof data?.currency === 'string' ? data.currency.trim() : '';

    if (!currency) {
      return NextResponse.json({ error: 'Currency is required' }, { status: 400 });
    }

    let updatedCart = await cartService.getCart();
    if (updatedCart && updatedCart.currency !== currency) {
      const cartId = updatedCart.id;
      const cartSite = updatedCart.site;
      try {
        await cartService.updateCurrency(cartId, currency);
        updatedCart = (await cartService.getCartById(cartId)) ?? (await cartService.getCart());
      } catch (cartError) {
        if (isCartCurrencyUpdateError(cartError)) {
          if (RECOVERABLE_CART_ERROR_CODES.has(cartError.code)) {
            logger.warn(
              { code: cartError.code, cartId, currency, cartSite },
              'Cart currency update skipped — updating session only',
            );
            updatedCart = null;
          } else {
            logger.error(
              { code: cartError.code, cartId, currency, cartSite },
              'Cart currency update failed — non-recoverable error',
            );
            return NextResponse.json({ error: 'Cart currency update failed', code: cartError.code }, { status: 409 });
          }
        } else {
          throw cartError;
        }
      }
    }

    const finalCurrency = updatedCart?.currency || currency;
    await sessionService.setCurrency(finalCurrency);

    const response = NextResponse.json({ success: true, currency: finalCurrency, cart: updatedCart ?? null });
    // Persist the shopper's currency choice in a parallel cookie so
    // `EmporixTokenManagerServer.resolveSessionParams` can seed the next
    // anonymous session context after logout / token expiry with the same
    // preference (symmetric with NEXT_PUBLIC_SITE_COOKIE).
    response.cookies.set({
      name: CURRENCY_COOKIE_NAME,
      value: finalCurrency,
      maxAge: 365 * 24 * 60 * 60,
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
    });
    return response;
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/session/currency',
        method: 'PUT',
      },
      'Error updating session currency',
    );
    return NextResponse.json({ error: 'Failed to update session currency' }, { status: 500 });
  }
}
