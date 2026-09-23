import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cartCouponCodesForCurrencyConflict } from '@/lib/common/applied-promo-display';
import { CURRENCY_COOKIE_NAME } from '@/lib/common/cookie-names';
import server from '@/platform/server';
import type { CartService } from '@/platform/services/cart';
import {
  CART_CURRENCY_UPDATE_ERROR_CODE,
  type CartCurrencyUpdateErrorCode,
  isCartCurrencyUpdateError,
} from '@/platform/services/cart/errors';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Cart } from '@/platform/services/model/cart/cart';
import type { SessionService } from '@/platform/services/session/SessionService';

const RECOVERABLE_CART_ERROR_CODES = new Set<CartCurrencyUpdateErrorCode>([
  CART_CURRENCY_UPDATE_ERROR_CODE.CART_NOT_FOUND,
  CART_CURRENCY_UPDATE_ERROR_CODE.STALE_CART_ID,
]);

type CartCurrencyReconcile = { cart: Cart | null; currencyBefore?: string } | { conflict: NextResponse };

type RepricedCart = { cart: Cart | null; currencyBeforeReprice?: string };

type ForbiddenCartRelease = { action: 'cleared' } | { action: 'rebound'; cartId: string } | { action: 'blocked' };

function cartCurrencyConflictResponse(code: CartCurrencyUpdateErrorCode, couponCodes: string[]): NextResponse {
  const includeCouponCodes =
    code === CART_CURRENCY_UPDATE_ERROR_CODE.COUPON_CURRENCY_CONFLICT && couponCodes.length > 0;
  return NextResponse.json(
    {
      error: 'Cart currency update failed',
      code,
      ...(includeCouponCodes ? { couponCodes } : {}),
    },
    { status: 409 },
  );
}

async function releaseForbiddenEmptyCart(
  cartService: CartService,
  sessionService: SessionService,
  logger: LoggerService,
  cartId: string,
  currency: string,
  cartSite: string,
  code: CartCurrencyUpdateErrorCode,
): Promise<ForbiddenCartRelease> {
  // Mapped carts turn an omitted items expansion into []. Ask the service, which reads the raw payload.
  const provenEmpty = await cartService.isProvenEmptyCart(cartId);
  if (!provenEmpty) {
    return { action: 'blocked' };
  }
  // getCurrent() also returns undefined when the read fails. That must not look like "no pointer".
  const current = await sessionService.getCurrentOrThrow();
  if (!current) {
    logger.warn(
      { code, cartId, currency, cartSite },
      'Empty cart currency update forbidden — session is absent, leaving the cart pointer',
    );
    return { action: 'blocked' };
  }
  const boundCartId = current.cartId;
  if (boundCartId === undefined || boundCartId === cartId) {
    await sessionService.clearCart();
    logger.warn(
      { code, cartId, currency, cartSite },
      'Empty cart currency update forbidden — cleared cart and updating session only',
    );
    return { action: 'cleared' };
  }
  logger.warn(
    { code, cartId, currency, cartSite, sessionCartId: boundCartId },
    'Empty cart currency update forbidden — session cart pointer already moved',
  );
  return { action: 'rebound', cartId: boundCartId };
}

async function reconcileReboundCart(
  cartService: CartService,
  sessionService: SessionService,
  logger: LoggerService,
  reboundCartId: string,
  abandonedCartId: string,
  currency: string,
  couponCodes: string[],
): Promise<CartCurrencyReconcile> {
  const rebound = await cartService.getCartById(reboundCartId);
  if (!rebound || rebound.id === abandonedCartId) {
    return { conflict: cartCurrencyConflictResponse(CART_CURRENCY_UPDATE_ERROR_CODE.FORBIDDEN, couponCodes) };
  }
  if (rebound.currency === currency) {
    return { cart: rebound };
  }
  return reconcileCartCurrency(cartService, sessionService, logger, rebound, currency, false);
}

async function reconcileCartCurrency(
  cartService: CartService,
  sessionService: SessionService,
  logger: LoggerService,
  cart: Cart,
  currency: string,
  allowRebound = true,
): Promise<CartCurrencyReconcile> {
  const cartId = cart.id;
  const cartSite = cart.site;
  const couponCodes = cartCouponCodesForCurrencyConflict(cart.discounts);
  try {
    await cartService.updateCurrency(cartId, currency);
    return {
      cart: (await cartService.getCartById(cartId)) ?? (await cartService.getCart()),
      currencyBefore: cart.currency,
    };
  } catch (cartError) {
    if (!isCartCurrencyUpdateError(cartError)) {
      throw cartError;
    }
    if (RECOVERABLE_CART_ERROR_CODES.has(cartError.code)) {
      logger.warn(
        { code: cartError.code, cartId, currency, cartSite },
        'Cart currency update skipped — updating session only',
      );
      return { cart: null };
    }
    // An empty cart this session cannot reprice must not block the currency switch.
    // Re-read after the failure: the pre-update snapshot can miss a line added in parallel.
    if (cartError.code === CART_CURRENCY_UPDATE_ERROR_CODE.FORBIDDEN) {
      const release = await releaseForbiddenEmptyCart(
        cartService,
        sessionService,
        logger,
        cartId,
        currency,
        cartSite,
        cartError.code,
      );
      if (release.action === 'cleared') {
        return { cart: null };
      }
      if (release.action === 'rebound' && allowRebound) {
        return reconcileReboundCart(cartService, sessionService, logger, release.cartId, cartId, currency, couponCodes);
      }
    }
    logger.error(
      { code: cartError.code, cartId, currency, cartSite, couponCodes },
      'Cart currency update failed — non-recoverable error',
    );
    return { conflict: cartCurrencyConflictResponse(cartError.code, couponCodes) };
  }
}

