import { CART_API_REASON } from '@/lib/common/cart-api-error-mapping';
import { CUSTOMER_ID } from '@/lib/common/customer-identity';
import { CartDiscountError } from '@/platform/services/cart/errors';
import { POST } from './route';

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

describe('POST /api/cart/[id]/discounts', () => {
  let cartService: MockService;
  let sessionService: MockService;
  let logger: MockService;

  beforeEach(() => {
    cartService = {
      applyDiscount: jest.fn(),
    };
    sessionService = {
      getCurrent: jest.fn(),
    };
    logger = {
      error: jest.fn(),
    };

    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('CartService', cartService);
    mockedServer.default.__services.set('SessionService', sessionService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('maps a session lookup failure through the discount error boundary', async () => {
    sessionService.getCurrent.mockRejectedValue(new Error('session-context down'));

    const response = await POST(createRequest({ code: 'LS10PTOTAL' }) as never, {
      params: Promise.resolve({ id: 'cart-1' }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to apply discount',
      reason: CART_API_REASON.UPSTREAM_FAILURE,
    });
    expect(logger.error).toHaveBeenCalled();
    expect(cartService.applyDiscount).not.toHaveBeenCalled();
  });

  it('returns 401 when the session is missing', async () => {
    sessionService.getCurrent.mockResolvedValue(undefined);

    const response = await POST(createRequest({ code: 'LS10PTOTAL' }) as never, {
      params: Promise.resolve({ id: 'cart-1' }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Session not found' });
    expect(cartService.applyDiscount).not.toHaveBeenCalled();
  });

  it('lets an anonymous session apply a coupon (allowAnonymous is decided platform-side)', async () => {
    const cart = { id: 'cart-1', discounts: [{ code: 'VKTEST-PROMO01', discountIndex: 0 }] };
    sessionService.getCurrent.mockResolvedValue({ customerId: CUSTOMER_ID.SESSION_ANONYMOUS });
    cartService.applyDiscount.mockResolvedValue(cart);

    const response = await POST(createRequest({ code: 'VKTEST-PROMO01' }) as never, {
      params: Promise.resolve({ id: 'cart-1' }),
    });

    expect(cartService.applyDiscount).toHaveBeenCalledWith('cart-1', 'VKTEST-PROMO01');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(cart);
  });

  it('maps a platform rejection of an anonymous redemption to the generic not-applicable error', async () => {
    sessionService.getCurrent.mockResolvedValue({ customerId: CUSTOMER_ID.SESSION_ANONYMOUS });
    cartService.applyDiscount.mockRejectedValue(new CartDiscountError('Coupon not allowed', { upstreamStatus: 400 }));

    const response = await POST(createRequest({ code: 'SEGMENT-ONLY' }) as never, {
      params: Promise.resolve({ id: 'cart-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Discount is not applicable',
      reason: CART_API_REASON.DISCOUNT_NOT_APPLICABLE,
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    sessionService.getCurrent.mockResolvedValue({ customerId: '69874565' });

    const response = await POST({ json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token')) } as never, {
      params: Promise.resolve({ id: 'cart-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' });
    expect(cartService.applyDiscount).not.toHaveBeenCalled();
  });

  it('returns 400 when code is missing', async () => {
    sessionService.getCurrent.mockResolvedValue({ customerId: '69874565' });

    const response = await POST(createRequest({}) as never, {
      params: Promise.resolve({ id: 'cart-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Code is required' });
    expect(cartService.applyDiscount).not.toHaveBeenCalled();
  });

  it('maps an upstream 500 as 500 upstream_failure', async () => {
    sessionService.getCurrent.mockResolvedValue({ customerId: '69874565' });
    cartService.applyDiscount.mockRejectedValue(new CartDiscountError('Emporix down', { upstreamStatus: 500 }));

    const response = await POST(createRequest({ code: 'LS10PTOTAL' }) as never, {
      params: Promise.resolve({ id: 'cart-1' }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to apply discount',
      reason: CART_API_REASON.UPSTREAM_FAILURE,
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns the updated cart for an authenticated apply', async () => {
    const cart = { id: 'cart-1', discounts: [{ code: 'LS10PTOTAL', discountIndex: 0 }] };
    sessionService.getCurrent.mockResolvedValue({ customerId: '69874565' });
    cartService.applyDiscount.mockResolvedValue(cart);

    const response = await POST(createRequest({ code: ' LS10PTOTAL ' }) as never, {
      params: Promise.resolve({ id: 'cart-1' }),
    });

    expect(cartService.applyDiscount).toHaveBeenCalledWith('cart-1', 'LS10PTOTAL');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(cart);
  });
});
