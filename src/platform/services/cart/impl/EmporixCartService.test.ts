import { Container } from 'inversify';
import 'reflect-metadata';
import type { EmporixCartApi } from '@/platform/integrations/emporix/cart/EmporixCartApi';
import type EmporixCommonUtil from '@/platform/integrations/emporix/common/util/EmporixCommonUtil';
import type { EmporixCouponApi } from '@/platform/integrations/emporix/coupon/EmporixCouponApi';
import type { EmporixCustomerApi } from '@/platform/integrations/emporix/customer/EmporixCustomerApi';
import type { EmporixCart } from '@/platform/integrations/emporix/model/cart';
import {
  CART_DISCOUNT_REASON,
  CART_SITE_MISMATCH_MESSAGE,
  CartCurrencyUpdateError,
  CartDiscountError,
} from '@/platform/services/cart/errors';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CartMapper } from '@/platform/services/model/cart/CartMapper';
import type { Cart } from '@/platform/services/model/cart/cart';
import type { ProductPrice } from '@/platform/services/model/price';
import type { PriceService } from '@/platform/services/price/PriceService';
import type { ProductService } from '@/platform/services/product/ProductService';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { ShippingService } from '@/platform/services/shipping/ShippingService';
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
      | 'changeSite'
      | 'addItemToCart'
      | 'getCartByCriteria'
      | 'updateCartItemQuantity'
      | 'createCart'
      | 'applyDiscount'
      | 'removeDiscount'
    >
  >;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockSessionService: jest.Mocked<
    Pick<SessionService, 'getCurrent' | 'getCurrentOrThrow' | 'setCart' | 'clearCart'>
  >;
  let mockSiteService: jest.Mocked<Pick<SiteService, 'getSite' | 'invalidateSiteCache'>>;
  let mockPriceService: jest.Mocked<Pick<PriceService, 'getProductPrice'>>;
  let mockProductService: jest.Mocked<Pick<ProductService, 'getProductById'>>;
  let mockStockService: jest.Mocked<Pick<StockService, 'getStockAvailability'>>;
  let mockCommonUtil: jest.Mocked<Pick<EmporixCommonUtil, 'generateProductYrn'>>;
  let mockMapper: jest.Mocked<Pick<CartMapper<EmporixCart, unknown>, 'mapToService'>>;
  let mockShippingService: jest.Mocked<Pick<ShippingService, 'getDeliveryWindowsForCart'>>;
  let mockCouponApi: jest.Mocked<EmporixCouponApi>;
  let mockCustomerApi: jest.Mocked<Pick<EmporixCustomerApi, 'getCustomerProfile'>>;

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
      changeSite: jest.fn().mockResolvedValue(undefined),
      addItemToCart: jest.fn().mockResolvedValue('new-item-id'),
      getCartByCriteria: jest.fn().mockResolvedValue(null),
      updateCartItemQuantity: jest.fn().mockResolvedValue(undefined),
      createCart: jest.fn().mockResolvedValue('new-cart-id'),
      applyDiscount: jest.fn().mockResolvedValue(undefined),
      removeDiscount: jest.fn().mockResolvedValue(undefined),
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
      getCurrentOrThrow: jest.fn().mockImplementation(() => mockSessionService.getCurrent()),
      setCart: jest.fn().mockResolvedValue(undefined),
      clearCart: jest.fn().mockResolvedValue(undefined),
    };

    mockSiteService = {
      getSite: jest.fn().mockResolvedValue(mainSite),
      invalidateSiteCache: jest.fn(),
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

    mockShippingService = {
      getDeliveryWindowsForCart: jest.fn().mockResolvedValue([]),
    };

    mockCouponApi = {
      validateCoupon: jest.fn().mockResolvedValue({ ok: true }),
    };

    mockCustomerApi = {
      getCustomerProfile: jest.fn().mockRejectedValue(new Error('profile not requested')),
    };

    container.bind('EmporixCouponApi').toConstantValue(mockCouponApi);
    container.bind('EmporixCustomerApi').toConstantValue(mockCustomerApi);
    container.bind('EmporixCommonUtil').toConstantValue(mockCommonUtil);
    container.bind('EmporixCartApi').toConstantValue(mockCartApi);
    container.bind('EmporixCartMapper').toConstantValue(mockMapper);
    container.bind('SessionService').toConstantValue(mockSessionService);
    container.bind('PriceService').toConstantValue(mockPriceService);
    container.bind('ProductService').toConstantValue(mockProductService);
    container.bind('StockService').toConstantValue(mockStockService);
    container.bind('LoggerService').toConstantValue(mockLogger);
    container.bind('SiteService').toConstantValue(mockSiteService);
    container.bind('ShippingService').toConstantValue(mockShippingService);
    container.bind<EmporixCartService>('CartService').to(EmporixCartService);

    cartService = container.get<EmporixCartService>('CartService');
  });

  describe('updateShippingInfo', () => {
    it('should replace addresses with REQUEST-origin SHIPPING and BILLING from ship-to', async () => {
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
        countryCode: 'DE',
        zipCode: '10115',
        addresses: [{ country: 'DE', zipCode: '10115', type: 'BILLING' }],
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
        countryCode: 'US',
        zipCode: '10001',
        addresses: [
          { country: 'US', zipCode: '10001', type: 'SHIPPING', origin: 'REQUEST' },
          { country: 'US', zipCode: '10001', type: 'BILLING', origin: 'REQUEST' },
        ],
      });

      const updatePayload = mockCartApi.updateCart.mock.calls[0][1];
      expect(updatePayload.addresses).toHaveLength(2);
      expect(updatePayload.addresses?.map((address: { type: string }) => address.type)).toEqual([
        'SHIPPING',
        'BILLING',
      ]);
      expect(updatePayload.addresses?.every((address: { origin?: string }) => address.origin === 'REQUEST')).toBe(true);
      expect(updatePayload.countryCode).toBe('US');
      expect(updatePayload.zipCode).toBe('10001');
      expect(updatePayload.addresses).not.toEqual(expect.arrayContaining([expect.objectContaining({ country: 'DE' })]));
      expect(updatePayload).not.toHaveProperty('id');
      expect(updatePayload).not.toHaveProperty('yrn');
      expect(updatePayload).not.toHaveProperty('customerId');
      expect(updatePayload).not.toHaveProperty('sessionId');
      expect(updatePayload).not.toHaveProperty('legalEntityId');
      expect(updatePayload).not.toHaveProperty('status');
      expect(updatePayload).not.toHaveProperty('items');
      expect(updatePayload).not.toHaveProperty('currency');
      expect(updatePayload).not.toHaveProperty('siteCode');
    });

    it('should ignore optional billingAddress so DE billing cannot win BILLING country', async () => {
      const cart: EmporixCart = {
        id: 'cart-both',
        currency: 'EUR',
        siteCode: 'main',
        metadata: { version: 1 },
      };

      mockCartApi.getCart.mockResolvedValue(cart);

      await cartService.updateShippingInfo(
        'cart-both',
        { country: 'CH', zipCode: '6300', city: 'Zug', street: 'Bahnhofstrasse' },
        { country: 'DE', zipCode: '10115', city: 'Berlin', street: 'Friedrichstr.' },
      );

      expect(mockCartApi.updateCart).toHaveBeenCalledWith('cart-both', {
        metadata: { version: 2 },
        countryCode: 'CH',
        zipCode: '6300',
        addresses: [
          {
            country: 'CH',
            zipCode: '6300',
            city: 'Zug',
            street: 'Bahnhofstrasse',
            type: 'SHIPPING',
            origin: 'REQUEST',
          },
          { country: 'CH', zipCode: '6300', city: 'Zug', street: 'Bahnhofstrasse', type: 'BILLING', origin: 'REQUEST' },
        ],
      });

      const updatePayload = mockCartApi.updateCart.mock.calls[0][1];
      const billingAddress = updatePayload.addresses?.find((address: { type: string }) => address.type === 'BILLING');
      expect(billingAddress).toEqual(expect.objectContaining({ country: 'CH', zipCode: '6300', origin: 'REQUEST' }));
      expect(billingAddress?.country).not.toBe('DE');
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
        countryCode: 'GB',
        zipCode: 'SW1A 1AA',
        addresses: [
          { country: 'GB', zipCode: 'SW1A 1AA', type: 'SHIPPING', origin: 'REQUEST' },
          { country: 'GB', zipCode: 'SW1A 1AA', type: 'BILLING', origin: 'REQUEST' },
        ],
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

    it('should retry refreshCart when Emporix returns optimistic lock conflict', async () => {
      jest.useFakeTimers();
      const cart: EmporixCart = {
        id: 'cart-ol',
        currency: 'EUR',
        siteCode: 'main',
        metadata: { version: 10 },
      };
      mockCartApi.getCart.mockResolvedValue(cart);

      const conflict = new Error('Failed to refresh cart: Conflict {"message":"optimistic_locking: metadata.version"}');
      mockCartApi.refreshCart.mockRejectedValueOnce(conflict).mockResolvedValueOnce(undefined);

      const done = cartService.updateShippingInfo('cart-ol', { country: 'DE', zipCode: '10115' });
      await jest.runAllTimersAsync();
      await done;

      expect(mockCartApi.refreshCart).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { cartId: 'cart-ol', attempt: 0 },
        'Cart refresh hit optimistic lock — retrying',
      );
      jest.useRealTimers();
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

  describe('updateShippingMethod', () => {
    const mappedCart: Cart = {
      id: 'cart-ship',
      currency: 'EUR',
      site: 'main',
      items: [],
      totalPrice: { amount: 120, currency: 'EUR' },
      subTotalPrice: { amount: 100, currency: 'EUR' },
      tax: { amount: 19, currency: 'EUR', netValue: 81, grossValue: 100 },
    };

    const method = { methodId: 'dhl-standard', zoneId: 'zone-de', methodName: 'DHL Standard' };

    it('assigns a matching delivery window and refreshes the cart', async () => {
      const cart: EmporixCart = {
        id: 'cart-ship',
        currency: 'EUR',
        siteCode: 'main',
        countryCode: 'DE',
        zipCode: '10115',
        metadata: { version: 3 },
      };
      mockCartApi.getCart.mockResolvedValue(cart);
      mockShippingService.getDeliveryWindowsForCart.mockResolvedValue([
        {
          id: 'window-1',
          slotId: 'slot-1',
          deliveryDate: '2026-09-02T10:00:00.000Z',
          zoneId: 'zone-de',
          deliveryMethod: 'DHL Standard',
        },
      ]);
      mockMapper.mapToService.mockReturnValue(mappedCart);

      const result = await cartService.updateShippingMethod('cart-ship', method);

      expect(mockCartApi.updateCart).toHaveBeenCalledWith('cart-ship', {
        metadata: { version: 4 },
        countryCode: 'DE',
        zipCode: '10115',
        deliveryWindowId: 'window-1',
        deliveryWindow: {
          id: 'window-1',
          slotId: 'slot-1',
          deliveryDate: '2026-09-02T10:00:00.000Z',
        },
      });
      expect(mockCartApi.refreshCart).toHaveBeenCalledWith('cart-ship');
      expect(result).toEqual(mappedCart);
    });

    it('does not update the cart when no delivery window matches', async () => {
      const cart: EmporixCart = {
        id: 'cart-ship',
        currency: 'EUR',
        siteCode: 'main',
        countryCode: 'DE',
        zipCode: '10115',
        metadata: { version: 3 },
      };
      mockCartApi.getCart.mockResolvedValue(cart);
      mockShippingService.getDeliveryWindowsForCart.mockResolvedValue([]);
      mockMapper.mapToService.mockReturnValue(mappedCart);

      const result = await cartService.updateShippingMethod('cart-ship', method);

      expect(mockCartApi.updateCart).not.toHaveBeenCalled();
      expect(mockCartApi.refreshCart).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ cartId: 'cart-ship', methodId: 'dhl-standard' }),
        expect.stringContaining('No delivery window matches'),
      );
      expect(result).toEqual(mappedCart);
    });

    it('throws when the cart is missing', async () => {
      mockCartApi.getCart.mockResolvedValue(null);

      await expect(cartService.updateShippingMethod('missing', method)).rejects.toThrow('Cart not found');
      expect(mockCartApi.updateCart).not.toHaveBeenCalled();
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

    it('classifies a 400 with coupon language as COUPON_CURRENCY_CONFLICT', async () => {
      const cart: EmporixCart = {
        id: 'cart-1',
        currency: 'USD',
        siteCode: 'main',
        metadata: { version: 1 },
      };

      mockCartApi.getCart.mockResolvedValue(cart);
      mockCartApi.changeCurrency.mockRejectedValue(
        new Error(
          'Failed to change cart currency: Bad Request {"code":400,"message":"Discount currency does not match"}',
        ),
      );

      await expect(cartService.updateCurrency('cart-1', 'EUR')).rejects.toEqual(
        expect.objectContaining({
          code: 'COUPON_CURRENCY_CONFLICT',
          upstreamStatus: 400,
        }),
      );
    });

    it('keeps a 400 price miss with a discount:null field as CONTEXT_MISMATCH', async () => {
      const cart: EmporixCart = {
        id: 'cart-1',
        currency: 'USD',
        siteCode: 'main',
        metadata: { version: 1 },
      };

      mockCartApi.getCart.mockResolvedValue(cart);
      mockCartApi.changeCurrency.mockRejectedValue(
        new Error(
          'Failed to change cart currency: Bad Request {"code":400,"message":"Price not found","discount":null}',
        ),
      );

      await expect(cartService.updateCurrency('cart-1', 'EUR')).rejects.toEqual(
        expect.objectContaining({
          code: 'CONTEXT_MISMATCH',
          upstreamStatus: 400,
        }),
      );
    });

    it('keeps a 400 item/price miss as CONTEXT_MISMATCH', async () => {
      const cart: EmporixCart = {
        id: 'cart-1',
        currency: 'USD',
        siteCode: 'main',
        metadata: { version: 1 },
      };

      mockCartApi.getCart.mockResolvedValue(cart);
      mockCartApi.changeCurrency.mockRejectedValue(
        new Error('Failed to change cart currency: Bad Request {"code":400,"message":"Price not found for item"}'),
      );

      await expect(cartService.updateCurrency('cart-1', 'EUR')).rejects.toEqual(
        expect.objectContaining({
          code: 'CONTEXT_MISMATCH',
          upstreamStatus: 400,
        }),
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

  describe('applyDiscount', () => {
    const rawCart: EmporixCart = {
      id: 'cart-1',
      currency: 'EUR',
      siteCode: 'main',
      metadata: { version: 1 },
    };

    const mappedCartWithDiscount: Cart = {
      id: 'cart-1',
      currency: 'EUR',
      site: 'main',
      items: [],
      totalPrice: { amount: 90, originalAmount: 100, currency: 'EUR' },
      subTotalPrice: { amount: 90, originalAmount: 100, currency: 'EUR' },
      tax: { amount: 19, currency: 'EUR', netValue: 81, grossValue: 100 },
      discounts: [{ code: 'LS10PTOTAL', discountIndex: 0, amount: 10, currency: 'EUR' }],
      savingsTotal: 10,
    };

    beforeEach(() => {
      mockSessionService.getCurrent.mockResolvedValue({
        id: 'session-1',
        siteCode: 'main',
        currency: 'EUR',
      });
    });

    it('applies a trimmed code and returns the mapped cart', async () => {
      mockCartApi.getCart.mockResolvedValue(rawCart);
      mockMapper.mapToService.mockReturnValue(mappedCartWithDiscount);

      const result = await cartService.applyDiscount('cart-1', '  LS10PTOTAL  ');

      expect(mockCartApi.applyDiscount).toHaveBeenCalledWith('cart-1', 'LS10PTOTAL');
      expect(mockCartApi.applyDiscount).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mappedCartWithDiscount);
      expect(mockCartApi.refreshCart).not.toHaveBeenCalled();
    });

    it('refuses a cart from another site instead of applying the code in the wrong site context', async () => {
      mockSessionService.getCurrent.mockResolvedValue({
        id: 'session-1',
        customerId: 'cust-1',
        currency: 'EUR',
        siteCode: 'other-site',
        cartId: 'cart-1',
      });
      mockCartApi.getCart.mockResolvedValue(rawCart);
      mockMapper.mapToService.mockReturnValue(mappedCartWithDiscount);

      await expect(cartService.applyDiscount('cart-1', 'LS10PTOTAL')).rejects.toEqual(
        expect.objectContaining({ name: 'CartDiscountError', message: CART_SITE_MISMATCH_MESSAGE }),
      );
      expect(mockCartApi.applyDiscount).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { cartId: 'cart-1', cartSite: 'main', sessionSite: 'other-site' },
        'Cart belongs to different site during discount write — aborting',
      );
    });

    it('refuses a discount write when the session lookup is missing', async () => {
      mockSessionService.getCurrent.mockResolvedValue(null);
      mockCartApi.getCart.mockResolvedValue(rawCart);
      mockMapper.mapToService.mockReturnValue(mappedCartWithDiscount);

      await expect(cartService.applyDiscount('cart-1', 'LS10PTOTAL')).rejects.toEqual(
        expect.objectContaining({
          name: 'CartDiscountError',
          message: 'Failed to get session context',
          upstreamStatus: 401,
        }),
      );
      expect(mockCartApi.applyDiscount).not.toHaveBeenCalled();
    });

    it('maps a 403 from the session cart guard to CartDiscountError before applying', async () => {
      mockCartApi.getCart.mockRejectedValue(
        new Error('Failed to get cart: Forbidden {"status":403,"message":"Access denied"}'),
      );

      await expect(cartService.applyDiscount('cart-1', 'LS10PTOTAL')).rejects.toEqual(
        expect.objectContaining({
          name: 'CartDiscountError',
          message: 'Failed to resolve cart for discount write',
          upstreamStatus: 403,
        }),
      );
      expect(mockCartApi.applyDiscount).not.toHaveBeenCalled();
    });

    it('rejects an empty code without calling the API', async () => {
      await expect(cartService.applyDiscount('cart-1', '')).rejects.toBeInstanceOf(CartDiscountError);
      await expect(cartService.applyDiscount('cart-1', '   ')).rejects.toBeInstanceOf(CartDiscountError);

      expect(mockCartApi.applyDiscount).not.toHaveBeenCalled();
      expect(mockCartApi.getCart).not.toHaveBeenCalled();
    });

    it('refreshes once when apply succeeds with zero savings and no coupon rows', async () => {
      const mappedFreeShippingWithoutRows: Cart = {
        id: 'cart-1',
        currency: 'EUR',
        site: 'main',
        items: [],
        totalPrice: { amount: 100, originalAmount: 100, currency: 'EUR' },
        subTotalPrice: { amount: 100, originalAmount: 100, currency: 'EUR' },
        tax: { amount: 19, currency: 'EUR', netValue: 81, grossValue: 100 },
        savingsTotal: 0,
      };
      const mappedFreeShipping: Cart = {
        ...mappedCartWithDiscount,
        discounts: [{ code: 'FREESHIP', discountIndex: 0, amount: 0, currency: 'EUR', type: 'FREE_SHIPPING' }],
        savingsTotal: 0,
      };
      mockCartApi.getCart.mockResolvedValue(rawCart);
      mockMapper.mapToService
        .mockReturnValueOnce(mappedFreeShippingWithoutRows)
        .mockReturnValueOnce(mappedFreeShippingWithoutRows)
        .mockReturnValueOnce(mappedFreeShipping);

      const result = await cartService.applyDiscount('cart-1', 'FREESHIP');

      expect(mockCartApi.refreshCart).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mappedFreeShipping);
    });

    it('refreshes once via cleanup when apply succeeds but discounts and savings are missing', async () => {
      const mappedWithoutSavings: Cart = {
        id: 'cart-1',
        currency: 'EUR',
        site: 'main',
        items: [],
        totalPrice: { amount: 100, originalAmount: 100, currency: 'EUR' },
        subTotalPrice: { amount: 100, originalAmount: 100, currency: 'EUR' },
        tax: { amount: 19, currency: 'EUR', netValue: 81, grossValue: 100 },
      };
      mockCartApi.getCart.mockResolvedValue(rawCart);
      mockMapper.mapToService
        .mockReturnValueOnce(mappedWithoutSavings)
        .mockReturnValueOnce(mappedWithoutSavings)
        .mockReturnValueOnce(mappedCartWithDiscount);

      const result = await cartService.applyDiscount('cart-1', 'LS10PTOTAL');

      expect(mockCartApi.refreshCart).toHaveBeenCalledTimes(1);
      expect(mockCartApi.refreshCart).toHaveBeenCalledWith('cart-1');
      expect(result).toEqual(mappedCartWithDiscount);
    });

    it('throws CartDiscountError when apply is not OK', async () => {
      mockCartApi.getCart.mockResolvedValue(rawCart);
      mockMapper.mapToService.mockReturnValue(mappedCartWithDiscount);
      mockCartApi.applyDiscount.mockRejectedValue(
        new Error('Failed to apply discount to cart: 400 Bad Request {"status":400,"message":"not allowed"}'),
      );

      await expect(cartService.applyDiscount('cart-1', 'NOTALLOWED')).rejects.toEqual(
        expect.objectContaining({
          name: 'CartDiscountError',
          message: 'Failed to apply discount',
          upstreamStatus: 400,
          upstreamBody: '{"status":400,"message":"not allowed"}',
        }),
      );
      expect(mockCartApi.getCart).toHaveBeenCalledTimes(1);
    });

    it('defaults unclassified apply failures (timeout / fetch) to upstream 500', async () => {
      mockCartApi.getCart.mockResolvedValue(rawCart);
      mockMapper.mapToService.mockReturnValue(mappedCartWithDiscount);
      mockCartApi.applyDiscount.mockRejectedValue(new Error('fetch failed'));

      await expect(cartService.applyDiscount('cart-1', 'LS10PTOTAL')).rejects.toEqual(
        expect.objectContaining({
          name: 'CartDiscountError',
          message: 'Failed to apply discount',
          upstreamStatus: 500,
        }),
      );
      expect(mockCouponApi.validateCoupon).not.toHaveBeenCalled();
    });

    describe('rejection classification via coupon validation', () => {
      const cartRejection = new Error(
        'Failed to apply discount to cart: 400 Bad Request {"code":400,"message":"Discount with code X is not valid"}',
      );

      beforeEach(() => {
        mockCartApi.getCart.mockResolvedValue(rawCart);
        mockMapper.mapToService.mockReturnValue(mappedCartWithDiscount);
        mockCartApi.applyDiscount.mockRejectedValue(cartRejection);
      });

      it('asks the coupon service with the cart goods total and the cart legal entity', async () => {
        mockSessionService.getCurrent.mockResolvedValue({
          id: 'session-1',
          customerId: 'cust-uuid',
          currency: 'EUR',
          siteCode: 'main',
          legalEntityId: 'le-1',
          cartId: 'cart-1',
        });
        mockCartApi.getCart.mockResolvedValue({ ...rawCart, legalEntityId: 'le-1' });
        mockMapper.mapToService.mockReturnValue({ ...mappedCartWithDiscount, legalEntity: 'le-1' });
        mockCustomerApi.getCustomerProfile.mockResolvedValue({
          id: 'cust-uuid',
          customerNumber: 'C-100',
        });
        mockCouponApi.validateCoupon.mockResolvedValue({ ok: true });

        await expect(cartService.applyDiscount('cart-1', 'SOMECODE')).rejects.toEqual(
          expect.objectContaining({ name: 'CartDiscountError', reason: CART_DISCOUNT_REASON.NOT_APPLICABLE }),
        );
        expect(mockCustomerApi.getCustomerProfile).toHaveBeenCalledTimes(1);
        expect(mockCouponApi.validateCoupon).toHaveBeenCalledWith('SOMECODE', {
          orderTotal: { amount: 90, currency: 'EUR' },
          legalEntityId: 'le-1',
          customerNumber: 'C-100',
        });
      });

      it('omits customerNumber when the profile lookup fails instead of sending session.customerId', async () => {
        mockSessionService.getCurrent.mockResolvedValue({
          id: 'session-1',
          customerId: 'cust-uuid',
          currency: 'EUR',
          siteCode: 'main',
          cartId: 'cart-1',
        });
        mockCustomerApi.getCustomerProfile.mockRejectedValue(new Error('Failed to get customer profile'));
        mockCouponApi.validateCoupon.mockResolvedValue({ ok: true });

        await expect(cartService.applyDiscount('cart-1', 'SOMECODE')).rejects.toEqual(
          expect.objectContaining({ name: 'CartDiscountError', reason: CART_DISCOUNT_REASON.NOT_APPLICABLE }),
        );
        expect(mockCouponApi.validateCoupon).toHaveBeenCalledWith('SOMECODE', {
          orderTotal: { amount: 90, currency: 'EUR' },
        });
      });

      it('does not look up a customerNumber for anonymous sessions', async () => {
        mockCouponApi.validateCoupon.mockResolvedValue({ ok: true });

        await expect(cartService.applyDiscount('cart-1', 'SOMECODE')).rejects.toBeDefined();
        expect(mockCustomerApi.getCustomerProfile).not.toHaveBeenCalled();
        expect(mockCouponApi.validateCoupon).toHaveBeenCalledWith('SOMECODE', {
          orderTotal: { amount: 90, currency: 'EUR' },
        });
      });

      it('omits legalEntityId for carts without a legal entity', async () => {
        mockCouponApi.validateCoupon.mockResolvedValue({ ok: true });

        await expect(cartService.applyDiscount('cart-1', 'SOMECODE')).rejects.toBeDefined();
        expect(mockCouponApi.validateCoupon).toHaveBeenCalledWith('SOMECODE', {
          orderTotal: { amount: 90, currency: 'EUR' },
        });
      });

      it('classifies re-applying a code already on the cart (cart-service 409) as ALREADY_APPLIED without a lookup', async () => {
        mockCartApi.applyDiscount.mockRejectedValue(
          new Error('Failed to apply discount to cart: 409 Conflict {"status":409,"message":"already applied"}'),
        );

        await expect(cartService.applyDiscount('cart-1', 'LS10PTOTAL')).rejects.toEqual(
          expect.objectContaining({ reason: CART_DISCOUNT_REASON.ALREADY_APPLIED, upstreamStatus: 409 }),
        );
        expect(mockCouponApi.validateCoupon).not.toHaveBeenCalled();
      });

      it('classifies a 409 as ALREADY_APPLIED when the response names the submitted code', async () => {
        mockCartApi.applyDiscount.mockRejectedValue(
          new Error(
            'Failed to apply discount to cart: 409 Conflict {"status":409,"message":"Another discount already exists in cart. Discount code found: NOT-ON-MAPPED-CART"}',
          ),
        );

        await expect(cartService.applyDiscount('cart-1', 'NOT-ON-MAPPED-CART')).rejects.toEqual(
          expect.objectContaining({ reason: CART_DISCOUNT_REASON.ALREADY_APPLIED, upstreamStatus: 409 }),
        );
        expect(mockCouponApi.validateCoupon).not.toHaveBeenCalled();
      });

      it('does not treat a 409 exclusive-coupon conflict as ALREADY_APPLIED for a different code', async () => {
        mockCartApi.applyDiscount.mockRejectedValue(
          new Error(
            'Failed to apply discount to cart: 409 Conflict {"status":409,"message":"Another discount already exists in cart. Discount code found: 15OFF"}',
          ),
        );
        mockCouponApi.validateCoupon.mockResolvedValue({ ok: true });

        await expect(cartService.applyDiscount('cart-1', 'SAVE20')).rejects.toEqual(
          expect.objectContaining({ reason: CART_DISCOUNT_REASON.NOT_APPLICABLE, upstreamStatus: 409 }),
        );
        expect(mockCouponApi.validateCoupon).toHaveBeenCalledWith('SAVE20', {
          orderTotal: { amount: 90, currency: 'EUR' },
        });
      });

      it('classifies a 400 for a code already on the cart as ALREADY_APPLIED without a lookup', async () => {
        await expect(cartService.applyDiscount('cart-1', 'LS10PTOTAL')).rejects.toEqual(
          expect.objectContaining({ reason: CART_DISCOUNT_REASON.ALREADY_APPLIED, upstreamStatus: 400 }),
        );
        expect(mockCouponApi.validateCoupon).not.toHaveBeenCalled();
      });

      it('does not label a 5xx for a code already on the cart as ALREADY_APPLIED', async () => {
        mockCartApi.applyDiscount.mockRejectedValue(
          new Error('Failed to apply discount to cart: 503 Service Unavailable {"status":503}'),
        );

        await expect(cartService.applyDiscount('cart-1', 'LS10PTOTAL')).rejects.toEqual(
          expect.objectContaining({ upstreamStatus: 503, reason: undefined }),
        );
        expect(mockCouponApi.validateCoupon).not.toHaveBeenCalled();
      });

      it('classifies a documented 500 wrong-discount-currency rejection via coupon validation', async () => {
        mockCartApi.applyDiscount.mockRejectedValue(
          new Error(
            'Failed to apply discount to cart: 500 Internal Server Error {"code":500,"status":"Internal Server Error","message":"Discount currency is CAD and is not equal to cart currency EUR."}',
          ),
        );
        mockCouponApi.validateCoupon.mockResolvedValue({ ok: true });

        await expect(cartService.applyDiscount('cart-1', 'CADCODE')).rejects.toEqual(
          expect.objectContaining({ reason: CART_DISCOUNT_REASON.NOT_APPLICABLE, upstreamStatus: 500 }),
        );
        expect(mockCouponApi.validateCoupon).toHaveBeenCalledWith('CADCODE', {
          orderTotal: { amount: 90, currency: 'EUR' },
        });
      });

      it('classifies a documented 500 already-exists rejection as ALREADY_APPLIED', async () => {
        mockCartApi.applyDiscount.mockRejectedValue(
          new Error(
            'Failed to apply discount to cart: 500 Internal Server Error {"code":500,"message":"Discount code DEVIZU already exists in cart."}',
          ),
        );

        await expect(cartService.applyDiscount('cart-1', 'DEVIZU')).rejects.toEqual(
          expect.objectContaining({ reason: CART_DISCOUNT_REASON.ALREADY_APPLIED, upstreamStatus: 500 }),
        );
        expect(mockCouponApi.validateCoupon).not.toHaveBeenCalled();
      });

      it('does not classify a generic 500 without a documented coupon-rejection payload', async () => {
        mockCartApi.applyDiscount.mockRejectedValue(
          new Error('Failed to apply discount to cart: 500 Internal Server Error {"code":500,"message":"boom"}'),
        );

        await expect(cartService.applyDiscount('cart-1', 'SOMECODE')).rejects.toEqual(
          expect.objectContaining({ upstreamStatus: 500, reason: undefined }),
        );
        expect(mockCouponApi.validateCoupon).not.toHaveBeenCalled();
      });

      it('classifies an expired code as NOT_ACTIVE', async () => {
        mockCouponApi.validateCoupon.mockResolvedValue({
          ok: false,
          status: 400,
          type: 'business_error',
          detailTypes: ['coupon_expired'],
        });

        await expect(cartService.applyDiscount('cart-1', 'OLDCODE')).rejects.toEqual(
          expect.objectContaining({ reason: CART_DISCOUNT_REASON.NOT_ACTIVE }),
        );
      });

      it.each([
        ['401 without a body', { ok: false as const, status: 401, detailTypes: [] }],
        ['401 business_error', { ok: false as const, status: 401, type: 'business_error', detailTypes: [] }],
        ['500 business_error', { ok: false as const, status: 500, type: 'business_error', detailTypes: [] }],
        ['non-business 403', { ok: false as const, status: 403, type: 'Forbidden', detailTypes: [] }],
      ])('keeps the original error when the validation answer is inconclusive (%s)', async (_label, outcome) => {
        mockCouponApi.validateCoupon.mockResolvedValue(outcome);

        await expect(cartService.applyDiscount('cart-1', 'SOMECODE')).rejects.toEqual(
          expect.objectContaining({ name: 'CartDiscountError', upstreamStatus: 400, reason: undefined }),
        );
      });

      it('classifies an unknown code as CODE_NOT_FOUND', async () => {
        mockCouponApi.validateCoupon.mockResolvedValue({
          ok: false,
          status: 404,
          type: 'resource_not_found',
          detailTypes: [],
        });

        await expect(cartService.applyDiscount('cart-1', 'NOPE')).rejects.toEqual(
          expect.objectContaining({ reason: CART_DISCOUNT_REASON.CODE_NOT_FOUND, upstreamStatus: 400 }),
        );
      });

      it.each([
        ['coupon_segment_customer_not_assigned', 400],
        ['coupon_redemption_forbidden', 403],
      ])('classifies %s as NOT_ELIGIBLE', async (detailType, status) => {
        mockCouponApi.validateCoupon.mockResolvedValue({
          ok: false,
          status,
          type: 'business_error',
          detailTypes: [detailType],
        });

        await expect(cartService.applyDiscount('cart-1', 'VKTEST-PROMO03')).rejects.toEqual(
          expect.objectContaining({ reason: CART_DISCOUNT_REASON.NOT_ELIGIBLE }),
        );
      });

      it('classifies a 403 business error with an unknown detail type as NOT_ELIGIBLE', async () => {
        mockCouponApi.validateCoupon.mockResolvedValue({
          ok: false,
          status: 403,
          type: 'business_error',
          detailTypes: ['coupon_customer_not_allowed'],
        });

        await expect(cartService.applyDiscount('cart-1', 'ALLOWLIST')).rejects.toEqual(
          expect.objectContaining({ reason: CART_DISCOUNT_REASON.NOT_ELIGIBLE }),
        );
      });

      it('classifies any other business rejection (threshold, currency, dates) as NOT_APPLICABLE', async () => {
        mockCouponApi.validateCoupon.mockResolvedValue({
          ok: false,
          status: 400,
          type: 'business_error',
          detailTypes: ['coupon_order_total_too_low'],
        });

        await expect(cartService.applyDiscount('cart-1', 'MINORDER')).rejects.toEqual(
          expect.objectContaining({ reason: CART_DISCOUNT_REASON.NOT_APPLICABLE }),
        );
      });

      it('keeps the original error without a reason when the validation lookup itself fails', async () => {
        mockCouponApi.validateCoupon.mockRejectedValue(new Error('Failed to validate coupon: 503'));

        await expect(cartService.applyDiscount('cart-1', 'SOMECODE')).rejects.toEqual(
          expect.objectContaining({ name: 'CartDiscountError', upstreamStatus: 400, reason: undefined }),
        );
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it.each([
        ['401 Unauthorized', 401],
        ['403 Forbidden', 403],
        ['404 Not Found', 404],
        ['503 Service Unavailable', 503],
      ])('does not consult the coupon service for a cart-service %s', async (statusText, status) => {
        mockCartApi.applyDiscount.mockRejectedValue(
          new Error(`Failed to apply discount to cart: ${statusText} {"status":${status}}`),
        );

        await expect(cartService.applyDiscount('cart-1', 'SOMECODE')).rejects.toEqual(
          expect.objectContaining({ upstreamStatus: status, reason: undefined }),
        );
        expect(mockCouponApi.validateCoupon).not.toHaveBeenCalled();
      });
    });

    it('does not apply when the cart is missing', async () => {
      mockCartApi.getCart.mockResolvedValue(null);

      await expect(cartService.applyDiscount('cart-1', 'LS10PTOTAL')).rejects.toEqual(
        expect.objectContaining({
          name: 'CartDiscountError',
          message: 'Cart not found',
        }),
      );
      expect(mockCartApi.applyDiscount).not.toHaveBeenCalled();
    });

    it('does not apply when the cart fails the session legal-entity guard', async () => {
      mockSessionService.getCurrent.mockResolvedValue({
        id: 'session-1',
        customerId: 'cust-1',
        currency: 'EUR',
        siteCode: 'main',
        legalEntityId: 'le-session',
        cartId: 'cart-1',
      });
      mockCartApi.getCart.mockResolvedValue({
        ...rawCart,
        legalEntityId: 'le-other',
      });

      await expect(cartService.applyDiscount('cart-1', 'LS10PTOTAL')).rejects.toEqual(
        expect.objectContaining({
          name: 'CartDiscountError',
          message: 'Cart not found',
        }),
      );
      expect(mockCartApi.applyDiscount).not.toHaveBeenCalled();
      expect(mockSessionService.clearCart).toHaveBeenCalled();
    });
  });

  describe('removeDiscount', () => {
    const mappedCart: Cart = {
      id: 'cart-1',
      currency: 'EUR',
      site: 'main',
      items: [],
      totalPrice: { amount: 100, originalAmount: 100, currency: 'EUR' },
      subTotalPrice: { amount: 100, originalAmount: 100, currency: 'EUR' },
      tax: { amount: 19, currency: 'EUR', netValue: 81, grossValue: 100 },
      discounts: [{ code: 'SAVE10', discountIndex: 0, amount: 5, currency: 'EUR' }],
    };

    beforeEach(() => {
      mockSessionService.getCurrent.mockResolvedValue({
        id: 'session-1',
        siteCode: 'main',
        currency: 'EUR',
      });
    });

    it('removes by index and returns the mapped cart', async () => {
      mockCartApi.getCart.mockResolvedValue({
        id: 'cart-1',
        currency: 'EUR',
        siteCode: 'main',
      });
      mockMapper.mapToService.mockReturnValue(mappedCart);

      const result = await cartService.removeDiscount('cart-1', 0);

      expect(mockCartApi.removeDiscount).toHaveBeenCalledWith('cart-1', 0);
      expect(result).toEqual(mappedCart);
    });

    it('maps a 403 from the session cart guard to CartDiscountError before removing', async () => {
      mockCartApi.getCart.mockRejectedValue(
        new Error('Failed to get cart: Forbidden {"status":403,"message":"Access denied"}'),
      );

      await expect(cartService.removeDiscount('cart-1', 0)).rejects.toEqual(
        expect.objectContaining({
          name: 'CartDiscountError',
          message: 'Failed to resolve cart for discount write',
          upstreamStatus: 403,
        }),
      );
      expect(mockCartApi.removeDiscount).not.toHaveBeenCalled();
    });

    it('throws CartDiscountError when remove is not OK', async () => {
      mockCartApi.getCart.mockResolvedValue({
        id: 'cart-1',
        currency: 'EUR',
        siteCode: 'main',
      });
      mockMapper.mapToService.mockReturnValue(mappedCart);
      mockCartApi.removeDiscount.mockRejectedValue(
        new Error('Failed to remove discount from cart: 404 Not Found {"status":404}'),
      );

      await expect(cartService.removeDiscount('cart-1', 0)).rejects.toEqual(
        expect.objectContaining({
          name: 'CartDiscountError',
          message: 'Failed to remove discount',
          upstreamStatus: 404,
        }),
      );
    });

    it('defaults unclassified remove failures to upstream 500', async () => {
      mockCartApi.getCart.mockResolvedValue({
        id: 'cart-1',
        currency: 'EUR',
        siteCode: 'main',
      });
      mockMapper.mapToService.mockReturnValue(mappedCart);
      mockCartApi.removeDiscount.mockRejectedValue(new Error('network timeout'));

      await expect(cartService.removeDiscount('cart-1', 0)).rejects.toEqual(
        expect.objectContaining({
          name: 'CartDiscountError',
          message: 'Failed to remove discount',
          upstreamStatus: 500,
        }),
      );
    });

    it('does not remove when the cart is missing', async () => {
      mockCartApi.getCart.mockResolvedValue(null);

      await expect(cartService.removeDiscount('cart-1', 0)).rejects.toEqual(
        expect.objectContaining({
          name: 'CartDiscountError',
          message: 'Cart not found',
        }),
      );
      expect(mockCartApi.removeDiscount).not.toHaveBeenCalled();
    });

    it('does not remove from a cart that belongs to another site', async () => {
      mockSessionService.getCurrent.mockResolvedValue({
        id: 'session-1',
        customerId: 'cust-1',
        currency: 'EUR',
        siteCode: 'other-site',
        cartId: 'cart-1',
      });
      mockCartApi.getCart.mockResolvedValue({ id: 'cart-1', currency: 'EUR', siteCode: 'main' });
      mockMapper.mapToService.mockReturnValue(mappedCart);

      await expect(cartService.removeDiscount('cart-1', 0)).rejects.toEqual(
        expect.objectContaining({ name: 'CartDiscountError', message: CART_SITE_MISMATCH_MESSAGE }),
      );
      expect(mockCartApi.removeDiscount).not.toHaveBeenCalled();
    });

    it('does not remove when the cart fails the session legal-entity guard', async () => {
      mockSessionService.getCurrent.mockResolvedValue({
        id: 'session-1',
        customerId: 'cust-1',
        currency: 'EUR',
        siteCode: 'main',
        legalEntityId: 'le-session',
        cartId: 'cart-1',
      });
      mockCartApi.getCart.mockResolvedValue({
        id: 'cart-1',
        currency: 'EUR',
        siteCode: 'main',
        legalEntityId: 'le-other',
      });

      await expect(cartService.removeDiscount('cart-1', 0)).rejects.toEqual(
        expect.objectContaining({
          name: 'CartDiscountError',
          message: 'Cart not found',
        }),
      );
      expect(mockCartApi.removeDiscount).not.toHaveBeenCalled();
      expect(mockSessionService.clearCart).toHaveBeenCalled();
    });

    it('does not DELETE a TOTAL rollup index', async () => {
      mockCartApi.getCart.mockResolvedValue({
        id: 'cart-1',
        currency: 'EUR',
        siteCode: 'main',
      });
      mockMapper.mapToService.mockReturnValue({
        ...mappedCart,
        discounts: [{ code: 'TOTAL', discountIndex: 0, amount: 10, currency: 'EUR' }],
      });

      await expect(cartService.removeDiscount('cart-1', 0)).rejects.toEqual(
        expect.objectContaining({
          name: 'CartDiscountError',
          message: 'Discount is not removable',
          upstreamStatus: 400,
        }),
      );
      expect(mockCartApi.removeDiscount).not.toHaveBeenCalled();
    });

    it('does not DELETE an unknown discount index', async () => {
      mockCartApi.getCart.mockResolvedValue({
        id: 'cart-1',
        currency: 'EUR',
        siteCode: 'main',
      });
      mockMapper.mapToService.mockReturnValue(mappedCart);

      await expect(cartService.removeDiscount('cart-1', 9)).rejects.toEqual(
        expect.objectContaining({
          name: 'CartDiscountError',
          message: 'Discount is not removable',
          upstreamStatus: 400,
        }),
      );
      expect(mockCartApi.removeDiscount).not.toHaveBeenCalled();
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

      expect(mockPriceService.getProductPrice).toHaveBeenCalledWith('prod-1', 1, undefined, {
        siteCode: 'us-branch',
        currency: 'USD',
        useFallback: false,
      });

      // Verify the addItemRequest uses cart's siteCode and sends the full localized
      // name map (not a single-language string) so the cart line can be re-rendered
      // in any supported locale without another add-to-cart round trip.
      expect(mockCartApi.addItemToCart).toHaveBeenCalledWith(
        'cart-us',
        expect.objectContaining({
          siteCode: 'us-branch',
          product: expect.objectContaining({
            id: 'prod-1',
            localizedName: { en: 'Widget' },
            sku: 'WID-001',
          }),
        }),
      );

      const addItemCallArg = mockCartApi.addItemToCart.mock.calls[0][1];
      expect(addItemCallArg.product).not.toHaveProperty('name');
      expect(addItemCallArg.product).not.toHaveProperty('description');

      expect(result.cartItem.id).toBe('new-item-id');
      expect(result.status).toBe('OK');
    });

    it('does not PATCH cart country before add; prices still use session country', async () => {
      const roCart: EmporixCart = {
        ...rawCart,
        countryCode: 'RO',
      };
      mockCartApi.getCart.mockResolvedValueOnce(roCart).mockResolvedValueOnce(roCart);
      mockProductService.getProductById.mockResolvedValue(mockProduct);
      mockSessionService.getCurrent.mockResolvedValue({ ...mockSession, country: 'CH' });
      mockPriceService.getProductPrice.mockResolvedValue(mockPrice);
      mockMapper.mapToService.mockReturnValue({
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
      });

      await cartService.addItemToCart('cart-us', 'prod-1', 1);

      expect(mockCartApi.updateCart).not.toHaveBeenCalled();
      expect(mockPriceService.getProductPrice).toHaveBeenCalledWith('prod-1', 1, undefined, {
        siteCode: 'us-branch',
        currency: 'USD',
        country: 'CH',
        useFallback: false,
      });
    });

    it('should align cart currency with session before add when they differ on the same site', async () => {
      const eurCart: EmporixCart = {
        id: 'cart-us',
        currency: 'EUR',
        siteCode: 'us-branch',
        metadata: { version: 1 },
      };
      const usdCartAfterChange: EmporixCart = {
        ...eurCart,
        currency: 'USD',
      };
      const sessionUsd: typeof mockSession = {
        ...mockSession,
        currency: 'USD',
      };

      mockCartApi.getCart
        .mockResolvedValueOnce(eurCart)
        .mockResolvedValueOnce(eurCart)
        .mockResolvedValueOnce(usdCartAfterChange)
        .mockResolvedValueOnce(usdCartAfterChange)
        .mockResolvedValueOnce(usdCartAfterChange);
      mockProductService.getProductById.mockResolvedValue(mockProduct);
      mockSessionService.getCurrent.mockResolvedValue(sessionUsd);
      mockPriceService.getProductPrice.mockResolvedValue(mockPrice);

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
      mockMapper.mapToService.mockReturnValue(mappedCart);

      await cartService.addItemToCart('cart-us', 'prod-1', 1);

      expect(mockCartApi.changeCurrency).toHaveBeenCalledWith('cart-us', 'USD');
      expect(mockCartApi.addItemToCart).toHaveBeenCalled();
    });

    it('replaces an empty cart when currency alignment is forbidden', async () => {
      const emptyForeignCart: EmporixCart = {
        id: 'cart-old',
        currency: 'EUR',
        siteCode: 'us-branch',
        sessionId: 'session-1',
        items: [],
        metadata: { version: 1 },
      };
      const replacementCart: EmporixCart = {
        id: 'cart-new',
        currency: 'USD',
        siteCode: 'us-branch',
        sessionId: 'session-1',
        items: [],
        metadata: { version: 1 },
      };
      mockCartApi.getCart
        .mockResolvedValueOnce(emptyForeignCart)
        .mockResolvedValueOnce(emptyForeignCart)
        .mockResolvedValueOnce(emptyForeignCart)
        .mockResolvedValueOnce(replacementCart)
        .mockResolvedValueOnce(replacementCart);
      mockCartApi.changeCurrency.mockRejectedValue(
        new Error('Failed to change cart currency: Forbidden {"status":403,"message":"Access denied"}'),
      );
      mockCartApi.createCart.mockResolvedValue('cart-new');
      mockProductService.getProductById.mockResolvedValue(mockProduct);
      mockSessionService.getCurrent.mockResolvedValue({ ...mockSession, currency: 'USD', cartId: 'cart-old' });
      mockPriceService.getProductPrice.mockResolvedValue(mockPrice);
      mockMapper.mapToService.mockReturnValue({
        id: 'cart-new',
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
      });

      await cartService.addItemToCart('cart-old', 'prod-1', 1);

      expect(mockSessionService.clearCart).toHaveBeenCalled();
      expect(mockCartApi.createCart).toHaveBeenCalled();
      expect(mockCartApi.addItemToCart).toHaveBeenCalledWith('cart-new', expect.any(Object));
    });

    it('adds on a new cart when the requested empty cart belongs to another session', async () => {
      const foreignEmpty: EmporixCart = {
        id: 'cart-old',
        currency: 'USD',
        siteCode: 'us-branch',
        sessionId: 'session-old',
        items: [],
        metadata: { version: 1 },
      };
      const replacementCart: EmporixCart = {
        id: 'cart-new',
        currency: 'USD',
        siteCode: 'us-branch',
        sessionId: 'session-1',
        items: [],
        metadata: { version: 1 },
      };
      mockCartApi.getCart.mockImplementation(async (id: string) =>
        id === 'cart-new' ? replacementCart : foreignEmpty,
      );
      mockCartApi.getCartByCriteria.mockResolvedValue(null);
      mockCartApi.createCart.mockResolvedValue('cart-new');
      mockProductService.getProductById.mockResolvedValue(mockProduct);
      mockSessionService.getCurrent.mockResolvedValue({ ...mockSession, cartId: 'cart-old' });
      mockPriceService.getProductPrice.mockResolvedValue(mockPrice);
      mockMapper.mapToService.mockReturnValue({
        id: 'cart-new',
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
      });

      await cartService.addItemToCart('cart-old', 'prod-1', 1);

      expect(mockCartApi.changeCurrency).not.toHaveBeenCalled();
      expect(mockSessionService.clearCart).toHaveBeenCalled();
      expect(mockCartApi.createCart).toHaveBeenCalled();
      expect(mockCartApi.addItemToCart).toHaveBeenCalledWith('cart-new', expect.any(Object));
    });

    it('does not replace an empty cart that gained a line before the failed reprice was handled', async () => {
      const emptyCart: EmporixCart = {
        id: 'cart-us',
        currency: 'EUR',
        siteCode: 'us-branch',
        sessionId: 'session-1',
        items: [],
        metadata: { version: 1 },
      };
      const occupiedAfterRace: EmporixCart = {
        ...emptyCart,
        items: [{ id: '0', quantity: 1 } as NonNullable<EmporixCart['items']>[number]],
      };
      mockCartApi.getCart
        .mockResolvedValueOnce(emptyCart)
        .mockResolvedValueOnce(emptyCart)
        .mockResolvedValueOnce(occupiedAfterRace);
      mockCartApi.changeCurrency.mockRejectedValue(
        new Error('Failed to change cart currency: Forbidden {"status":403,"message":"Access denied"}'),
      );
      mockProductService.getProductById.mockResolvedValue(mockProduct);
      mockSessionService.getCurrent.mockResolvedValue(mockSession);

      await expect(cartService.addItemToCart('cart-us', 'prod-1', 1)).rejects.toEqual(
        expect.objectContaining({ code: 'FORBIDDEN' }),
      );
      expect(mockCartApi.createCart).not.toHaveBeenCalled();
      expect(mockSessionService.clearCart).not.toHaveBeenCalled();
    });

    it('does not replace a cart that still has lines when currency alignment is forbidden', async () => {
      const occupiedCart: EmporixCart = {
        id: 'cart-us',
        currency: 'EUR',
        siteCode: 'us-branch',
        sessionId: 'session-old',
        items: [{ id: '0', quantity: 1 } as NonNullable<EmporixCart['items']>[number]],
        metadata: { version: 1 },
      };
      mockCartApi.getCart.mockResolvedValue(occupiedCart);
      mockCartApi.changeCurrency.mockRejectedValue(
        new Error('Failed to change cart currency: Forbidden {"status":403,"message":"Access denied"}'),
      );
      mockProductService.getProductById.mockResolvedValue(mockProduct);
      mockSessionService.getCurrent.mockResolvedValue(mockSession);

      await expect(cartService.addItemToCart('cart-us', 'prod-1', 1)).rejects.toEqual(
        expect.objectContaining({ code: 'FORBIDDEN' }),
      );
      expect(mockCartApi.createCart).not.toHaveBeenCalled();
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

      expect(mockPriceService.getProductPrice).toHaveBeenCalledWith('prod-1', 1, undefined, {
        siteCode: 'us-branch',
        currency: 'USD',
        useFallback: false,
      });

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

      expect(mockPriceService.getProductPrice).toHaveBeenCalledWith('prod-1', 3, undefined, {
        siteCode: 'us-branch',
        currency: 'USD',
        useFallback: false,
      });

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

    it('skips an empty cart bound to another session', async () => {
      const session = {
        id: 'session-now',
        siteCode: 'main',
        currency: 'EUR',
        customerId: 'cust-1',
        cartId: 'cart-old',
      };
      const foreignEmpty: EmporixCart = {
        id: 'cart-old',
        currency: 'EUR',
        siteCode: 'main',
        sessionId: 'session-old',
        customerId: 'cust-1',
        items: [],
      };
      mockSessionService.getCurrent.mockResolvedValue(session);
      mockCartApi.getCart.mockResolvedValue(foreignEmpty);
      mockCartApi.getCartByCriteria.mockResolvedValue(null);

      const result = await cartService.getCart();

      expect(mockSessionService.clearCart).toHaveBeenCalled();
      expect(mockSessionService.setCart).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('keeps a foreign cart when neither items nor totalUnitsCount proves it is empty', async () => {
      const session = {
        id: 'session-now',
        siteCode: 'main',
        currency: 'EUR',
        customerId: 'cust-1',
        cartId: 'cart-old',
      };
      const unproven: EmporixCart = {
        id: 'cart-old',
        currency: 'EUR',
        siteCode: 'main',
        sessionId: 'session-old',
        customerId: 'cust-1',
      };
      const mapped = {
        id: 'cart-old',
        currency: 'EUR',
        site: 'main',
        items: [],
        totalPrice: { amount: 0, originalAmount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, originalAmount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', grossValue: 0, netValue: 0 },
      };
      mockSessionService.getCurrent.mockResolvedValue(session);
      mockCartApi.getCart.mockResolvedValue(unproven);
      mockMapper.mapToService.mockReturnValue(mapped);

      const result = await cartService.getCart();

      expect(mockSessionService.clearCart).not.toHaveBeenCalled();
      expect(result).toBe(mapped);
    });

    it('treats totalUnitsCount 0 as an empty foreign cart', async () => {
      const session = {
        id: 'session-now',
        siteCode: 'main',
        currency: 'EUR',
        customerId: 'cust-1',
        cartId: 'cart-old',
      };
      const countedEmpty: EmporixCart = {
        id: 'cart-old',
        currency: 'EUR',
        siteCode: 'main',
        sessionId: 'session-old',
        customerId: 'cust-1',
        totalUnitsCount: 0,
      };
      mockSessionService.getCurrent.mockResolvedValue(session);
      mockCartApi.getCart.mockResolvedValue(countedEmpty);
      mockCartApi.getCartByCriteria.mockResolvedValue(null);

      const result = await cartService.getCart();

      expect(mockSessionService.clearCart).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('does not clear the session when it was rebound before the foreign cart was discarded', async () => {
      const session = {
        id: 'session-now',
        siteCode: 'main',
        currency: 'EUR',
        customerId: 'cust-1',
        cartId: 'cart-old',
      };
      const foreignEmpty: EmporixCart = {
        id: 'cart-old',
        currency: 'EUR',
        siteCode: 'main',
        sessionId: 'session-old',
        customerId: 'cust-1',
        items: [],
      };
      mockSessionService.getCurrent
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce({ ...session, cartId: 'cart-newer' });
      mockCartApi.getCart.mockResolvedValue(foreignEmpty);
      mockCartApi.getCartByCriteria.mockResolvedValue(null);

      const result = await cartService.getCart();

      expect(mockSessionService.clearCart).not.toHaveBeenCalled();
      expect(result).toBeNull();
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

    it('should discard cached cart when legalEntityId does not match session and not reuse another company cart', async () => {
      const b2bSession = {
        id: 'session-b2b',
        siteCode: 'main',
        currency: 'EUR',
        customerId: 'customer-99',
        cartId: 'cart-other-co',
        legalEntityId: 'le-current',
      };
      const wrongLeCart: EmporixCart = {
        id: 'cart-other-co',
        currency: 'EUR',
        siteCode: 'main',
        customerId: 'customer-99',
        legalEntityId: 'le-old',
      };

      mockSessionService.getCurrent.mockResolvedValue(b2bSession);
      mockCartApi.getCart.mockResolvedValue(wrongLeCart);
      mockCartApi.getCartByCriteria.mockResolvedValue(null);

      const result = await cartService.getCart();

      expect(mockSessionService.clearCart).toHaveBeenCalled();
      expect(mockCartApi.getCartByCriteria).toHaveBeenCalledWith('main', undefined, 'customer-99', 'shopping', false);
      expect(mockCartApi.getCartByCriteria).not.toHaveBeenCalledWith(
        'main',
        'session-b2b',
        undefined,
        'shopping',
        false,
      );
      expect(mockSessionService.setCart).not.toHaveBeenCalled();
      expect(result).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          cartId: 'cart-other-co',
          cartLegalEntityId: 'le-old',
          sessionLegalEntityId: 'le-current',
        }),
        'Discarding cart — legalEntityId does not match session (no cross-company cart reuse)',
      );
    });

    it('should keep cart when legalEntityId matches session (B2B)', async () => {
      const b2bSession = {
        id: 'session-b2b',
        siteCode: 'main',
        currency: 'EUR',
        customerId: 'customer-99',
        cartId: 'cart-ok',
        legalEntityId: 'le-a',
      };
      const rawCart: EmporixCart = {
        id: 'cart-ok',
        currency: 'EUR',
        siteCode: 'main',
        customerId: 'customer-99',
        legalEntityId: 'le-a',
      };
      const mappedCart: Cart = {
        id: 'cart-ok',
        currency: 'EUR',
        site: 'main',
        items: [],
        totalPrice: { amount: 0, originalAmount: 0, currency: 'EUR' },
        subTotalPrice: { amount: 0, originalAmount: 0, currency: 'EUR' },
        tax: { amount: 0, currency: 'EUR', grossValue: 0, netValue: 0 },
      };

      mockSessionService.getCurrent.mockResolvedValue(b2bSession);
      mockCartApi.getCart.mockResolvedValue(rawCart);
      mockMapper.mapToService.mockReturnValue(mappedCart);

      const result = await cartService.getCart();

      expect(mockSessionService.clearCart).not.toHaveBeenCalled();
      expect(result).toBe(mappedCart);
    });
  });

  describe('createCart', () => {
    it('creates a cart without destination country so zip is not required', async () => {
      mockCartApi.createCart.mockResolvedValue('cart-new');

      const cartId = await cartService.createCart('EUR', 'main');

      expect(cartId).toBe('cart-new');
      expect(mockCartApi.createCart).toHaveBeenCalledWith(
        expect.objectContaining({
          siteCode: 'main',
          currency: 'EUR',
        }),
      );
      expect(mockCartApi.createCart.mock.calls[0][0]).not.toHaveProperty('countryCode');
      expect(mockCartApi.createCart.mock.calls[0][0]).not.toHaveProperty('zipCode');
      expect(mockSessionService.setCart).toHaveBeenCalledWith('cart-new');
    });
  });
});