function withCurrencyCookie(response: NextResponse, currency: string): NextResponse {
  // Persist the shopper's currency choice in a parallel cookie so
  // `EmporixTokenManagerServer.resolveSessionParams` can seed the next
  // anonymous session context after logout / token expiry with the same
  // preference (symmetric with NEXT_PUBLIC_SITE_COOKIE).
  response.cookies.set({
    name: CURRENCY_COOKIE_NAME,
    value: currency,
    maxAge: 365 * 24 * 60 * 60,
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  });
  return response;
}

function readRequestedCurrency(data: unknown): string {
  if (!data || typeof data !== 'object' || !('currency' in data)) {
    return '';
  }
  const currency = data.currency;
  return typeof currency === 'string' ? currency.trim() : '';
}

async function repriceCartToCurrency(
  cartService: CartService,
  sessionService: SessionService,
  logger: LoggerService,
  cart: Cart | null,
  currency: string,
): Promise<RepricedCart | { conflict: NextResponse }> {
  if (!cart || cart.currency === currency) {
    return { cart };
  }
  const reconciled = await reconcileCartCurrency(cartService, sessionService, logger, cart, currency);
  if ('conflict' in reconciled) {
    return reconciled;
  }
  return { cart: reconciled.cart, currencyBeforeReprice: reconciled.currencyBefore };
}

function cartCurrencyToRestore(cart: Cart | null, currencyBefore: string | undefined): string | undefined {
  if (!cart?.id || !currencyBefore || !cart.currency || cart.currency === currencyBefore) {
    return undefined;
  }
  return currencyBefore;
}

async function rollCartBackToCurrency(
  cartService: CartService,
  logger: LoggerService,
  cartId: string,
  restoreCurrency: string,
  failedCurrency: string,
): Promise<void> {
  try {
    await cartService.updateCurrency(cartId, restoreCurrency);
    logger.warn(
      { cartId, restoreCurrency, currency: failedCurrency },
      'Rolled cart currency back after session currency update failed',
    );
  } catch (rollbackError) {
    logger.error(
      {
        err: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        cartId,
        restoreCurrency,
        currency: failedCurrency,
      },
      'Failed to roll cart currency back after session currency update failed',
    );
  }
}

async function commitSessionCurrency(
  sessionService: SessionService,
  cartService: CartService,
  logger: LoggerService,
  finalCurrency: string,
  cart: Cart | null,
  currencyBeforeReprice: string | undefined,
): Promise<void> {
  try {
    await sessionService.setCurrency(finalCurrency);
  } catch (sessionError) {
    // Restore the cart currency from before this request's reprice, not the session currency.
    // Those can already differ when reconciliation starts.
    const restoreCurrency = cartCurrencyToRestore(cart, currencyBeforeReprice);
    if (restoreCurrency && cart?.id) {
      await rollCartBackToCurrency(cartService, logger, cart.id, restoreCurrency, finalCurrency);
    }
    throw sessionError;
  }
}

function logCurrencyUpdateFailure(error: unknown): void {
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
}

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

    const currency = readRequestedCurrency(await request.json());
    if (!currency) {
      return NextResponse.json({ error: 'Currency is required' }, { status: 400 });
    }

    const repriced = await repriceCartToCurrency(
      cartService,
      sessionService,
      logger,
      await cartService.getCart(),
      currency,
    );
    if ('conflict' in repriced) {
      return repriced.conflict;
    }

    const finalCurrency = repriced.cart?.currency || currency;
    await commitSessionCurrency(
      sessionService,
      cartService,
      logger,
      finalCurrency,
      repriced.cart,
      repriced.currencyBeforeReprice,
    );
    return withCurrencyCookie(
      NextResponse.json({ success: true, currency: finalCurrency, cart: repriced.cart ?? null }),
      finalCurrency,
    );
  } catch (error) {
    logCurrencyUpdateFailure(error);
    return NextResponse.json({ error: 'Failed to update session currency' }, { status: 500 });
  }
}
