import { Container } from 'inversify';
import type { EmporixSessionContext } from '@/platform/integrations/emporix/model/session-context';
import type { CartMigrationService } from '@/platform/services/cart/CartMigrationService';
import type { CartService } from '@/platform/services/cart/CartService';
import { CART_CURRENCY_UPDATE_ERROR_CODE, CartCurrencyUpdateError } from '@/platform/services/cart/errors';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Cart } from '@/platform/services/model/cart/cart';
import type { Site } from '@/platform/services/model/common/site';
import type { Session as ServiceSession } from '@/platform/services/model/session/session';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { SiteService } from '@/platform/services/site/SiteService';
import { EmporixAuthService } from './EmporixAuthService';

describe('EmporixAuthService', () => {
  let container: Container;
  let authService: EmporixAuthService;

  let mockSessionContextApi: { getOwnSessionContext: jest.Mock };
  let mockCustomerApi: { login: jest.Mock; logout: jest.Mock };
  let mockAddressMapper: { mapToSource: jest.Mock };
  let mockCartMigrationService: jest.Mocked<CartMigrationService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockCartService: jest.Mocked<CartService>;
  let mockSiteService: jest.Mocked<SiteService>;
  let mockLogger: jest.Mocked<LoggerService>;

  const credentials = { username: 'test@example.com', password: 'password123' };

  const loginSessionContext: EmporixSessionContext = {
    sessionId: 'customer-session-id',
    customerId: 'customer-123',
    siteCode: 'main',
    currency: 'EUR',
    targetLocation: 'DE',
  };

  const oldServiceSession: ServiceSession = {
    id: 'anon-session-id',
    siteCode: 'main',
    currency: 'EUR',
    cartId: 'anon-cart-id',
  };

  const anonymousCart: Cart = {
    id: 'anon-cart-id',
    currency: 'EUR',
    site: 'main',
    items: [
      {
        id: 'item-1',
        product: { id: 'prod-1', name: 'Test Product', description: '', purchasable: true },
        quantity: 2,
        price: { amount: 10, currency: 'EUR' },
      },
    ],
    shippingCosts: { amount: 0, currency: 'EUR' },
    totalPrice: { amount: 20, currency: 'EUR' },
    subTotalPrice: { amount: 20, currency: 'EUR' },
    tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
  };

  const customerCart: Cart = {
    id: 'customer-cart-id',
    currency: 'EUR',
    site: 'main',
    customerId: 'customer-123',
    items: [],
    shippingCosts: { amount: 0, currency: 'EUR' },
    totalPrice: { amount: 0, currency: 'EUR' },
    subTotalPrice: { amount: 0, currency: 'EUR' },
    tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0 },
  };

  const mainSite: Site = {
    code: 'main',
    name: 'Main Site',
    countries: [],
    shipToCountries: [],
    defaultCurrency: { id: 'EUR' },
    defaultCountry: 'DE',
    currencies: [{ id: 'EUR' }, { id: 'USD' }],
    languages: ['en'],
    regions: [],
    paymentModes: [],
    defaultLanguage: 'en',
    decimals: 2,
    address: {
      contactName: 'Main Site',
      street: 'Test Street',
      zipCode: '12345',
      city: 'Berlin',
      country: 'DE',
    },
    includesTax: false,
  };

  let cartLookup: Record<string, Cart | null>;

  const cloneCart = (cart: Cart, overrides: Partial<Cart> = {}): Cart => ({
    ...cart,
    ...overrides,
    items: (overrides.items ?? cart.items).map((item) => ({
      ...item,
      price: { ...item.price },
      product: item.product ? { ...item.product } : undefined,
      tax: item.tax ? { ...item.tax } : undefined,
    })),
    shippingCosts: overrides.shippingCosts ?? (cart.shippingCosts ? { ...cart.shippingCosts } : undefined),
    totalPrice: overrides.totalPrice ?? { ...cart.totalPrice },
    subTotalPrice: overrides.subTotalPrice ?? { ...cart.subTotalPrice },
    tax: overrides.tax ?? { ...cart.tax },
  });

  const withCurrency = (cart: Cart, currency: string): Cart =>
    cloneCart(cart, {
      currency,
      shippingCosts: cart.shippingCosts ? { ...cart.shippingCosts, currency } : undefined,
      totalPrice: { ...cart.totalPrice, currency },
      subTotalPrice: { ...cart.subTotalPrice, currency },
      tax: { ...cart.tax, currency },
    });

  const mergeCartState = (target: Cart, source: Cart): Cart =>
    cloneCart(target, {
      items: [...target.items, ...source.items.map((item) => ({ ...item, price: { ...item.price } }))],
    });

  const configureCartLookup = (overrides: Record<string, Cart | null> = {}) => {
    cartLookup = {
      [anonymousCart.id]: cloneCart(anonymousCart),
      [customerCart.id]: cloneCart(customerCart),
      ...Object.fromEntries(Object.entries(overrides).map(([cartId, cart]) => [cartId, cart ? cloneCart(cart) : null])),
    };

    mockCartService.getCartById.mockImplementation(async (cartId: string) => cartLookup[cartId] ?? null);
  };

  const mockSuccessfulCurrencyUpdate = () => {
    mockCartService.updateCurrency.mockImplementation(async (cartId: string, currency: string) => {
      const cart = cartLookup[cartId];
      if (cart) {
        cartLookup[cartId] = withCurrency(cart, currency);
      }
    });
  };

  const mockSuccessfulMerge = () => {
    mockCartMigrationService.mergeCarts.mockImplementation(async (sourceCartId: string, targetCartId: string) => {
      const sourceCart = cartLookup[sourceCartId];
      const targetCart = cartLookup[targetCartId];
      if (sourceCart && targetCart) {
        cartLookup[targetCartId] = mergeCartState(targetCart, sourceCart);
      }
    });
  };

  beforeEach(() => {
    Object.assign(loginSessionContext, {
      sessionId: 'customer-session-id',
      customerId: 'customer-123',
      siteCode: 'main',
      currency: 'EUR',
      targetLocation: 'DE',
    });

    container = new Container();

    mockSessionContextApi = {
      getOwnSessionContext: jest.fn(),
    };

    mockCustomerApi = {
      login: jest.fn(),
      logout: jest.fn(),
    };

    mockAddressMapper = {
      mapToSource: jest.fn(),
    };

    mockCartMigrationService = {
      mergeCarts: jest.fn(),
    };

    mockSessionService = {
      getCurrent: jest.fn(),
      getById: jest.fn(),
      setLanguage: jest.fn(),
      setCurrency: jest.fn(),
      setCountry: jest.fn(),
      setSite: jest.fn(),
      setRegion: jest.fn(),
      setCart: jest.fn(),
      clearCart: jest.fn(),
    };

    mockCartService = {
      createCart: jest.fn(),
      getCart: jest.fn(),
      getCartById: jest.fn(),
      addItemToCart: jest.fn(),
      updateCartItemQuantity: jest.fn(),
      removeCartItem: jest.fn(),
      deleteCart: jest.fn(),
      updateShippingInfo: jest.fn(),
      updateCurrency: jest.fn(),
      updateSite: jest.fn(),
      getSavedCarts: jest.fn(),
      saveCart: jest.fn(),
      loadCart: jest.fn(),
      getCartByCriteria: jest.fn(),
    };

    mockSiteService = {
      getSite: jest.fn(),
    } as unknown as jest.Mocked<SiteService>;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<LoggerService>;

    container.bind('EmporixSessionContextApi').toConstantValue(mockSessionContextApi);
    container.bind('EmporixCustomerApi').toConstantValue(mockCustomerApi);
    container.bind('EmporixAddressMapper').toConstantValue(mockAddressMapper);
    container.bind('CartMigrationService').toConstantValue(mockCartMigrationService);
    container.bind('SessionService').toConstantValue(mockSessionService);
    container.bind('CartService').toConstantValue(mockCartService);
    container.bind('SiteService').toConstantValue(mockSiteService);
    container.bind('LoggerService').toConstantValue(mockLogger);
    container.bind<EmporixAuthService>('AuthService').to(EmporixAuthService);

    configureCartLookup();
    mockSuccessfulCurrencyUpdate();
    mockSuccessfulMerge();
    mockCartService.createCart.mockImplementation(async (currency: string, siteCode: string) => {
      const createdCartId = 'new-customer-cart-id';
      cartLookup[createdCartId] = cloneCart(customerCart, {
        id: createdCartId,
        currency,
        site: siteCode,
        customerId: loginSessionContext.customerId,
      });
      return createdCartId;
    });
    mockSiteService.getSite.mockResolvedValue(mainSite);
    authService = container.get<EmporixAuthService>('AuthService');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login - cart merge flow', () => {
    it('should merge anonymous cart into new customer cart when anonymous cart has items and no customer cart exists', async () => {
      mockSessionService.getCurrent.mockResolvedValue(oldServiceSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(null);
      mockCartService.createCart.mockImplementation(async (currency: string, siteCode: string) => {
        const createdCartId = 'new-customer-cart-id';
        cartLookup[createdCartId] = cloneCart(customerCart, {
          id: createdCartId,
          currency,
          site: siteCode,
          customerId: loginSessionContext.customerId,
        });
        return createdCartId;
      });
      mockSuccessfulMerge();
      mockSessionService.setCart.mockResolvedValue(undefined);

      const result = await authService.login(credentials);

      expect(mockCartService.getCartById).toHaveBeenCalledWith('anon-cart-id', false);
      expect(mockCartService.createCart).toHaveBeenCalledWith('EUR', 'main');
      expect(mockCartMigrationService.mergeCarts).toHaveBeenCalledWith('anon-cart-id', 'new-customer-cart-id');
      expect(mockSessionService.setCart).toHaveBeenCalledWith('new-customer-cart-id');
      expect(result.cartId).toBe('new-customer-cart-id');
      expect(result.cartMergeStatus).toBe('MERGED');
    });

    it('should merge anonymous cart into existing customer cart when both carts exist', async () => {
      mockSessionService.getCurrent.mockResolvedValue(oldServiceSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(customerCart);
      mockSuccessfulMerge();
      mockSessionService.setCart.mockResolvedValue(undefined);

      const result = await authService.login(credentials);

      expect(mockCartService.createCart).not.toHaveBeenCalled();
      expect(mockCartMigrationService.mergeCarts).toHaveBeenCalledWith('anon-cart-id', 'customer-cart-id');
      expect(mockSessionService.setCart).toHaveBeenCalledWith('customer-cart-id');
      expect(result.cartId).toBe('customer-cart-id');
      expect(result.cartMergeStatus).toBe('MERGED');
    });

    it('should not merge when anonymous cart has no items', async () => {
      const emptyAnonymousCart: Cart = { ...anonymousCart, items: [] };
      configureCartLookup({ [anonymousCart.id]: emptyAnonymousCart });
      mockSessionService.getCurrent.mockResolvedValue(oldServiceSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(customerCart);

      const result = await authService.login(credentials);

      expect(mockCartMigrationService.mergeCarts).not.toHaveBeenCalled();
      expect(mockCartService.getCart).toHaveBeenCalled();
      expect(result.cartId).toBe('customer-cart-id');
      expect(mockSessionService.setCart).toHaveBeenCalledWith('customer-cart-id');
      expect(result.cartMergeStatus).toBe('NOT_APPLICABLE');
    });

    it('should not merge when no anonymous cart exists', async () => {
      configureCartLookup({ [anonymousCart.id]: null });
      mockSessionService.getCurrent.mockResolvedValue(oldServiceSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(customerCart);

      const result = await authService.login(credentials);

      expect(mockCartMigrationService.mergeCarts).not.toHaveBeenCalled();
      expect(mockCartService.getCart).toHaveBeenCalled();
      expect(result.cartId).toBe('customer-cart-id');
      expect(mockSessionService.setCart).toHaveBeenCalledWith('customer-cart-id');
      expect(result.cartMergeStatus).toBe('NOT_APPLICABLE');
    });

    it('should not merge when old session has no cartId', async () => {
      const sessionWithoutCart: ServiceSession = { ...oldServiceSession, cartId: undefined };
      mockSessionService.getCurrent.mockResolvedValue(sessionWithoutCart);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(customerCart);

      const result = await authService.login(credentials);

      expect(mockCartService.getCartById).not.toHaveBeenCalled();
      expect(mockCartMigrationService.mergeCarts).not.toHaveBeenCalled();
      expect(result.cartId).toBe('customer-cart-id');
      expect(result.cartMergeStatus).toBe('NOT_APPLICABLE');
    });

    it('should change anonymous cart currency and merge when currencies differ', async () => {
      const usdAnonymousCart: Cart = { ...anonymousCart, currency: 'USD' };
      const eurCustomerCart: Cart = { ...customerCart, currency: 'EUR' };

      configureCartLookup({
        [anonymousCart.id]: usdAnonymousCart,
        [customerCart.id]: eurCustomerCart,
      });
      mockSessionService.getCurrent.mockResolvedValue(oldServiceSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(eurCustomerCart);
      mockSuccessfulCurrencyUpdate();
      mockSuccessfulMerge();
      mockSessionService.setCart.mockResolvedValue(undefined);

      const result = await authService.login(credentials);

      expect(mockCartService.updateCurrency).not.toHaveBeenCalledWith('anon-cart-id', 'EUR');
      expect(mockCartMigrationService.mergeCarts).not.toHaveBeenCalled();
      expect(mockSessionService.setCart).toHaveBeenCalledWith('customer-cart-id');
      expect(result.cartId).toBe('customer-cart-id');
      expect(result.cartMergeStatus).toBe('FALLBACK');
      expect(result.cartMergeReason).toBe('CURRENCY_ALIGNMENT_FAILED');
    });

    it('should preserve shopper-selected currency when it is supported on the target site', async () => {
      const shopperSelectedSession: ServiceSession = { ...oldServiceSession, currency: 'USD' };
      const usdAnonymousCart: Cart = {
        ...anonymousCart,
        currency: 'USD',
        shippingCosts: { amount: 0, currency: 'USD' },
        totalPrice: { amount: 20, currency: 'USD' },
        subTotalPrice: { amount: 20, currency: 'USD' },
        tax: { amount: 0, currency: 'USD', netValue: 0, grossValue: 0 },
      };
      const eurCustomerCart: Cart = { ...customerCart, currency: 'EUR' };

      configureCartLookup({
        [anonymousCart.id]: usdAnonymousCart,
        [customerCart.id]: eurCustomerCart,
      });
      mockSessionService.getCurrent.mockResolvedValue(shopperSelectedSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(eurCustomerCart);
      mockSuccessfulCurrencyUpdate();
      mockSuccessfulMerge();
      mockSessionService.setCart.mockResolvedValue(undefined);

      const result = await authService.login(credentials);

      expect(mockCartService.updateCurrency).toHaveBeenCalledWith('customer-cart-id', 'USD');
      expect(mockSessionService.setCurrency).toHaveBeenCalledWith('USD');
      expect(result.currency).toBe('USD');
      expect(result.cartMergeStatus).toBe('MERGED');
    });

    it('should fall back to customer currency when shopper-selected currency is unsupported', async () => {
      const shopperSelectedSession: ServiceSession = { ...oldServiceSession, currency: 'GBP' };
      const usdAnonymousCart: Cart = {
        ...anonymousCart,
        currency: 'USD',
        shippingCosts: { amount: 0, currency: 'USD' },
        totalPrice: { amount: 20, currency: 'USD' },
        subTotalPrice: { amount: 20, currency: 'USD' },
        tax: { amount: 0, currency: 'USD', netValue: 0, grossValue: 0 },
      };

      configureCartLookup({ [anonymousCart.id]: usdAnonymousCart });
      mockSessionService.getCurrent.mockResolvedValue(shopperSelectedSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(customerCart);
      mockSuccessfulCurrencyUpdate();
      mockSuccessfulMerge();
      mockSessionService.setCart.mockResolvedValue(undefined);

      const result = await authService.login(credentials);

      expect(mockCartMigrationService.mergeCarts).not.toHaveBeenCalled();
      expect(result.currency).toBe('EUR');
      expect(result.cartMergeStatus).toBe('FALLBACK');
      expect(result.cartMergeReason).toBe('CURRENCY_ALIGNMENT_FAILED');
    });

    it('should fall back to site default currency when selected and customer currencies are unsupported', async () => {
      const shopperSelectedSession: ServiceSession = { ...oldServiceSession, currency: 'GBP' };
      const unsupportedCustomerSession: EmporixSessionContext = {
        ...loginSessionContext,
        currency: 'CHF',
      };
      const gbpAnonymousCart: Cart = {
        ...anonymousCart,
        currency: 'GBP',
        shippingCosts: { amount: 0, currency: 'GBP' },
        totalPrice: { amount: 20, currency: 'GBP' },
        subTotalPrice: { amount: 20, currency: 'GBP' },
        tax: { amount: 0, currency: 'GBP', netValue: 0, grossValue: 0 },
      };

      configureCartLookup({ [anonymousCart.id]: gbpAnonymousCart });
      mockSiteService.getSite.mockResolvedValue({
        ...mainSite,
        defaultCurrency: { id: 'USD' },
        currencies: [{ id: 'USD' }],
      });
      mockSessionService.getCurrent.mockResolvedValue(shopperSelectedSession);
      mockCustomerApi.login.mockResolvedValue(unsupportedCustomerSession);
      mockCartService.getCart.mockResolvedValue(null);
      mockCartService.createCart.mockImplementation(async (currency: string, siteCode: string) => {
        const createdCartId = 'new-customer-cart-id';
        cartLookup[createdCartId] = cloneCart(customerCart, {
          id: createdCartId,
          currency,
          site: siteCode,
          customerId: loginSessionContext.customerId,
        });
        return createdCartId;
      });
      mockSuccessfulCurrencyUpdate();
      mockSuccessfulMerge();
      mockSessionService.setCart.mockResolvedValue(undefined);

      const result = await authService.login(credentials);

      expect(mockCartService.createCart).toHaveBeenCalledWith('USD', 'main');
      expect(mockCartMigrationService.mergeCarts).not.toHaveBeenCalled();
      expect(mockSessionService.setCurrency).toHaveBeenCalledWith('USD');
      expect(result.currency).toBe('USD');
      expect(result.cartMergeStatus).toBe('FALLBACK');
      expect(result.cartMergeReason).toBe('CURRENCY_ALIGNMENT_FAILED');
      expect(result.cartId).toBe('new-customer-cart-id');
    });

    it('should continue login when final session currency sync fails after cart transition', async () => {
      const shopperSelectedSession: ServiceSession = { ...oldServiceSession, currency: 'USD' };
      const usdAnonymousCart: Cart = {
        ...anonymousCart,
        currency: 'USD',
        shippingCosts: { amount: 0, currency: 'USD' },
        totalPrice: { amount: 20, currency: 'USD' },
        subTotalPrice: { amount: 20, currency: 'USD' },
        tax: { amount: 0, currency: 'USD', netValue: 0, grossValue: 0 },
      };
      const eurCustomerCart: Cart = { ...customerCart, currency: 'EUR' };

      configureCartLookup({
        [anonymousCart.id]: usdAnonymousCart,
        [customerCart.id]: eurCustomerCart,
      });
      mockSessionService.getCurrent.mockResolvedValue(shopperSelectedSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(eurCustomerCart);
      mockSuccessfulCurrencyUpdate();
      mockSuccessfulMerge();
      mockSessionService.setCart.mockResolvedValue(undefined);
      mockSessionService.setCurrency.mockRejectedValue(new Error('Session update failed'));

      const result = await authService.login(credentials);

      expect(mockCartMigrationService.mergeCarts).toHaveBeenCalledWith('anon-cart-id', 'customer-cart-id');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          customerId: 'customer-123',
          cartId: 'customer-cart-id',
          currentCurrency: 'EUR',
          targetCurrency: 'USD',
        }),
        'Failed to sync session currency after login cart transition',
      );
      expect(result.cartId).toBe('customer-cart-id');
      expect(result.currency).toBe('EUR');
    });

    it('should fall back to customer currency when site resolution fails', async () => {
      const shopperSelectedSession: ServiceSession = { ...oldServiceSession, currency: 'USD' };

      mockSiteService.getSite.mockRejectedValue(new Error('Site lookup failed'));
      mockSessionService.getCurrent.mockResolvedValue(shopperSelectedSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(customerCart);
      mockSuccessfulMerge();
      mockSessionService.setCart.mockResolvedValue(undefined);

      const result = await authService.login(credentials);

      expect(mockCartService.updateCurrency).not.toHaveBeenCalledWith('customer-cart-id', 'USD');
      expect(mockSessionService.setCurrency).not.toHaveBeenCalled();
      expect(result.currency).toBe('EUR');
    });

    it('should align both carts to the resolved final currency before merge when needed', async () => {
      const shopperSelectedSession: ServiceSession = { ...oldServiceSession, currency: 'USD' };
      const usdAnonymousCart: Cart = {
        ...anonymousCart,
        currency: 'USD',
        shippingCosts: { amount: 0, currency: 'USD' },
        totalPrice: { amount: 20, currency: 'USD' },
        subTotalPrice: { amount: 20, currency: 'USD' },
        tax: { amount: 0, currency: 'USD', netValue: 0, grossValue: 0 },
      };
      const eurCustomerCart: Cart = { ...customerCart, currency: 'EUR' };

      configureCartLookup({
        [anonymousCart.id]: usdAnonymousCart,
        [customerCart.id]: eurCustomerCart,
      });
      mockSessionService.getCurrent.mockResolvedValue(shopperSelectedSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(eurCustomerCart);
      mockSuccessfulCurrencyUpdate();
      mockSuccessfulMerge();
      mockSessionService.setCart.mockResolvedValue(undefined);

      await authService.login(credentials);

      expect(mockCartService.updateCurrency).toHaveBeenCalledTimes(1);
      expect(mockCartService.updateCurrency).toHaveBeenCalledWith('customer-cart-id', 'USD');
      expect(mockCartMigrationService.mergeCarts).toHaveBeenCalledWith('anon-cart-id', 'customer-cart-id');
    });

    it('should update session with customer cart ID after successful merge', async () => {
      mockSessionService.getCurrent.mockResolvedValue(oldServiceSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(customerCart);
      mockSuccessfulMerge();
      mockSessionService.setCart.mockResolvedValue(undefined);

      await authService.login(credentials);

      expect(mockSessionService.setCart).toHaveBeenCalledWith('customer-cart-id');
    });

    it('should retry merge with site default currency when merge fails on newly created customer cart due missing price', async () => {
      const shopperSelectedSession: ServiceSession = { ...oldServiceSession, currency: 'USD' };
      const usdAnonymousCart: Cart = {
        ...anonymousCart,
        currency: 'USD',
        shippingCosts: { amount: 0, currency: 'USD' },
        totalPrice: { amount: 20, currency: 'USD' },
        subTotalPrice: { amount: 20, currency: 'USD' },
        tax: { amount: 0, currency: 'USD', netValue: 0, grossValue: 0 },
      };
      const createdCustomerCart: Cart = {
        ...customerCart,
        id: 'new-customer-cart-id',
        currency: 'USD',
      };

      configureCartLookup({
        [anonymousCart.id]: usdAnonymousCart,
        [createdCustomerCart.id]: createdCustomerCart,
      });
      mockSessionService.getCurrent.mockResolvedValue(shopperSelectedSession);
      mockCustomerApi.login.mockResolvedValue({ ...loginSessionContext, currency: 'USD' });
      mockCartService.getCart.mockResolvedValue(null);
      mockCartService.createCart.mockImplementation(async (currency: string, siteCode: string) => {
        const createdCartId = 'new-customer-cart-id';
        cartLookup[createdCartId] = cloneCart(customerCart, {
          id: createdCartId,
          currency,
          site: siteCode,
          customerId: loginSessionContext.customerId,
        });
        return createdCartId;
      });
      mockSuccessfulCurrencyUpdate();
      mockCartMigrationService.mergeCarts
        .mockRejectedValueOnce(
          new Error(
            'Failed to merge carts: Bad Request {"message":"No price has been found for productId:ProductPricematchReference[reference=bluesolar-victron-55w, itemType=INTERNAL, lineId=null, quantity=1.0] and currency:USD"}',
          ),
        )
        .mockImplementationOnce(async (sourceCartId: string, targetCartId: string) => {
          const sourceCart = cartLookup[sourceCartId];
          const targetCart = cartLookup[targetCartId];
          if (sourceCart && targetCart) {
            cartLookup[targetCartId] = mergeCartState(targetCart, sourceCart);
          }
        });
      mockSessionService.setCart.mockResolvedValue(undefined);

      const result = await authService.login(credentials);

      expect(mockCartService.createCart).toHaveBeenCalledWith('USD', 'main');
      expect(mockCartService.updateCurrency).not.toHaveBeenCalledWith('new-customer-cart-id', 'EUR');
      expect(mockCartMigrationService.mergeCarts).toHaveBeenCalledTimes(1);
      expect(result.cartId).toBe('new-customer-cart-id');
      expect(result.currency).toBe('USD');
      expect(result.cartMergeStatus).toBe('FALLBACK');
      expect(result.cartMergeReason).toBe('MERGE_FAILED');
    });

    it('should return correct cartId in session after merge', async () => {
      mockSessionService.getCurrent.mockResolvedValue(oldServiceSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(null);
      mockCartService.createCart.mockImplementation(async (currency: string, siteCode: string) => {
        const createdCartId = 'created-cart-id';
        cartLookup[createdCartId] = cloneCart(customerCart, {
          id: createdCartId,
          currency,
          site: siteCode,
          customerId: loginSessionContext.customerId,
        });
        return createdCartId;
      });
      mockSuccessfulMerge();
      mockSessionService.setCart.mockResolvedValue(undefined);

      const result = await authService.login(credentials);

      expect(result.cartId).toBe('created-cart-id');
      expect(result.customerId).toBe('customer-123');
      expect(result.sessionId).toBe('customer-session-id');
    });

    it('should handle merge failure gracefully, switch to customer cart and still return session', async () => {
      mockSessionService.getCurrent.mockResolvedValue(oldServiceSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(customerCart);
      mockCartMigrationService.mergeCarts.mockRejectedValue(new Error('Merge API error'));
      mockSessionService.setCart.mockResolvedValue(undefined);

      const result = await authService.login(credentials);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          oldCartId: 'anon-cart-id',
          customerCartId: 'customer-cart-id',
        }),
        'Failed to merge carts during login',
      );
      expect(mockSessionService.setCart).toHaveBeenCalledWith('customer-cart-id');
      expect(result.sessionId).toBe('customer-session-id');
      expect(result.customerId).toBe('customer-123');
      expect(result.cartId).toBe('customer-cart-id');
      expect(result.cartMergeStatus).toBe('FALLBACK');
      expect(result.cartMergeReason).toBe('MERGE_FAILED');
    });

    it('should fall back to customer cart when changeCurrency fails with non-refresh error', async () => {
      const shopperSelectedSession: ServiceSession = { ...oldServiceSession, currency: 'USD' };
      const usdAnonymousCart: Cart = { ...anonymousCart, currency: 'USD' };
      configureCartLookup({ [anonymousCart.id]: usdAnonymousCart });
      mockSessionService.getCurrent.mockResolvedValue(shopperSelectedSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(customerCart);
      mockCartService.updateCurrency.mockRejectedValue(
        new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.UNSUPPORTED_CURRENCY, 'Currency not supported'),
      );
      mockSessionService.setCart.mockResolvedValue(undefined);

      const result = await authService.login(credentials);

      expect(mockCartService.updateCurrency).toHaveBeenCalledWith('customer-cart-id', 'USD');
      expect(mockCartMigrationService.mergeCarts).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ cartMergeReason: 'TRANSITION_FAILED', err: expect.any(Error) }),
        'Cart transition failed during login, continuing without merge',
      );
      expect(result.sessionId).toBe('customer-session-id');
      expect(result.customerId).toBe('customer-123');
      expect(result.cartId).toBeUndefined();
      expect(result.cartMergeStatus).toBe('FALLBACK');
      expect(result.cartMergeReason).toBe('TRANSITION_FAILED');
    });

    it('should continue with merge when updateCurrency fails with legalEntityId refresh error', async () => {
      const usdAnonymousCart: Cart = { ...anonymousCart, currency: 'USD' };
      configureCartLookup({ [anonymousCart.id]: usdAnonymousCart });
      mockSessionService.getCurrent.mockResolvedValue(oldServiceSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(customerCart);
      mockCartService.updateCurrency.mockImplementation(async (cartId: string, currency: string) => {
        const cart = cartLookup[cartId];
        if (cart) {
          cartLookup[cartId] = withCurrency(cart, currency);
        }
        throw new Error(
          'Failed to refresh cart: Bad Request {"message":"Anonymous cart cannot be assigned to a legal entity: xyz"}',
        );
      });
      mockSuccessfulMerge();
      mockSessionService.setCart.mockResolvedValue(undefined);

      const result = await authService.login(credentials);

      expect(mockCartService.updateCurrency).not.toHaveBeenCalledWith('anon-cart-id', 'EUR');
      expect(mockCartMigrationService.mergeCarts).not.toHaveBeenCalled();
      expect(mockSessionService.setCart).toHaveBeenCalledWith('customer-cart-id');
      expect(result.cartId).toBe('customer-cart-id');
      expect(result.cartMergeStatus).toBe('FALLBACK');
      expect(result.cartMergeReason).toBe('CURRENCY_ALIGNMENT_FAILED');
    });

    it('should fall back to customer cart when merge fails after successful currency change', async () => {
      const shopperSelectedSession: ServiceSession = { ...oldServiceSession, currency: 'USD' };
      const usdAnonymousCart: Cart = { ...anonymousCart, currency: 'USD' };
      configureCartLookup({ [anonymousCart.id]: usdAnonymousCart });
      mockSessionService.getCurrent.mockResolvedValue(shopperSelectedSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(customerCart);
      mockSuccessfulCurrencyUpdate();
      mockCartMigrationService.mergeCarts.mockRejectedValue(new Error('Merge failed'));
      mockSessionService.setCart.mockResolvedValue(undefined);

      const result = await authService.login(credentials);

      expect(mockCartService.updateCurrency).toHaveBeenCalledWith('customer-cart-id', 'USD');
      expect(mockCartMigrationService.mergeCarts).toHaveBeenCalledWith('anon-cart-id', 'customer-cart-id');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          oldCartId: 'anon-cart-id',
          customerCartId: 'customer-cart-id',
        }),
        'Failed to merge carts during login',
      );
      expect(mockSessionService.setCart).toHaveBeenCalledWith('customer-cart-id');
      expect(result.sessionId).toBe('customer-session-id');
      expect(result.customerId).toBe('customer-123');
      expect(result.cartId).toBe('customer-cart-id');
      expect(result.cartMergeStatus).toBe('FALLBACK');
      expect(result.cartMergeReason).toBe('MERGE_FAILED');
    });

    it('should continue merge with optimistic customer-currency alignment when repricing succeeds but verification is stale', async () => {
      const shopperSelectedSession: ServiceSession = { ...oldServiceSession, currency: 'USD' };
      configureCartLookup({ [anonymousCart.id]: withCurrency(anonymousCart, 'USD') });
      mockSessionService.getCurrent.mockResolvedValue(shopperSelectedSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(customerCart);
      mockCartService.updateCurrency.mockResolvedValue(undefined);
      mockSessionService.setCart.mockResolvedValue(undefined);

      const result = await authService.login(credentials);

      expect(mockCartService.updateCurrency).toHaveBeenCalledWith('customer-cart-id', 'USD');
      expect(mockCartMigrationService.mergeCarts).toHaveBeenCalledWith('anon-cart-id', 'customer-cart-id');
      expect(result.cartMergeStatus).toBe('MERGED');
      expect(result.currency).toBe('USD');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          cartId: 'customer-cart-id',
          customerId: 'customer-123',
          targetCurrency: 'USD',
        }),
        'Customer cart currency verification timed out after successful repricing; continuing optimistically',
      );
    });

    it('should retry cart currency verification when updated currency is not immediately visible', async () => {
      const shopperSelectedSession: ServiceSession = { ...oldServiceSession, currency: 'USD' };
      let staleCurrencyReadsRemaining = 2;

      configureCartLookup({ [anonymousCart.id]: withCurrency(anonymousCart, 'USD') });
      mockSessionService.getCurrent.mockResolvedValue(shopperSelectedSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(customerCart);
      mockSuccessfulCurrencyUpdate();
      mockSuccessfulMerge();
      mockSessionService.setCart.mockResolvedValue(undefined);
      mockCartService.getCartById.mockImplementation(async (cartId: string) => {
        const cart = cartLookup[cartId] ?? null;
        if (cartId === customerCart.id && cart && staleCurrencyReadsRemaining > 0) {
          staleCurrencyReadsRemaining -= 1;
          return cloneCart(cart, { currency: 'EUR' });
        }
        return cart;
      });

      const result = await authService.login(credentials);

      expect(mockCartService.updateCurrency).toHaveBeenCalledWith('customer-cart-id', 'USD');
      expect(mockCartMigrationService.mergeCarts).toHaveBeenCalledWith('anon-cart-id', 'customer-cart-id');
      expect(result.cartMergeStatus).toBe('MERGED');
      expect(result.currency).toBe('USD');
    });

    it('should mark merge as fallback when post-merge verification sees no quantity increase', async () => {
      configureCartLookup({
        [customerCart.id]: cloneCart(customerCart, {
          items: [
            {
              id: 'existing-item',
              quantity: 1,
              price: { amount: 5, currency: 'EUR' },
              product: { id: 'existing-prod', name: 'Existing Product', description: '', purchasable: true },
            },
          ],
          totalPrice: { amount: 5, currency: 'EUR' },
          subTotalPrice: { amount: 5, currency: 'EUR' },
        }),
      });
      mockSessionService.getCurrent.mockResolvedValue(oldServiceSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(cartLookup[customerCart.id]);
      mockCartMigrationService.mergeCarts.mockResolvedValue(undefined);
      mockSessionService.setCart.mockResolvedValue(undefined);

      const result = await authService.login(credentials);

      expect(mockCartMigrationService.mergeCarts).toHaveBeenCalledWith('anon-cart-id', 'customer-cart-id');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          anonymousCartId: 'anon-cart-id',
          customerCartId: 'customer-cart-id',
          customerCartQuantityBeforeMerge: 1,
          anonymousCartQuantity: 2,
          mergedCartQuantity: 1,
        }),
        'Merged cart verification failed after login transition',
      );
      expect(result.cartMergeStatus).toBe('FALLBACK');
      expect(result.cartMergeReason).toBe('MERGE_FAILED');
    });

    it('should retry merged cart verification when merged quantity is not immediately visible', async () => {
      let staleMergedCartReadsRemaining = 2;
      const preMergeCustomerCart = cloneCart(customerCart, {
        items: [
          {
            id: 'existing-item',
            quantity: 1,
            price: { amount: 5, currency: 'EUR' },
            product: { id: 'existing-prod', name: 'Existing Product', description: '', purchasable: true },
          },
        ],
        totalPrice: { amount: 5, currency: 'EUR' },
        subTotalPrice: { amount: 5, currency: 'EUR' },
      });

      configureCartLookup({
        [customerCart.id]: preMergeCustomerCart,
      });
      mockSessionService.getCurrent.mockResolvedValue(oldServiceSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(preMergeCustomerCart);
      mockCartMigrationService.mergeCarts.mockImplementation(async (sourceCartId: string, targetCartId: string) => {
        const sourceCart = cartLookup[sourceCartId];
        const targetCart = cartLookup[targetCartId];
        if (sourceCart && targetCart) {
          cartLookup[targetCartId] = mergeCartState(targetCart, sourceCart);
        }
      });
      mockSessionService.setCart.mockResolvedValue(undefined);
      mockCartService.getCartById.mockImplementation(async (cartId: string) => {
        const cart = cartLookup[cartId] ?? null;
        if (cartId === customerCart.id && cart && staleMergedCartReadsRemaining > 0) {
          staleMergedCartReadsRemaining -= 1;
          return preMergeCustomerCart;
        }
        return cart;
      });

      const result = await authService.login(credentials);

      expect(mockCartMigrationService.mergeCarts).toHaveBeenCalledWith('anon-cart-id', 'customer-cart-id');
      expect(result.cartMergeStatus).toBe('MERGED');
      expect(result.cartId).toBe('customer-cart-id');
    });

    it('should not call updateCurrency when currencies already match', async () => {
      mockSessionService.getCurrent.mockResolvedValue(oldServiceSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(customerCart); // EUR
      mockSuccessfulMerge();
      mockSessionService.setCart.mockResolvedValue(undefined);

      await authService.login(credentials);

      expect(mockCartService.updateCurrency).not.toHaveBeenCalled();
      expect(mockCartMigrationService.mergeCarts).toHaveBeenCalledWith('anon-cart-id', 'customer-cart-id');
      expect(mockSessionService.setCart).toHaveBeenCalledWith('customer-cart-id');
    });

    it('should not merge when old session does not exist', async () => {
      mockSessionService.getCurrent.mockResolvedValue(undefined);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(customerCart);

      const result = await authService.login(credentials);

      expect(mockCartService.getCartById).not.toHaveBeenCalled();
      expect(mockCartMigrationService.mergeCarts).not.toHaveBeenCalled();
      expect(result.cartId).toBe('customer-cart-id');
    });

    it('should not merge when cart already belongs to a customer', async () => {
      const customerOwnedCart: Cart = { ...anonymousCart, customerId: 'some-customer' };
      configureCartLookup({ [anonymousCart.id]: customerOwnedCart });
      mockSessionService.getCurrent.mockResolvedValue(oldServiceSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(customerCart);

      const result = await authService.login(credentials);

      expect(mockCartService.getCart).toHaveBeenCalled();
      expect(mockCartMigrationService.mergeCarts).not.toHaveBeenCalled();
      expect(result.cartId).toBe('customer-cart-id');
    });

    it('should handle getCartById failure gracefully and still return session', async () => {
      mockSessionService.getCurrent.mockResolvedValue(oldServiceSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCartById.mockRejectedValue(new Error('Cart API error'));

      const result = await authService.login(credentials);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Cart transition failed during login, continuing without merge',
      );
      expect(mockCartMigrationService.mergeCarts).not.toHaveBeenCalled();
      expect(result.sessionId).toBe('customer-session-id');
      expect(result.customerId).toBe('customer-123');
    });

    it('should handle createCart failure gracefully and still return session', async () => {
      mockSessionService.getCurrent.mockResolvedValue(oldServiceSession);
      mockCustomerApi.login.mockResolvedValue(loginSessionContext);
      mockCartService.getCart.mockResolvedValue(null);
      mockCartService.createCart.mockRejectedValue(new Error('Create cart failed'));

      const result = await authService.login(credentials);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to ensure customer cart binding',
      );
      expect(mockCartMigrationService.mergeCarts).not.toHaveBeenCalled();
      expect(result.sessionId).toBe('customer-session-id');
      expect(result.customerId).toBe('customer-123');
    });

    it('should use anonymous cart currency when session currency is undefined', async () => {
      const noCurrencySession: EmporixSessionContext = {
        ...loginSessionContext,
        currency: undefined,
      };
      mockSessionService.getCurrent.mockResolvedValue(oldServiceSession);
      mockCustomerApi.login.mockResolvedValue(noCurrencySession);
      mockCartService.getCart.mockResolvedValue(null);
      mockCartService.createCart.mockImplementation(async (currency: string, siteCode: string) => {
        const createdCartId = 'new-cart-id';
        cartLookup[createdCartId] = cloneCart(customerCart, {
          id: createdCartId,
          currency,
          site: siteCode,
          customerId: loginSessionContext.customerId,
        });
        return createdCartId;
      });
      mockSuccessfulMerge();
      mockSessionService.setCart.mockResolvedValue(undefined);

      await authService.login(credentials);

      // Should use anonymousCart.currency ('EUR') as fallback
      expect(mockCartService.createCart).toHaveBeenCalledWith('EUR', 'main');
      expect(mockCartMigrationService.mergeCarts).toHaveBeenCalled();
    });
  });
});
