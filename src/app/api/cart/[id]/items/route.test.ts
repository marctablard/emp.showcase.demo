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

describe('POST /api/cart/[id]/items', () => {
  const cartService = {
    addItemToCart: jest.fn(),
    getCart: jest.fn(),
    getCartById: jest.fn(),
  };
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    trace: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('CartService', cartService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('loads the cart that received the line when the current-cart lookup fails', async () => {
    cartService.addItemToCart.mockResolvedValue({
      cartItem: { id: 'item-1' },
      cartId: 'cart-new',
      status: 'OK',
    });
    cartService.getCart.mockRejectedValue(new Error('lookup failed'));
    cartService.getCartById.mockResolvedValue({ id: 'cart-new', items: [] });

    const response = await POST({ json: async () => ({ productId: 'prod-1', quantity: 1 }) } as never, {
      params: Promise.resolve({ id: 'cart-old' }),
    });
    const body = (await response.json()) as { cart?: { id?: string } };

    expect(response.status).toBe(200);
    expect(cartService.getCartById).toHaveBeenCalledWith('cart-new');
    expect(cartService.getCartById).not.toHaveBeenCalledWith('cart-old');
    expect(body.cart?.id).toBe('cart-new');
  });
});
