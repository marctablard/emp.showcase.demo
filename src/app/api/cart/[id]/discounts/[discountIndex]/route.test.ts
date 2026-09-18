import { CART_API_REASON } from '@/lib/common/cart-api-error-mapping';
import { CUSTOMER_ID } from '@/lib/common/customer-identity';
import { CartDiscountError } from '@/platform/services/cart/errors';
import { DELETE } from './route';

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

describe('DELETE /api/cart/[id]/discounts/[discountIndex]', () => {
  let cartService: MockService;
  let sessionService: MockService;
  let logger: MockService;

  beforeEach(() => {
    cartService = {
      removeDiscount: jest.fn(),
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

  it('returns 401 when the session is missing', async () => {
    sessionService.getCurrent.mockResolvedValue(undefined);

    const response = await DELETE({} as never, {
      params: Promise.resolve({ id: 'cart-1', discountIndex: '0' }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Session not found' });
    expect(cartService.removeDiscount).not.toHaveBeenCalled();
  });

  it('lets an anonymous session remove a coupon it applied', async () => {
    const cart = { id: 'cart-1', discounts: [] };
    sessionService.getCurrent.mockResolvedValue({ customerId: CUSTOMER_ID.SESSION_ANONYMOUS });
    cartService.removeDiscount.mockResolvedValue(cart);

    const response = await DELETE({} as never, {
      params: Promise.resolve({ id: 'cart-1', discountIndex: '0' }),
    });

    expect(cartService.removeDiscount).toHaveBeenCalledWith('cart-1', 0);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(cart);
  });

  it('returns 400 for a non-integer index', async () => {
    sessionService.getCurrent.mockResolvedValue({ customerId: '69874565' });

    const response = await DELETE({} as never, {
      params: Promise.resolve({ id: 'cart-1', discountIndex: '1.5' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Discount index must be a non-negative integer' });
    expect(cartService.removeDiscount).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-numeric index', async () => {
    sessionService.getCurrent.mockResolvedValue({ customerId: '69874565' });

    const response = await DELETE({} as never, {
      params: Promise.resolve({ id: 'cart-1', discountIndex: 'foo' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Discount index must be a non-negative integer' });
    expect(cartService.removeDiscount).not.toHaveBeenCalled();
  });

  it('returns 400 for a negative index', async () => {
    sessionService.getCurrent.mockResolvedValue({ customerId: '69874565' });

    const response = await DELETE({} as never, {
      params: Promise.resolve({ id: 'cart-1', discountIndex: '-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Discount index must be a non-negative integer' });
    expect(cartService.removeDiscount).not.toHaveBeenCalled();
  });

  it('maps an upstream 404 as cart not found', async () => {
    sessionService.getCurrent.mockResolvedValue({ customerId: '69874565' });
    cartService.removeDiscount.mockRejectedValue(new CartDiscountError('Cart not found', { upstreamStatus: 404 }));

    const response = await DELETE({} as never, {
      params: Promise.resolve({ id: 'cart-1', discountIndex: '0' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Cart not found',
      reason: CART_API_REASON.NOT_FOUND,
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns the updated cart for an authenticated remove', async () => {
    const cart = { id: 'cart-1', discounts: [] };
    sessionService.getCurrent.mockResolvedValue({ customerId: '69874565' });
    cartService.removeDiscount.mockResolvedValue(cart);

    const response = await DELETE({} as never, {
      params: Promise.resolve({ id: 'cart-1', discountIndex: '0' }),
    });

    expect(cartService.removeDiscount).toHaveBeenCalledWith('cart-1', 0);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(cart);
  });
});
