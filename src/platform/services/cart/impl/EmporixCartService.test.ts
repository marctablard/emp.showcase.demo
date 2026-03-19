import { Container } from 'inversify';
import 'reflect-metadata';
import type { EmporixCartApi } from '@/platform/integrations/emporix/cart/EmporixCartApi';
import type EmporixCommonUtil from '@/platform/integrations/emporix/common/util/EmporixCommonUtil';
import type { EmporixCart } from '@/platform/integrations/emporix/model/cart';
import { CartCurrencyUpdateError } from '@/platform/services/cart/errors';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CartMapper } from '@/platform/services/model/cart/CartMapper';
import type { Cart } from '@/platform/services/model/cart/cart';
import type { ProductPrice } from '@/platform/services/model/price';
import type { PriceService } from '@/platform/services/price/PriceService';
import type { ProductService } from '@/platform/services/product/ProductService';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { SiteService } from '@/platform/services/site/SiteService';
import type { StockService } from '@/platform/services/stock/StockService';
import EmporixCartService from './EmporixCartService';

describe('EmporixCartService', () => {
  let container: Container;
  let cartService: EmporixCartService;

  let mockCartApi: jest.Mocked<
    Pick<
      EmporixCartApi,
      | 'getCart'
      | 'updateCart'
      | 'refreshCart'
      | 'changeCurrency'
      | 'addItemToCart'
      | 'getCartByCriteria'
      | 'updateCartItemQuantity'
    >
  >;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockSessionService: jest.Mocked<Pick<SessionService, 'getCurrent' | 'setCart'>>;
  let mockSiteService: jest.Mocked<Pick<SiteService, 'getSite'>>;
  let mockPriceService: jest.Mocked<Pick<PriceService, 'getProductPrice'>>;
  let mockProductService: jest.Mocked<Pick<ProductService, 'getProductById'>>;
  let mockStockService: jest.Mocked<Pick<StockService, 'getStockAvailability'>>;
  let mockCommonUtil: jest.Mocked<Pick<EmporixCommonUtil, 'generateProductYrn'>>;
  let mockMapper: jest.Mocked<Pick<CartMapper<EmporixCart, unknown>, 'mapToService'>>;

  // Minimal stubs for unused dependencies
  const noop = {} as Record<string, jest.Mock>;

  const mainSite = {
    code: 'main',
    currencies: [
      { code: 'EUR', id: 'EUR' },
      { code: 'USD', id: 'USD' },
    ],
  };

  beforeEach(() => {
    container = new Container();

    mockCartApi = {
      getCart: jest.fn(),
      updateCart: jest.fn().mockResolvedValue(undefined),
      refreshCart: jest.fn().mockResolvedValue(undefined),
      changeCurrency: jest.fn().mockResolvedValue(undefined),
      addItemToCart: jest.fn().mockResolvedValue('new-item-id'),
      getCartByCriteria: jest.fn().mockResolvedValue(null),
      updateCartItemQuantity: jest.fn().mockResolvedValue(undefined),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<LoggerService>;

    mockSessionService = {
      getCurrent: jest.fn().mockResolvedValue(null),
      setCart: jest.fn().mockResolvedValue(undefined),
    };

    mockSiteService = {
      getSite: jest.fn().mockResolvedValue(mainSite),
    };

    mockPriceService = {
      getProductPrice: jest.fn().mockResolvedValue(null),
    };

    mockProductService = {
      getProductById: jest.fn().mockResolvedValue(null),
    };

    mockStockService = {
      getStockAvailability: jest.fn().mockResolvedValue({ availableQuantity: 100 }),
    };

    mockCommonUtil = {
      generateProductYrn: jest.fn().mockReturnValue('yrn:product:prod-1'),
    };

    mockMapper = {
      mapToService: jest.fn(),
    };

    container.bind('EmporixCommonUtil').toConstantValue(mockCommonUtil);
    container.bind('EmporixCartApi').toConstantValue(mockCartApi);
    container.bind('EmporixCartMapper').toConstantValue(mockMapper);
    container.bind('SessionService').toConstantValue(mockSessionService);
    container.bind('PriceService').toConstantValue(mockPriceService);
    container.bind('ProductService').toConstantValue(mockProductService);
    container.bind('StockService').toConstantValue(mockStockService);
    container.bind('LoggerService').toConstantValue(mockLogger);
    container.bind('SiteService').toConstantValue(mockSiteService);
    container.bind<EmporixCartService>('CartService').to(EmporixCartService);

    cartService = container.get<EmporixCartService>('CartService');
  });

  describe('updateShippingInfo', () => {
    it('should send addresses array with SHIPPING entry to updateCart', async () => {
      const fullCart: EmporixCart = {
        id: 'cart-123',
        yrn: 'yrn:emporix:cart:cart-123',
        customerId: 'customer-456',
        sessionId: 'session-789',
        legalEntityId: 'legal-entity-001',
        currency: 'EUR',
        siteCode: 'main',
        status: 'OPEN',
        type: 'shopping',
        items: [
          {
            id: 'item-1',
            itemYrn: 'yrn:product:1',
            product: { id: 'prod-1', name: 'Widget' },
            quantity: 3,
            price: { effectiveAmount: 10, originalAmount: 10, currency: 'EUR' },
          },
        ] as unknown as EmporixCart['items'],
        totalUnitsCount: 3,
        metadata: { version: 5 },
      };

      mockCartApi.getCart.mockResolvedValue(fullCart);

      await cartService.updateShippingInfo('cart-123', { country: 'US', zipCode: '10001' });

      expect(mockCartApi.updateCart).toHaveBeenCalledWith('cart-123', {
        metadata: { version: 6 },
        addresses: [{ country: 'US', zipCode: '10001', type: 'SHIPPING' }],
      });

      const updatePayload = mockCartApi.updateCart.mock.calls[0][1];
      expect(updatePayload).not.toHaveProperty('id');
      expect(updatePayload).not.toHaveProperty('yrn');
      expect(updatePayload).not.toHaveProperty('customerId');
      expect(updatePayload).not.toHaveProperty('sessionId');
      expect(updatePayload).not.toHaveProperty('legalEntityId');
      expect(updatePayload).not.toHaveProperty('countryCode');
      expect(updatePayload).not.toHaveProperty('zipCode');
      expect(updatePayload).not.toHaveProperty('status');
      expect(updatePayload).not.toHaveProperty('items');
      expect(updatePayload).not.toHaveProperty('currency');
      expect(updatePayload).not.toHaveProperty('siteCode');
    });

    it('should send both SHIPPING and BILLING addresses when billing is provided', async () => {
      const cart: EmporixCart = {
        id: 'cart-both',
        currency: 'EUR',
        siteCode: 'main',
        metadata: { version: 1 },
      };

      mockCartApi.getCart.mockResolvedValue(cart);

      await cartService.updateShippingInfo(
        'cart-both',
        { country: 'DE', zipCode: '10115', city: 'Berlin', street: 'Friedrichstr.' },
        { country: 'DE', zipCode: '80331', city: 'München', street: 'Marienplatz' },
      );

      expect(mockCartApi.updateCart).toHaveBeenCalledWith('cart-both', {
        metadata: { version: 2 },
        addresses: [
          { country: 'DE', zipCode: '10115', city: 'Berlin', street: 'Friedrichstr.', type: 'SHIPPING' },
          { country: 'DE', zipCode: '80331', city: 'München', street: 'Marienplatz', type: 'BILLING' },
        ],
      });
    });

    it('should handle cart with no metadata (version starts at 1)', async () => {
      const cartNoMetadata: EmporixCart = {
        id: 'cart-no-meta',
        currency: 'EUR',
        siteCode: 'main',
        metadata: undefined,
      };

      mockCartApi.getCart.mockResolvedValue(cartNoMetadata);

      await cartService.updateShippingInfo('cart-no-meta', { country: 'GB', zipCode: 'SW1A 1AA' });

      expect(mockCartApi.updateCart).toHaveBeenCalledWith('cart-no-meta', {
        metadata: { version: 1 },
        addresses: [{ country: 'GB', zipCode: 'SW1A 1AA', type: 'SHIPPING' }],
      });
    });

    it('should throw when cart not found', async () => {
      mockCartApi.getCart.mockResolvedValue(null);

      await expect(cartService.updateShippingInfo('missing-cart', { country: 'US', zipCode: '10001' })).rejects.toThrow(
        'Cart not found',
      );

      expect(mockCartApi.updateCart).not.toHaveBeenCalled();
    });

    it('should call refreshCart after successful update', async () => {
      const cart: EmporixCart = {
        id: 'cart-refresh',
        currency: 'EUR',
        siteCode: 'main',
        metadata: { version: 1 },
      };

      mockCartApi.getCart.mockResolvedValue(cart);

      await cartService.updateShippingInfo('cart-refresh', { country: 'FR', zipCode: '75001' });

      expect(mockCartApi.refreshCart).toHaveBeenCalledWith('cart-refresh');
      const updateOrder = mockCartApi.updateCart.mock.invocationCallOrder[0];
      const refreshOrder = mockCartApi.refreshCart.mock.invocationCallOrder[0];
      expect(refreshOrder).toBeGreaterThan(updateOrder);
    });

    it('should retry refreshCart after clearing orphaned legalEntityId', async () => {
      const cart: EmporixCart = {
        id: 'cart-123',
        currency: 'EUR',
        siteCode: 'main',
        metadata: { version: 1 },
      };
      const freshCart: EmporixCart = {
        id: 'cart-123',
        currency: 'EUR',
        siteCode: 'main',
        metadata: { version: 2 },
      };

      mockCartApi.getCart.mockResolvedValueOnce(cart).mockResolvedValueOnce(freshCart);

      mockCartApi.refreshCart
        .mockRejectedValueOnce(
          new Error(
            'Failed to refresh cart: Bad Request {"message":"Anonymous cart cannot be assigned to a legal entity: xyz"}',
          ),
        )
        .mockResolvedValueOnce(undefined);

      await cartService.updateShippingInfo('cart-123', { country: 'DE', zipCode: '10115' });

      expect(mockCartApi.updateCart).toHaveBeenCalledTimes(2);
      expect(mockCartApi.updateCart).toHaveBeenLastCalledWith('cart-123', {
        metadata: { version: 3 },
        legalEntityId: '',
      });
      expect(mockCartApi.refreshCart).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { cartId: 'cart-123' },
        expect.stringContaining('orphaned legalEntityId'),
      );
    });
  });

  describe('updateCurrency', () => {
    it('should change currency and refresh cart', async () => {
      const cart: EmporixCart = {
        id: 'cart-1',
        currency: 'USD',
        siteCode: 'main',
        metadata: { version: 1 },
      };

      mockCartApi.getCart.mockResolvedValue(cart);

      await cartService.updateCurrency('cart-1', 'EUR');

      expect(mockCartApi.changeCurrency).toHaveBeenCalledWith('cart-1', 'EUR');
      expect(mockCartApi.refreshCart).toHaveBeenCalledWith('cart-1');
      expect(mockCartApi.updateCart).not.toHaveBeenCalled();
    });

    it('should catch legalEntityId error on refreshCart, clear it, and retry', async () => {
      const cart: EmporixCart = {
        id: 'cart-1',
        currency: 'USD',
        siteCode: 'main',
        metadata: { version: 1 },
      };
      const freshCart: EmporixCart = {
        id: 'cart-1',
        currency: 'EUR',
        siteCode: 'main',
        metadata: { version: 2 }, // bumped by changeCurrency
      };

      mockCartApi.getCart
        .mockResolvedValueOnce(cart) // initial getCart in updateCurrency
        .mockResolvedValueOnce(freshCart); // re-fetch inside refreshCartWithCleanup

      mockCartApi.refreshCart
        .mockRejectedValueOnce(
          new Error(
            'Failed to refresh cart: Bad Request {"code":400,"message":"Anonymous cart cannot be assigned to a legal entity: abc123"}',
          ),
        )
        .mockResolvedValueOnce(undefined); // retry succeeds

      await cartService.updateCurrency('cart-1', 'EUR');

      expect(mockCartApi.changeCurrency).toHaveBeenCalledWith('cart-1', 'EUR');
      // refreshCart called twice: first attempt fails, retry succeeds
      expect(mockCartApi.refreshCart).toHaveBeenCalledTimes(2);
      // updateCart called to clear legalEntityId
      expect(mockCartApi.updateCart).toHaveBeenCalledWith('cart-1', {
        metadata: { version: 3 },
        legalEntityId: '',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { cartId: 'cart-1' },
        expect.stringContaining('orphaned legalEntityId'),
      );
    });

    it('should re-throw non-legalEntityId refresh errors', async () => {
      const cart: EmporixCart = {
        id: 'cart-1',
        currency: 'USD',
        siteCode: 'main',
        metadata: { version: 1 },
      };

      mockCartApi.getCart.mockResolvedValue(cart);
      mockCartApi.refreshCart.mockRejectedValue(new Error('Failed to refresh cart: Internal Server Error'));

      await expect(cartService.updateCurrency('cart-1', 'EUR')).rejects.toEqual(
        expect.objectContaining({
          code: 'UPSTREAM_FAILURE',
          message: 'Failed to update cart currency',
        }),
      );
      expect(mockCartApi.updateCart).not.toHaveBeenCalled();
    });

    it('should throw when currency is not supported by site', async () => {
      const cart: EmporixCart = {
        id: 'cart-1',
        currency: 'USD',
        siteCode: 'main',
      };

      mockCartApi.getCart.mockResolvedValue(cart);

      await expect(cartService.updateCurrency('cart-1', 'GBP')).rejects.toThrow('Currency not supported');

      expect(mockCartApi.changeCurrency).not.toHaveBeenCalled();
    });

    it('should throw typed currency update error for unsupported currency', async () => {
      const cart: EmporixCart = {
        id: 'cart-1',
        currency: 'USD',
        siteCode: 'main',
      };
      mockCartApi.getCart.mockResolvedValue(cart);

      await expect(cartService.updateCurrency('cart-1', 'GBP')).rejects.toBeInstanceOf(CartCurrencyUpdateError);
    });

    it('should throw when cart not found', async () => {
      mockCartApi.getCart.mockResolvedValue(null);
      mockSessionService.getCurrent.mockResolvedValue({
        id: 'session-1',
        siteCode: 'main',
        currency: 'EUR',
        customerId: undefined,
      });
      mockCartApi.getCartByCriteria.mockResolvedValue(null);

      await expect(cartService.updateCurrency('missing', 'EUR')).rejects.toThrow('Cart not found');
    });

    it('should recover with canonical cart when requested cart id is stale', async () => {
      const canonicalRawCart: EmporixCart = {
        id: 'cart-canonical',
        currency: 'USD',
        siteCode: 'main',
        metadata: { version: 1 },
      };
      const canonicalMappedCart: Cart = {
        id: 'cart-canonical',
        currency: 'USD',
        site: 'main',
        items: [],
        totalPrice: { amount: 0, originalAmount: 0, currency: 'USD' },
        subTotalPrice: { amount: 0, originalAmount: 0, currency: 'USD' },
        tax: { amount: 0, currency: 'USD', grossValue: 0, netValue: 0 },
      };

      mockSessionService.getCurrent.mockResolvedValue({
        id: 'session-1',
        siteCode: 'main',
        currency: 'EUR',
        customerId: 'customer-1',
      });
      mockCartApi.getCart
        .mockResolvedValueOnce(null) // stale requested cart
        .mockResolvedValueOnce(canonicalRawCart) // getCart() cache lookup by session.cartId (none) skipped; used later for canonical re-read
        .mockResolvedValueOnce(canonicalRawCart); // resolveCanonicalCartForCurrencyUpdate final read
      mockCartApi.getCartByCriteria.mockResolvedValue(canonicalRawCart);
      mockMapper.mapToService.mockReturnValue(canonicalMappedCart);

      await cartService.updateCurrency('stale-cart-id', 'EUR');

      expect(mockCartApi.changeCurrency).toHaveBeenCalledWith('cart-canonical', 'EUR');
      expect(mockLogger.info).toHaveBeenCalledWith(
        { requestedCartId: 'stale-cart-id', canonicalCartId: 'cart-canonical' },
        'Recovered stale cart id during currency update',
      );
    });

    it('should throw typed forbidden error when upstream returns 403 during currency change', async () => {
      const cart: EmporixCart = {
        id: 'cart-1',
        currency: 'USD',
        siteCode: 'main',
        metadata: { version: 1 },
      };

      mockCartApi.getCart.mockResolvedValue(cart);
      mockCartApi.changeCurrency.mockRejectedValue(
        new Error('Failed to change cart currency: Forbidden {"status":403,"message":"Access denied"}'),
      );

      await expect(cartService.updateCurrency('cart-1', 'EUR')).rejects.toEqual(
        expect.objectContaining({
          code: 'FORBIDDEN',
          upstreamStatus: 403,
        }),
      );
    });
  });

  describe('addItemToCart', () => {
    const mockSession = {
      id: 'session-1',
      siteCode: 'us-branch',
      currency: 'USD',
      language: 'en',
      customerId: undefined,
      cartId: 'cart-us',
    };

    const mockProduct = {
      id: 'prod-1',
      name: { en: 'Widget' },
      description: { en: 'A widget' },
      sku: 'WID-001',
      images: [{ url: 'https://img.example.com/widget.jpg' }],
    };

    const mockPrice: ProductPrice = {
      id: 'price-us-1',
      productId: 'prod-1',
      amount: 29.99,
      originalAmount: 29.99,
      currency: 'USD',
      discountValue: 0,
      discountPercentage: 0,
      totalValue: 29.99,
      quantity: { quantity: 1 },
      includesTax: false,
      tierValues: [],
    };

    const rawCart: EmporixCart = {
      id: 'cart-us',
      currency: 'USD',
      siteCode: 'us-branch',
      metadata: { version: 1 },
    };

    it('should use session-based pricing when cart site matches session site', async () => {
      mockCartApi.getCart.mockResolvedValue(rawCart);
      mockProductService.getProductById.mockResolvedValue(mockProduct);
      mockSessionService.getCurrent.mockResolvedValue(mockSession);
      mockPriceService.getProductPrice.mockResolvedValue(mockPrice);

      // Mock getCartById (used after adding item) — it calls getCart internally
      const mappedCart: Cart = {
        id: 'cart-us',
        currency: 'USD',
        site: 'us-branch',
        items: [
          {
            id: 'new-item-id',
            quantity: 1,
            price: { amount: 29.99, originalAmount: 29.99, currency: 'USD' },
            product: { id: 'prod-1' },
          },
        ],
        totalPrice: { amount: 29.99, originalAmount: 29.99, currency: 'USD' },
        subTotalPrice: { amount: 29.99, originalAmount: 29.99, currency: 'USD' },
        tax: { amount: 0, currency: 'USD', grossValue: 29.99, netValue: 29.99 },
      };

      // First getCart call returns raw cart (for siteCode), second returns for getCartById
      mockCartApi.getCart.mockResolvedValueOnce(rawCart).mockResolvedValueOnce(rawCart);
      mockMapper.mapToService.mockReturnValue(mappedCart);

      const result = await cartService.addItemToCart('cart-us', 'prod-1', 1);

      // When cart site matches session site, use session-based pricing (no explicit siteCode)
      expect(mockPriceService.getProductPrice).toHaveBeenCalledWith('prod-1', 1);

      // Verify the addItemRequest uses cart's siteCode
      expect(mockCartApi.addItemToCart).toHaveBeenCalledWith(
        'cart-us',
        expect.objectContaining({
          siteCode: 'us-branch',
        }),
      );

      expect(result.cartItem.id).toBe('new-item-id');
      expect(result.status).toBe('OK');
    });

    it('should auto-recover when cart site differs from session site', async () => {
      // Cart is on 'main' but session says 'us-branch' (race condition scenario)
      const mainCart: EmporixCart = {
        id: 'cart-main',
        currency: 'EUR',
        siteCode: 'main',
        metadata: { version: 1 },
      };

      const sessionWithDifferentSite = {
        ...mockSession,
        siteCode: 'us-branch',
        cartId: 'cart-main', // stale cartId
      };

      // The correct us-branch cart found by getCart() auto-recovery
      const usBranchCart: EmporixCart = {
        id: 'cart-us-recovered',
        currency: 'USD',
        siteCode: 'us-branch',
        metadata: { version: 1 },
      };

      const mappedUsCart: Cart = {
        id: 'cart-us-recovered',
        currency: 'USD',
        site: 'us-branch',
        items: [
          {
            id: 'new-item-id',
            quantity: 1,
            price: { amount: 29.99, originalAmount: 29.99, currency: 'USD' },
            product: { id: 'prod-1' },
          },
        ],
        totalPrice: { amount: 29.99, originalAmount: 29.99, currency: 'USD' },
        subTotalPrice: { amount: 29.99, originalAmount: 29.99, currency: 'USD' },
        tax: { amount: 0, currency: 'USD', grossValue: 29.99, netValue: 29.99 },
      };

      // First call: addItemToCart('cart-main') → getCart returns mainCart (wrong site)
      // getCart() auto-recovery: getCurrent → getCart(cart-main) → site mismatch → getCartByCriteria → usBranchCart
      // Retry addItemToCart('cart-us-recovered') → getCart returns usBranchCart (correct)
      mockCartApi.getCart
        .mockResolvedValueOnce(mainCart) // 1st addItemToCart call: rawCart
        .mockResolvedValueOnce(mainCart) // getCart() during auto-recovery: fetchByCartId
        .mockResolvedValueOnce(usBranchCart) // 2nd addItemToCart call (retry): rawCart
        .mockResolvedValueOnce(usBranchCart); // getCartById after adding item
      mockCartApi.getCartByCriteria.mockResolvedValue(usBranchCart);
      mockProductService.getProductById.mockResolvedValue(mockProduct);
      mockSessionService.getCurrent.mockResolvedValue(sessionWithDifferentSite);
      mockPriceService.getProductPrice.mockResolvedValue(mockPrice);
      mockMapper.mapToService.mockReturnValue(mappedUsCart);

      const result = await cartService.addItemToCart('cart-main', 'prod-1', 1);

      // Should have logged the auto-recovery
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { cartId: 'cart-main', cartSite: 'main', sessionSite: 'us-branch' },
        'Cart belongs to different site — auto-recovering correct cart',
      );

      // Price should be fetched with session-based pricing (no explicit params)
      expect(mockPriceService.getProductPrice).toHaveBeenCalledWith('prod-1', 1);

      // Should have added item to the recovered cart, not the original
      expect(mockCartApi.addItemToCart).toHaveBeenCalledWith(
        'cart-us-recovered',
        expect.objectContaining({
          siteCode: 'us-branch',
        }),
      );

      expect(result.cartItem.id).toBe('new-item-id');
    });

    it('should throw when auto-recovery returns the same cart (infinite loop prevention)', async () => {
      const mainCart: EmporixCart = {
        id: 'cart-stuck',
        currency: 'EUR',
        siteCode: 'main',
        metadata: { version: 1 },
      };

      const sessionMismatch = {
        ...mockSession,
        siteCode: 'us-branch',
        cartId: 'cart-stuck',
      };

      const mappedStuckCart: Cart = {
        id: 'cart-stuck',
        currency: 'EUR',
        site: 'main',
        items: [],
        totalPrice: { amount: 0, originalAmount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, originalAmount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', grossValue: 0, netValue: 0 },
      };

      // getCart() auto-recovery returns the same cart (shouldn't happen, but guard against it)
      mockCartApi.getCart.mockResolvedValue(mainCart);
      mockCartApi.getCartByCriteria.mockResolvedValue(mainCart);
      mockProductService.getProductById.mockResolvedValue(mockProduct);
      mockSessionService.getCurrent.mockResolvedValue(sessionMismatch);
      mockMapper.mapToService.mockReturnValue(mappedStuckCart);

      await expect(cartService.addItemToCart('cart-stuck', 'prod-1', 1)).rejects.toThrow(
        'Cart site mismatch cannot be resolved',
      );
    });

    it('should throw when cart not found', async () => {
      mockCartApi.getCart.mockResolvedValue(null);
      mockProductService.getProductById.mockResolvedValue(mockProduct);
      mockSessionService.getCurrent.mockResolvedValue(mockSession);

      await expect(cartService.addItemToCart('missing-cart', 'prod-1', 1)).rejects.toThrow('Cart not found');

      expect(mockPriceService.getProductPrice).not.toHaveBeenCalled();
    });

    it('should throw when product not found', async () => {
      mockCartApi.getCart.mockResolvedValue(rawCart);
      mockProductService.getProductById.mockResolvedValue(null);
      mockSessionService.getCurrent.mockResolvedValue(mockSession);

      await expect(cartService.addItemToCart('cart-us', 'missing-prod', 1)).rejects.toThrow('Product missing');

      expect(mockPriceService.getProductPrice).not.toHaveBeenCalled();
    });
  });

  describe('updateCartItemQuantity', () => {
    it('should use session-based pricing when cart site matches session', async () => {
      const mappedCart: Cart = {
        id: 'cart-us',
        currency: 'USD',
        site: 'us-branch',
        items: [
          {
            id: 'item-1',
            quantity: 2,
            price: { amount: 29.99, originalAmount: 29.99, currency: 'USD' },
            product: { id: 'prod-1' },
          },
        ],
        totalPrice: { amount: 59.98, originalAmount: 59.98, currency: 'USD' },
        subTotalPrice: { amount: 59.98, originalAmount: 59.98, currency: 'USD' },
        tax: { amount: 0, currency: 'USD', grossValue: 59.98, netValue: 59.98 },
      };

      const rawCart: EmporixCart = {
        id: 'cart-us',
        currency: 'USD',
        siteCode: 'us-branch',
        items: [
          {
            id: 'item-1',
            itemYrn: 'yrn:product:prod-1',
            quantity: 2,
            product: { id: 'prod-1', name: 'Widget' },
            price: { effectiveAmount: 29.99, originalAmount: 29.99, currency: 'USD' },
          },
        ] as unknown as EmporixCart['items'],
      };

      const updatedPrice: ProductPrice = {
        id: 'price-us-1',
        productId: 'prod-1',
        amount: 24.99,
        originalAmount: 29.99,
        currency: 'USD',
        discountValue: 5,
        discountPercentage: 16.7,
        totalValue: 74.97,
        quantity: { quantity: 3 },
        includesTax: false,
        tierValues: [],
      };

      // getCartById calls getCart internally
      mockCartApi.getCart.mockResolvedValue(rawCart);
      mockMapper.mapToService.mockReturnValue(mappedCart);
      // updateCartItemQuantity also fetches session to decide pricing strategy
      mockSessionService.getCurrent.mockResolvedValue({ id: 'session-1', siteCode: 'us-branch', currency: 'USD' });
      mockPriceService.getProductPrice.mockResolvedValue(updatedPrice);

      const result = await cartService.updateCartItemQuantity('cart-us', 'item-1', 3);

      // When session site matches cart site, use session-based matching (no explicit params)
      expect(mockPriceService.getProductPrice).toHaveBeenCalledWith('prod-1', 3);

      expect(result.cartItem.quantity).toBe(3);
      expect(result.status).toBe('OK');
    });

    it('should throw when cart site differs from session site', async () => {
      const mappedCart: Cart = {
        id: 'cart-us',
        currency: 'USD',
        site: 'us-branch',
        items: [
          {
            id: 'item-1',
            quantity: 2,
            price: { amount: 29.99, originalAmount: 29.99, currency: 'USD' },
            product: { id: 'prod-1' },
          },
        ],
        totalPrice: { amount: 59.98, originalAmount: 59.98, currency: 'USD' },
        subTotalPrice: { amount: 59.98, originalAmount: 59.98, currency: 'USD' },
        tax: { amount: 0, currency: 'USD', grossValue: 59.98, netValue: 59.98 },
      };

      const rawCart: EmporixCart = {
        id: 'cart-us',
        currency: 'USD',
        siteCode: 'us-branch',
        items: [
          {
            id: 'item-1',
            itemYrn: 'yrn:product:prod-1',
            quantity: 2,
            product: { id: 'prod-1', name: 'Widget' },
            price: { effectiveAmount: 29.99, originalAmount: 29.99, currency: 'USD' },
          },
        ] as unknown as EmporixCart['items'],
      };

      mockCartApi.getCart.mockResolvedValue(rawCart);
      mockMapper.mapToService.mockReturnValue(mappedCart);
      // Session is on 'main' but cart is on 'us-branch'
      mockSessionService.getCurrent.mockResolvedValue({ id: 'session-1', siteCode: 'main', currency: 'EUR' });

      await expect(cartService.updateCartItemQuantity('cart-us', 'item-1', 3)).rejects.toThrow(
        'Cart belongs to a different site. Please refresh the page.',
      );

      // Should NOT have called price service
      expect(mockPriceService.getProductPrice).not.toHaveBeenCalled();
      // Should have logged the warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { cartId: 'cart-us', cartSite: 'us-branch', sessionSite: 'main' },
        'Cart belongs to different site during quantity update — aborting',
      );
    });
  });

  describe('getCart', () => {
    const mockSession = {
      id: 'session-1',
      siteCode: 'main',
      currency: 'EUR',
      customerId: undefined,
      cartId: 'cart-main',
    };

    it('should return cart when siteCode matches session', async () => {
      const rawCart: EmporixCart = {
        id: 'cart-main',
        currency: 'EUR',
        siteCode: 'main',
        metadata: { version: 1 },
      };

      const mappedCart: Cart = {
        id: 'cart-main',
        currency: 'EUR',
        site: 'main',
        items: [],
        totalPrice: { amount: 0, originalAmount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, originalAmount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', grossValue: 0, netValue: 0 },
      };

      mockSessionService.getCurrent.mockResolvedValue(mockSession);
      mockCartApi.getCart.mockResolvedValue(rawCart);
      mockMapper.mapToService.mockReturnValue(mappedCart);

      const result = await cartService.getCart();

      expect(result).toBe(mappedCart);
      expect(mockCartApi.getCartByCriteria).not.toHaveBeenCalled();
    });

    it('should skip cart when siteCode differs from session and search by criteria', async () => {
      // Session says 'us-branch' but cached cart is from 'main'
      const usSession = {
        ...mockSession,
        siteCode: 'us-branch',
        cartId: 'cart-main', // stale cartId from previous site
      };

      const mainCart: EmporixCart = {
        id: 'cart-main',
        currency: 'EUR',
        siteCode: 'main',
      };

      const usBranchCart: EmporixCart = {
        id: 'cart-us',
        currency: 'USD',
        siteCode: 'us-branch',
      };

      const mappedUsCart: Cart = {
        id: 'cart-us',
        currency: 'USD',
        site: 'us-branch',
        items: [],
        totalPrice: { amount: 0, originalAmount: 0, currency: 'USD' },
        subTotalPrice: { amount: 0, originalAmount: 0, currency: 'USD' },
        tax: { amount: 0, currency: 'USD', grossValue: 0, netValue: 0 },
      };

      mockSessionService.getCurrent.mockResolvedValue(usSession);
      mockCartApi.getCart.mockResolvedValue(mainCart); // cached cart is from wrong site
      mockCartApi.getCartByCriteria.mockResolvedValue(usBranchCart);
      mockMapper.mapToService.mockReturnValue(mappedUsCart);

      const result = await cartService.getCart();

      // Should have logged the site mismatch
      expect(mockLogger.info).toHaveBeenCalledWith(
        { cartId: 'cart-main', cartSite: 'main', currentSite: 'us-branch' },
        'Skipping cart from different site — searching for current site cart',
      );

      // Should have fallen through to getCartByCriteria
      expect(mockCartApi.getCartByCriteria).toHaveBeenCalledWith(
        'us-branch',
        'session-1',
        undefined,
        'shopping',
        false,
      );

      // Should have updated session with new cart ID
      expect(mockSessionService.setCart).toHaveBeenCalledWith('cart-us');

      expect(result).toBe(mappedUsCart);
    });

    it('should throw when session is not available', async () => {
      mockSessionService.getCurrent.mockResolvedValue(undefined);

      await expect(cartService.getCart()).rejects.toThrow('Failed to get session context');
    });

    it('should use session-based lookup (not customerId) when customerId is ANONYMOUS', async () => {
      const anonSession = {
        id: 'session-anon',
        siteCode: 'us-branch',
        customerId: 'ANONYMOUS',
        cartId: undefined,
        currency: 'USD',
      };
      const anonRawCart: EmporixCart = {
        id: 'anon-cart-1',
        currency: 'USD',
        siteCode: 'us-branch',
      };
      const anonMappedCart: Cart = {
        id: 'anon-cart-1',
        currency: 'USD',
        site: 'us-branch',
        items: [],
        totalPrice: { amount: 0, originalAmount: 0, currency: 'USD' },
        subTotalPrice: { amount: 0, originalAmount: 0, currency: 'USD' },
        tax: { amount: 0, currency: 'USD', grossValue: 0, netValue: 0 },
      };

      mockSessionService.getCurrent.mockResolvedValue(anonSession);
      mockCartApi.getCartByCriteria.mockResolvedValue(anonRawCart);
      mockMapper.mapToService.mockReturnValue(anonMappedCart);

      const result = await cartService.getCart();

      expect(mockCartApi.getCartByCriteria).toHaveBeenCalledWith(
        'us-branch',
        'session-anon',
        undefined,
        'shopping',
        false,
      );
      expect(mockCartApi.getCartByCriteria).not.toHaveBeenCalledWith(
        expect.anything(),
        undefined,
        'ANONYMOUS',
        expect.anything(),
        expect.anything(),
      );
      expect(mockSessionService.setCart).toHaveBeenCalledWith('anon-cart-1');
      expect(result).toBe(anonMappedCart);
    });

    it('should prefer customer cart lookup first for authenticated sessions', async () => {
      const authSession = {
        id: 'session-auth',
        siteCode: 'main',
        currency: 'EUR',
        customerId: 'customer-42',
        cartId: undefined,
      };
      const customerRawCart: EmporixCart = {
        id: 'customer-cart-42',
        currency: 'EUR',
        siteCode: 'main',
      };
      const customerMappedCart: Cart = {
        id: 'customer-cart-42',
        currency: 'EUR',
        site: 'main',
        items: [],
        totalPrice: { amount: 0, originalAmount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, originalAmount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', grossValue: 0, netValue: 0 },
      };

      mockSessionService.getCurrent.mockResolvedValue(authSession);
      mockCartApi.getCartByCriteria.mockResolvedValue(customerRawCart);
      mockMapper.mapToService.mockReturnValue(customerMappedCart);

      const result = await cartService.getCart();

      expect(mockCartApi.getCartByCriteria).toHaveBeenCalledWith('main', undefined, 'customer-42', 'shopping', false);
      expect(mockSessionService.setCart).toHaveBeenCalledWith('customer-cart-42');
      expect(result).toBe(customerMappedCart);
    });
  });
});
