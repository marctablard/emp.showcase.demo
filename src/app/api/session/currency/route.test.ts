import { CURRENCY_COOKIE_NAME } from '@/lib/common/cookie-names';
import { CART_CURRENCY_UPDATE_ERROR_CODE, CartCurrencyUpdateError } from '@/platform/services/cart/errors';
import { PUT } from './route';

/**
 * Route-level tests for `PUT /api/session/currency`. Focus: the
 * `next-currency` cookie is written on the same success paths where
 * `SessionService.setCurrency` advances, and is suppressed on 400/409/500.
 */

// Mock the DI container BEFORE importing the route module so the route's
// `server.get<…>()` calls return our controlled service stubs.
jest.mock('@/platform/server', () => {
  const services = new Map<string, unknown>();
  return {
    __esModule: true,
    default: {
      get: jest.fn((id: string) => services.get(id)),
      __services: services,
    },
  };
});

const mockedServer = jest.requireMock('@/platform/server') as {
  default: { get: jest.Mock; __services: Map<string, unknown> };
};

type MockService = { [method: string]: jest.Mock };

function createRequest(body: unknown): { json: () => Promise<unknown> } {
  return {
    json: jest.fn().mockResolvedValue(body),
  };
}

describe('PUT /api/session/currency', () => {
  let cartService: MockService;
  let sessionService: MockService;
  let logger: MockService;

  beforeEach(() => {
    cartService = {
      getCart: jest.fn(),
      getCartById: jest.fn(),
      isProvenEmptyCart: jest.fn(),
      updateCurrency: jest.fn(),
    };
    sessionService = {
      getCurrent: jest.fn(),
      getCurrentOrThrow: jest.fn(),
      setCurrency: jest.fn(),
      clearCart: jest.fn(),
    };
    sessionService.getCurrentOrThrow.mockImplementation(() => sessionService.getCurrent());
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
    };

    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('CartService', cartService);
    mockedServer.default.__services.set('SessionService', sessionService);
    mockedServer.default.__services.set('LoggerService', logger);
    // Re-prime the `get` mock implementation — platform setup's
    // `jest.resetAllMocks()` clears it between tests.
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('sets the currency cookie with the expected attributes on the happy path', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'EUR' });
    cartService.getCart.mockResolvedValue({ id: 'c1', site: 'us', currency: 'EUR' });
    cartService.updateCurrency.mockResolvedValue(undefined);
    cartService.getCartById.mockResolvedValue({ id: 'c1', site: 'us', currency: 'USD' });
    sessionService.setCurrency.mockResolvedValue(undefined);

    const response = await PUT(createRequest({ currency: 'USD' }) as never);

    expect(response.status).toBe(200);
    const cookie = response.cookies.get(CURRENCY_COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe('USD');
    expect(cookie?.maxAge).toBe(365 * 24 * 60 * 60);
    expect(cookie?.httpOnly).toBe(false);
    expect(cookie?.sameSite).toBe('lax');
    expect(cookie?.path).toBe('/');
  });

  it('still sets the cookie when cart update fails with a recoverable code (CART_NOT_FOUND)', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'EUR' });
    cartService.getCart.mockResolvedValue({ id: 'c1', site: 'us', currency: 'EUR' });
    cartService.updateCurrency.mockRejectedValue(
      new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.CART_NOT_FOUND, 'cart gone'),
    );
    sessionService.setCurrency.mockResolvedValue(undefined);

    const response = await PUT(createRequest({ currency: 'USD' }) as never);

    expect(response.status).toBe(200);
    expect(sessionService.setCurrency).toHaveBeenCalledWith('USD');
    expect(response.cookies.get(CURRENCY_COOKIE_NAME)?.value).toBe('USD');
  });

  it('still sets the cookie when cart update fails with a recoverable code (STALE_CART_ID)', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'EUR' });
    cartService.getCart.mockResolvedValue({ id: 'c1', site: 'us', currency: 'EUR' });
    cartService.updateCurrency.mockRejectedValue(
      new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.STALE_CART_ID, 'stale id'),
    );
    sessionService.setCurrency.mockResolvedValue(undefined);

    const response = await PUT(createRequest({ currency: 'USD' }) as never);

    expect(response.status).toBe(200);
    expect(response.cookies.get(CURRENCY_COOKIE_NAME)?.value).toBe('USD');
  });

  it('clears an empty forbidden cart and still updates the session currency', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'EUR' });
    cartService.getCart.mockResolvedValue({ id: 'c1', site: 'us', currency: 'EUR', items: [] });
    cartService.isProvenEmptyCart.mockResolvedValue(true);
    cartService.updateCurrency.mockRejectedValue(
      new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.FORBIDDEN, 'Forbidden cart context'),
    );
    sessionService.setCurrency.mockResolvedValue(undefined);

    const response = await PUT(createRequest({ currency: 'USD' }) as never);

    expect(response.status).toBe(200);
    expect(sessionService.clearCart).toHaveBeenCalled();
    expect(sessionService.setCurrency).toHaveBeenCalledWith('USD');
    expect(response.cookies.get(CURRENCY_COOKIE_NAME)?.value).toBe('USD');
  });

  it('does not clear a forbidden cart that still has lines', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'EUR' });
    cartService.getCart.mockResolvedValue({
      id: 'c1',
      site: 'us',
      currency: 'EUR',
      items: [{ id: 'line-1' }],
    });
    cartService.isProvenEmptyCart.mockResolvedValue(false);
    cartService.updateCurrency.mockRejectedValue(
      new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.FORBIDDEN, 'Forbidden cart context'),
    );

    const response = await PUT(createRequest({ currency: 'USD' }) as never);
    const body = (await response.json()) as { code?: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe(CART_CURRENCY_UPDATE_ERROR_CODE.FORBIDDEN);
    expect(sessionService.clearCart).not.toHaveBeenCalled();
    expect(sessionService.setCurrency).not.toHaveBeenCalled();
  });

  it('does not clear when a fresh read shows the forbidden cart gained a line', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'EUR', cartId: 'c1' });
    cartService.getCart.mockResolvedValue({ id: 'c1', site: 'us', currency: 'EUR', items: [] });
    cartService.isProvenEmptyCart.mockResolvedValue(false);
    cartService.updateCurrency.mockRejectedValue(
      new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.FORBIDDEN, 'Forbidden cart context'),
    );

    const response = await PUT(createRequest({ currency: 'USD' }) as never);

    expect(response.status).toBe(409);
    expect(sessionService.clearCart).not.toHaveBeenCalled();
    expect(sessionService.setCurrency).not.toHaveBeenCalled();
  });

  it('reprices the cart the session pointer moved to instead of ignoring it', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'EUR', cartId: 'c-newer' });
    cartService.getCart.mockResolvedValue({ id: 'c1', site: 'us', currency: 'EUR', items: [] });
    cartService.isProvenEmptyCart.mockResolvedValue(true);
    cartService.updateCurrency
      .mockRejectedValueOnce(
        new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.FORBIDDEN, 'Forbidden cart context'),
      )
      .mockResolvedValueOnce(undefined);
    cartService.getCartById
      .mockResolvedValueOnce({ id: 'c-newer', site: 'us', currency: 'EUR' })
      .mockResolvedValue({ id: 'c-newer', site: 'us', currency: 'USD' });
    sessionService.setCurrency.mockResolvedValue(undefined);

    const response = await PUT(createRequest({ currency: 'USD' }) as never);
    const body = (await response.json()) as { cart?: { id?: string } };

    expect(response.status).toBe(200);
    expect(sessionService.clearCart).not.toHaveBeenCalled();
    expect(cartService.updateCurrency).toHaveBeenNthCalledWith(2, 'c-newer', 'USD');
    expect(body.cart?.id).toBe('c-newer');
    expect(sessionService.setCurrency).toHaveBeenCalledWith('USD');
  });

  it('does not clear the cart when the session read fails during empty-cart recovery', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'EUR' });
    sessionService.getCurrentOrThrow.mockRejectedValue(new Error('session down'));
    cartService.getCart.mockResolvedValue({ id: 'c1', site: 'us', currency: 'EUR', items: [] });
    cartService.isProvenEmptyCart.mockResolvedValue(true);
    cartService.updateCurrency.mockRejectedValue(
      new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.FORBIDDEN, 'Forbidden cart context'),
    );

    const response = await PUT(createRequest({ currency: 'USD' }) as never);

    expect(response.status).toBe(500);
    expect(sessionService.clearCart).not.toHaveBeenCalled();
    expect(sessionService.setCurrency).not.toHaveBeenCalled();
  });

  it('does not clear the cart when the session is absent during empty-cart recovery', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'EUR' });
    sessionService.getCurrentOrThrow.mockResolvedValue(undefined);
    cartService.getCart.mockResolvedValue({ id: 'c1', site: 'us', currency: 'EUR', items: [] });
    cartService.isProvenEmptyCart.mockResolvedValue(true);
    cartService.updateCurrency.mockRejectedValue(
      new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.FORBIDDEN, 'Forbidden cart context'),
    );

    const response = await PUT(createRequest({ currency: 'USD' }) as never);
    const body = (await response.json()) as { code?: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe(CART_CURRENCY_UPDATE_ERROR_CODE.FORBIDDEN);
    expect(sessionService.clearCart).not.toHaveBeenCalled();
    expect(sessionService.setCurrency).not.toHaveBeenCalled();
  });

  it('does NOT set the cookie when cart update fails with a non-recoverable code (409)', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'EUR' });
    cartService.getCart.mockResolvedValue({
      id: 'c1',
      site: 'us',
      currency: 'EUR',
      discounts: [
        { code: 'TOTAL', discountIndex: 0 },
        { code: 'ACCESSORIES15', discountIndex: 1 },
      ],
    });
    cartService.updateCurrency.mockRejectedValue(
      new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.UNSUPPORTED_CURRENCY, 'nope'),
    );

    const response = await PUT(createRequest({ currency: 'USD' }) as never);
    const body = (await response.json()) as { couponCodes?: string[] };

    expect(response.status).toBe(409);
    expect(body.couponCodes).toBeUndefined();
    expect(sessionService.setCurrency).not.toHaveBeenCalled();
    expect(response.cookies.get(CURRENCY_COOKIE_NAME)).toBeUndefined();
  });

  it('does not attach couponCodes to a generic context-mismatch currency failure', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'EUR' });
    cartService.getCart.mockResolvedValue({
      id: 'c1',
      site: 'us',
      currency: 'EUR',
      discounts: [
        { code: 'TOTAL', discountIndex: 0 },
        { code: 'ACCESSORIES15', discountIndex: 1 },
      ],
    });
    cartService.updateCurrency.mockRejectedValue(
      new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.CONTEXT_MISMATCH, 'price missing for item'),
    );

    const response = await PUT(createRequest({ currency: 'USD' }) as never);
    const body = (await response.json()) as { couponCodes?: string[]; code?: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe(CART_CURRENCY_UPDATE_ERROR_CODE.CONTEXT_MISMATCH);
    expect(body.couponCodes).toBeUndefined();
    expect(sessionService.setCurrency).not.toHaveBeenCalled();
  });

  it('includes couponCodes only for a classified coupon-currency conflict', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'EUR' });
    cartService.getCart.mockResolvedValue({
      id: 'c1',
      site: 'us',
      currency: 'EUR',
      discounts: [
        { code: 'TOTAL', discountIndex: 0 },
        { code: 'ACCESSORIES15', discountIndex: 1 },
      ],
    });
    cartService.updateCurrency.mockRejectedValue(
      new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.COUPON_CURRENCY_CONFLICT, 'coupon blocks currency'),
    );

    const response = await PUT(createRequest({ currency: 'USD' }) as never);
    const body = (await response.json()) as { couponCodes?: string[]; code?: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe(CART_CURRENCY_UPDATE_ERROR_CODE.COUPON_CURRENCY_CONFLICT);
    expect(body.couponCodes).toEqual(['ACCESSORIES15']);
    expect(sessionService.setCurrency).not.toHaveBeenCalled();
  });

  it('does not attach invalid coupon codes on a classified coupon-currency conflict', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'EUR' });
    cartService.getCart.mockResolvedValue({
      id: 'c1',
      site: 'us',
      currency: 'EUR',
      discounts: [
        { code: 'STALE10', discountIndex: 0, valid: false },
        { code: 'ACCESSORIES15', discountIndex: 1 },
      ],
    });
    cartService.updateCurrency.mockRejectedValue(
      new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.COUPON_CURRENCY_CONFLICT, 'coupon blocks currency'),
    );

    const response = await PUT(createRequest({ currency: 'USD' }) as never);
    const body = (await response.json()) as { couponCodes?: string[] };

    expect(response.status).toBe(409);
    expect(body.couponCodes).toEqual(['ACCESSORIES15']);
  });

  it('does NOT set the cookie when the body is missing currency (400)', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'EUR' });

    const response = await PUT(createRequest({}) as never);

    expect(response.status).toBe(400);
    expect(response.cookies.get(CURRENCY_COOKIE_NAME)).toBeUndefined();
  });

  it('does NOT set the cookie when session is missing (401)', async () => {
    sessionService.getCurrent.mockResolvedValue(null);

    const response = await PUT(createRequest({ currency: 'USD' }) as never);

    expect(response.status).toBe(401);
    expect(response.cookies.get(CURRENCY_COOKIE_NAME)).toBeUndefined();
  });

  it('rolls the cart currency back and returns 500 when the session write fails', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'EUR' });
    cartService.getCart.mockResolvedValue({ id: 'c1', site: 'us', currency: 'EUR' });
    cartService.updateCurrency.mockResolvedValue(undefined);
    cartService.getCartById.mockResolvedValue({ id: 'c1', site: 'us', currency: 'USD' });
    sessionService.setCurrency.mockRejectedValue(new Error('version conflict'));

    const response = await PUT(createRequest({ currency: 'USD' }) as never);

    expect(response.status).toBe(500);
    expect(cartService.updateCurrency).toHaveBeenNthCalledWith(1, 'c1', 'USD');
    expect(cartService.updateCurrency).toHaveBeenNthCalledWith(2, 'c1', 'EUR');
    expect(response.cookies.get(CURRENCY_COOKIE_NAME)).toBeUndefined();
  });

  it('restores the cart currency from before the reprice when it already differed from the session', async () => {
    sessionService.getCurrent.mockResolvedValue({ id: 's1', siteCode: 'us', currency: 'USD' });
    cartService.getCart.mockResolvedValue({ id: 'c1', site: 'us', currency: 'EUR' });
    cartService.updateCurrency.mockResolvedValue(undefined);
    cartService.getCartById.mockResolvedValue({ id: 'c1', site: 'us', currency: 'GBP' });
    sessionService.setCurrency.mockRejectedValue(new Error('version conflict'));

    const response = await PUT(createRequest({ currency: 'GBP' }) as never);

    expect(response.status).toBe(500);
    expect(cartService.updateCurrency).toHaveBeenNthCalledWith(1, 'c1', 'GBP');
    expect(cartService.updateCurrency).toHaveBeenNthCalledWith(2, 'c1', 'EUR');
    expect(response.cookies.get(CURRENCY_COOKIE_NAME)).toBeUndefined();
  });
});
