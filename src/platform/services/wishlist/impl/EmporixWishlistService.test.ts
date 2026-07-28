import { Container } from 'inversify';
import 'reflect-metadata';
import type { EmporixCartApi } from '@/platform/integrations/emporix/cart/EmporixCartApi';
import type EmporixCommonUtil from '@/platform/integrations/emporix/common/util/EmporixCommonUtil';
import type { EmporixCart } from '@/platform/integrations/emporix/model/cart';
import type { CartService, ModifyCartItemResult } from '@/platform/services/cart/CartService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Cart } from '@/platform/services/model/cart/cart';
import type { ProductPrice } from '@/platform/services/model/price/price';
import type { Product } from '@/platform/services/model/product';
import type { Session } from '@/platform/services/model/session/session';
import type { WishlistMapper } from '@/platform/services/model/wishlist/WishlistMapper';
import type { Wishlist, WishlistItem } from '@/platform/services/model/wishlist/wishlist';
import type { PriceService } from '@/platform/services/price/PriceService';
import type { ProductService } from '@/platform/services/product/ProductService';
import type { SessionService } from '@/platform/services/session/SessionService';
import EmporixWishlistService from './EmporixWishlistService';

type RawCartItem = NonNullable<EmporixCart['items']>[number];

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    customerId: 'customer-1',
    currency: 'EUR',
    siteCode: 'main',
    country: 'DE',
    ...overrides,
  } as Session;
}

function makeRawCart(overrides: Partial<EmporixCart> = {}): EmporixCart {
  return {
    id: 'wl-cart-1',
    currency: 'EUR',
    siteCode: 'main',
    type: 'wishlist',
    items: [],
    ...overrides,
  } as EmporixCart;
}

function makeProductPrice(overrides: Partial<ProductPrice> = {}): ProductPrice {
  return {
    id: 'price-1',
    productId: 'prod-1',
    amount: 19.99,
    originalAmount: 19.99,
    currency: 'EUR',
    discountValue: 0,
    discountPercentage: 0,
    totalValue: 19.99,
    quantity: { quantity: 1 },
    includesTax: true,
    tierValues: [],
    ...overrides,
  } as ProductPrice;
}

function makeMappedWishlistItem(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    id: 'line-1',
    quantity: 1,
    productId: 'prod-1',
    name: 'Widget',
    isPurchasable: true,
    hasCurrentPrice: true,
    ...overrides,
  } as WishlistItem;
}

function makeMappedWishlist(overrides: Partial<Wishlist> = {}): Wishlist {
  return {
    id: 'wl-cart-1',
    name: 'default',
    type: 'wishlist',
    currency: 'EUR',
    siteCode: 'main',
    items: [],
    totalQuantity: 0,
    ...overrides,
  } as Wishlist;
}

describe('EmporixWishlistService', () => {
  let container: Container;
  let wishlistService: EmporixWishlistService;

  let mockCartApi: jest.Mocked<
    Pick<
      EmporixCartApi,
      | 'getCart'
      | 'getCartByCriteria'
      | 'createCart'
      | 'addItemToCart'
      | 'updateCartItemQuantity'
      | 'removeCartItem'
      | 'deleteCart'
      | 'refreshCart'
      | 'changeCurrency'
    >
  >;
  let mockCommonUtil: jest.Mocked<Pick<EmporixCommonUtil, 'generateProductYrn'>>;
  let mockMapper: jest.Mocked<Pick<WishlistMapper<EmporixCart, unknown>, 'mapToService' | 'mapWishlistItemToService'>>;
  let mockCartService: jest.Mocked<Pick<CartService, 'getCart' | 'getCartById' | 'createCart' | 'addItemToCart'>>;
  let mockSessionService: jest.Mocked<Pick<SessionService, 'getCurrent'>>;
  let mockPriceService: jest.Mocked<Pick<PriceService, 'getProductPrice' | 'getProductPrices'>>;
  let mockProductService: jest.Mocked<Pick<ProductService, 'getProductById'>>;
  let mockLogger: jest.Mocked<LoggerService>;

  const widgetProduct: Product = {
    id: 'prod-1',
    name: 'Widget',
    description: '',
    purchasable: true,
  } as Product;

  const okCartAddResult: ModifyCartItemResult = {
    cartItem: { id: 'sc-item-1' } as unknown as ModifyCartItemResult['cartItem'],
    status: 'OK',
  };

  beforeEach(() => {
    container = new Container();

    mockCartApi = {
      getCart: jest.fn(),
      getCartByCriteria: jest.fn().mockResolvedValue(null),
      createCart: jest.fn().mockResolvedValue('wl-cart-new'),
      addItemToCart: jest.fn().mockResolvedValue('new-item-id'),
      updateCartItemQuantity: jest.fn().mockResolvedValue(undefined),
      removeCartItem: jest.fn().mockResolvedValue(undefined),
      deleteCart: jest.fn().mockResolvedValue(undefined),
      refreshCart: jest.fn().mockResolvedValue(undefined),
      changeCurrency: jest.fn().mockResolvedValue(undefined),
    };

    mockCommonUtil = {
      generateProductYrn: jest.fn().mockReturnValue('yrn:product:prod-1'),
    };

    mockMapper = {
      mapToService: jest.fn().mockImplementation((cart: EmporixCart) => makeMappedWishlist({ id: cart.id, items: [] })),
      mapWishlistItemToService: jest.fn(),
    };

    mockCartService = {
      getCart: jest.fn().mockResolvedValue(null),
      getCartById: jest.fn().mockResolvedValue(null),
      createCart: jest.fn().mockResolvedValue('shop-cart-1'),
      addItemToCart: jest.fn().mockResolvedValue(okCartAddResult),
    };

    mockSessionService = {
      getCurrent: jest.fn().mockResolvedValue(makeSession()),
    };

    mockPriceService = {
      getProductPrice: jest.fn().mockResolvedValue(makeProductPrice()),
      getProductPrices: jest.fn().mockResolvedValue(new Map()),
    };

    mockProductService = {
      getProductById: jest.fn().mockResolvedValue(widgetProduct),
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

    container.bind('EmporixCartApi').toConstantValue(mockCartApi);
    container.bind('EmporixCommonUtil').toConstantValue(mockCommonUtil);
    container.bind('EmporixWishlistMapper').toConstantValue(mockMapper);
    container.bind('CartService').toConstantValue(mockCartService);
    container.bind('SessionService').toConstantValue(mockSessionService);
    container.bind('PriceService').toConstantValue(mockPriceService);
    container.bind('ProductService').toConstantValue(mockProductService);
    container.bind('LoggerService').toConstantValue(mockLogger);
    container.bind<EmporixWishlistService>('WishlistService').to(EmporixWishlistService);

    wishlistService = container.get<EmporixWishlistService>('WishlistService');
  });

  describe('authentication gating', () => {
    it('throws when there is no current session', async () => {
      mockSessionService.getCurrent.mockResolvedValue(undefined);

      await expect(wishlistService.getDefaultWishlist()).rejects.toThrow('Failed to get session context');
      expect(mockCartApi.getCartByCriteria).not.toHaveBeenCalled();
    });

    it('throws when the session has no authenticated customer', async () => {
      mockSessionService.getCurrent.mockResolvedValue(makeSession({ customerId: undefined }));

      await expect(wishlistService.getDefaultWishlist()).rejects.toThrow('Wishlist requires an authenticated customer');
      expect(mockCartApi.getCartByCriteria).not.toHaveBeenCalled();
    });

    it('rejects anonymous customer ids that match the "anonymous" sentinel', async () => {
      mockSessionService.getCurrent.mockResolvedValue(makeSession({ customerId: '' }));

      await expect(wishlistService.addItem('prod-1', 1)).rejects.toThrow('Wishlist requires an authenticated customer');
    });
  });

  describe('getDefaultWishlist', () => {
    it('returns null when the customer has no wishlist cart', async () => {
      mockCartApi.getCartByCriteria.mockResolvedValue(null);

      const result = await wishlistService.getDefaultWishlist();

      expect(result).toBeNull();
      expect(mockCartApi.getCartByCriteria).toHaveBeenCalledWith('main', undefined, 'customer-1', 'wishlist', false);
    });

    it('returns the mapped + enriched wishlist when one exists', async () => {
      const rawCart = makeRawCart({
        items: [{ id: 'line-1', product: { id: 'prod-1' }, quantity: 2 } as RawCartItem],
      });
      mockCartApi.getCartByCriteria.mockResolvedValue(rawCart);
      mockMapper.mapToService.mockReturnValue(makeMappedWishlist({ items: [makeMappedWishlistItem({ quantity: 2 })] }));
      mockPriceService.getProductPrices.mockResolvedValue(
        new Map([['prod-1', makeProductPrice({ amount: 10, currency: 'EUR' })]]),
      );

      const result = await wishlistService.getDefaultWishlist();

      expect(result).not.toBeNull();
      expect(result!.items).toHaveLength(1);
      expect(result!.items[0].isPurchasable).toBe(true);
      expect(result!.items[0].hasCurrentPrice).toBe(true);
      expect(result!.totalKnownPrice?.gross.amount).toBe(20);
    });
  });

  describe('addItem', () => {
    it('lazy-creates the wishlist cart on the first add', async () => {
      // No existing wishlist for this customer.
      mockCartApi.getCartByCriteria.mockResolvedValue(null);
      const newRawCart = makeRawCart({ id: 'wl-cart-new' });
      mockCartApi.getCart.mockResolvedValue(newRawCart);

      await wishlistService.addItem('prod-1', 1);

      expect(mockCartApi.createCart).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'customer-1',
          siteCode: 'main',
          currency: 'EUR',
          type: 'wishlist',
        }),
      );
      expect(mockCartApi.addItemToCart).toHaveBeenCalledWith(
        'wl-cart-new',
        expect.objectContaining({
          siteCode: 'main',
          itemYrn: 'yrn:product:prod-1',
          quantity: 1,
          product: expect.objectContaining({ id: 'prod-1' }),
          price: expect.objectContaining({ priceId: 'price-1', effectiveAmount: 19.99 }),
        }),
      );
      // Wishlist mutation must never touch the session's currentCart.
      expect(mockCartApi.updateCartItemQuantity).not.toHaveBeenCalled();
    });

    it('merges quantity on an existing line instead of creating a duplicate', async () => {
      const rawCart = makeRawCart({
        items: [{ id: 'line-1', product: { id: 'prod-1' }, quantity: 2 } as RawCartItem],
      });
      mockCartApi.getCartByCriteria.mockResolvedValue(rawCart);
      mockCartApi.getCart.mockResolvedValue(rawCart);

      await wishlistService.addItem('prod-1', 3);

      expect(mockCartApi.updateCartItemQuantity).toHaveBeenCalledWith(
        'wl-cart-1',
        'line-1',
        expect.objectContaining({ quantity: 5 }),
      );
      expect(mockCartApi.addItemToCart).not.toHaveBeenCalled();
      expect(mockCartApi.createCart).not.toHaveBeenCalled();
    });

    it('throws "Price missing" when adding a NEW line for an unpriced product', async () => {
      mockCartApi.getCartByCriteria.mockResolvedValue(makeRawCart());
      mockPriceService.getProductPrice.mockResolvedValue(null);

      await expect(wishlistService.addItem('prod-1', 1)).rejects.toThrow('Price missing');
      expect(mockCartApi.addItemToCart).not.toHaveBeenCalled();
    });

    it('throws "Price missing" when merging into an EXISTING line and no price exists', async () => {
      const rawCart = makeRawCart({
        items: [{ id: 'line-1', product: { id: 'prod-1' }, quantity: 1 } as RawCartItem],
      });
      mockCartApi.getCartByCriteria.mockResolvedValue(rawCart);
      mockPriceService.getProductPrice.mockResolvedValue(null);

      await expect(wishlistService.addItem('prod-1', 1)).rejects.toThrow('Price missing');
      expect(mockCartApi.updateCartItemQuantity).not.toHaveBeenCalled();
    });

    it('throws "Product missing" when the catalog has no such product', async () => {
      mockCartApi.getCartByCriteria.mockResolvedValue(makeRawCart());
      mockProductService.getProductById.mockResolvedValue(undefined);

      await expect(wishlistService.addItem('does-not-exist', 1)).rejects.toThrow('Product missing');
      expect(mockCartApi.addItemToCart).not.toHaveBeenCalled();
    });

    it('aligns wishlist currency with session before mutating when the cart was in a different currency', async () => {
      const rawCart = makeRawCart({ currency: 'USD' });
      const refreshedCart = makeRawCart({ currency: 'EUR' });
      mockCartApi.getCartByCriteria.mockResolvedValue(rawCart);
      // getCart is called twice: once after changeCurrency, once after addItemToCart.
      mockCartApi.getCart.mockResolvedValueOnce(refreshedCart).mockResolvedValueOnce(refreshedCart);

      await wishlistService.addItem('prod-1', 1);

      expect(mockCartApi.changeCurrency).toHaveBeenCalledWith('wl-cart-1', 'EUR');
      const changeOrder = mockCartApi.changeCurrency.mock.invocationCallOrder[0];
      const addOrder = mockCartApi.addItemToCart.mock.invocationCallOrder[0];
      expect(addOrder).toBeGreaterThan(changeOrder);
    });

    it('recovers from a stale-priceId 400 by refreshing the cart and retrying once', async () => {
      mockCartApi.getCartByCriteria.mockResolvedValue(makeRawCart());
      mockCartApi.getCart.mockResolvedValue(makeRawCart());
      mockCartApi.addItemToCart
        .mockRejectedValueOnce(new Error('PriceIds : abc from cart are invalid'))
        .mockResolvedValueOnce('new-item-id');

      await wishlistService.addItem('prod-1', 1);

      expect(mockCartApi.refreshCart).toHaveBeenCalledWith('wl-cart-1');
      expect(mockCartApi.addItemToCart).toHaveBeenCalledTimes(2);
    });

    it('does NOT recover from unrelated errors — they propagate to the caller', async () => {
      mockCartApi.getCartByCriteria.mockResolvedValue(makeRawCart());
      mockCartApi.addItemToCart.mockRejectedValue(new Error('Unrelated boom'));

      await expect(wishlistService.addItem('prod-1', 1)).rejects.toThrow('Unrelated boom');
      expect(mockCartApi.refreshCart).not.toHaveBeenCalled();
    });
  });

  describe('updateItemQuantity', () => {
    it('throws when the wishlist does not exist', async () => {
      mockCartApi.getCartByCriteria.mockResolvedValue(null);

      await expect(wishlistService.updateItemQuantity('prod-1', 2)).rejects.toThrow('Wishlist not found');
      expect(mockCartApi.updateCartItemQuantity).not.toHaveBeenCalled();
    });

    it('throws when the product is not on the wishlist', async () => {
      mockCartApi.getCartByCriteria.mockResolvedValue(
        makeRawCart({ items: [{ id: 'line-1', product: { id: 'other' } } as RawCartItem] }),
      );

      await expect(wishlistService.updateItemQuantity('prod-1', 2)).rejects.toThrow('Wishlist item not found');
    });

    it('throws "Price missing" when no live price is available — unpriced items cannot be re-quantified', async () => {
      mockCartApi.getCartByCriteria.mockResolvedValue(
        makeRawCart({
          items: [{ id: 'line-1', product: { id: 'prod-1' }, quantity: 1 } as RawCartItem],
        }),
      );
      mockPriceService.getProductPrice.mockResolvedValue(null);

      await expect(wishlistService.updateItemQuantity('prod-1', 5)).rejects.toThrow('Price missing');
      expect(mockCartApi.updateCartItemQuantity).not.toHaveBeenCalled();
    });

    it('issues an Emporix update with the full price payload (priceId, effective/original amounts)', async () => {
      const rawCart = makeRawCart({
        items: [{ id: 'line-1', product: { id: 'prod-1' }, quantity: 1 } as RawCartItem],
      });
      mockCartApi.getCartByCriteria.mockResolvedValue(rawCart);
      mockCartApi.getCart.mockResolvedValue(rawCart);
      mockPriceService.getProductPrice.mockResolvedValue(
        makeProductPrice({ id: 'price-99', amount: 12.5, originalAmount: 15, currency: 'EUR' }),
      );

      await wishlistService.updateItemQuantity('prod-1', 4);

      expect(mockCartApi.updateCartItemQuantity).toHaveBeenCalledWith('wl-cart-1', 'line-1', {
        quantity: 4,
        price: { priceId: 'price-99', effectiveAmount: 12.5, originalAmount: 15, currency: 'EUR' },
      });
    });
  });

  describe('removeItem', () => {
    it('throws when the wishlist does not exist', async () => {
      mockCartApi.getCartByCriteria.mockResolvedValue(null);
      await expect(wishlistService.removeItem('prod-1')).rejects.toThrow('Wishlist not found');
    });

    it('throws when the product is not on the wishlist', async () => {
      mockCartApi.getCartByCriteria.mockResolvedValue(makeRawCart({ items: [] }));
      await expect(wishlistService.removeItem('prod-1')).rejects.toThrow('Wishlist item not found');
    });

    it('auto-deletes the wishlist when removing the last item, returning null', async () => {
      const before = makeRawCart({
        items: [{ id: 'line-1', product: { id: 'prod-1' } } as RawCartItem],
      });
      const afterRemove = makeRawCart({ items: [] });
      mockCartApi.getCartByCriteria.mockResolvedValue(before);
      mockCartApi.getCart.mockResolvedValue(afterRemove);

      const result = await wishlistService.removeItem('prod-1');

      expect(mockCartApi.removeCartItem).toHaveBeenCalledWith('wl-cart-1', 'line-1');
      expect(mockCartApi.deleteCart).toHaveBeenCalledWith('wl-cart-1');
      expect(result).toBeNull();
    });

    it('returns the enriched wishlist when items still remain after remove', async () => {
      const before = makeRawCart({
        items: [
          { id: 'line-1', product: { id: 'prod-1' } } as RawCartItem,
          { id: 'line-2', product: { id: 'prod-2' } } as RawCartItem,
        ],
      });
      const afterRemove = makeRawCart({
        items: [{ id: 'line-2', product: { id: 'prod-2' } } as RawCartItem],
      });
      mockCartApi.getCartByCriteria.mockResolvedValue(before);
      mockCartApi.getCart.mockResolvedValue(afterRemove);
      mockMapper.mapToService.mockReturnValue(
        makeMappedWishlist({ items: [makeMappedWishlistItem({ productId: 'prod-2' })] }),
      );

      const result = await wishlistService.removeItem('prod-1');

      expect(mockCartApi.deleteCart).not.toHaveBeenCalled();
      expect(result).not.toBeNull();
      expect(result!.items[0].productId).toBe('prod-2');
    });
  });

  describe('moveItemToCart', () => {
    const shopCart: Cart = {
      id: 'shop-cart-1',
      siteCode: 'main',
      currency: 'EUR',
      items: [],
      totalQuantity: 0,
    } as unknown as Cart;

    function primeWishlistWithSingleItem() {
      const raw = makeRawCart({
        items: [{ id: 'line-1', product: { id: 'prod-1' }, quantity: 2 } as RawCartItem],
      });
      mockCartApi.getCartByCriteria.mockResolvedValue(raw);
      mockCartApi.getCart.mockResolvedValue(makeRawCart({ items: [] }));
    }

    it('adds to the shopping cart BEFORE removing from the wishlist', async () => {
      primeWishlistWithSingleItem();
      mockCartService.getCart.mockResolvedValue(shopCart);
      mockCartService.getCartById.mockResolvedValue(shopCart);

      await wishlistService.moveItemToCart('prod-1');

      const addOrder = mockCartService.addItemToCart.mock.invocationCallOrder[0];
      const removeOrder = mockCartApi.removeCartItem.mock.invocationCallOrder[0];
      expect(addOrder).toBeLessThan(removeOrder);
      // The wishlist line quantity is used as the cart-add quantity.
      expect(mockCartService.addItemToCart).toHaveBeenCalledWith('shop-cart-1', 'prod-1', 2);
    });

    it('creates a shopping cart on the fly when the customer has none yet', async () => {
      primeWishlistWithSingleItem();
      mockCartService.getCart.mockResolvedValue(null);
      mockCartService.getCartById.mockResolvedValue(shopCart);

      await wishlistService.moveItemToCart('prod-1');

      expect(mockCartService.createCart).toHaveBeenCalledWith('EUR', 'main');
      expect(mockCartService.getCartById).toHaveBeenCalledWith('shop-cart-1');
    });

    it('propagates the cart-add status fields (status + statusDetailCode + statusDetailPayload) verbatim', async () => {
      primeWishlistWithSingleItem();
      mockCartService.getCart.mockResolvedValue(shopCart);
      mockCartService.getCartById.mockResolvedValue(shopCart);
      mockCartService.addItemToCart.mockResolvedValue({
        cartItem: { id: 'sc-item-1' } as unknown as ModifyCartItemResult['cartItem'],
        status: 'PENDING',
        statusDetailCode: 'addToCart.insufficientStock',
        statusDetailPayload: { availableQuantity: 1 },
      });

      const result = await wishlistService.moveItemToCart('prod-1');

      expect(result.status).toBe('PENDING');
      expect(result.statusDetailCode).toBe('addToCart.insufficientStock');
      expect(result.statusDetailPayload).toEqual({ availableQuantity: 1 });
      expect(result.partialFailure).toBeUndefined();
    });

    it('returns partialFailure="wishlist-remove-failed" when cart-add succeeds but wishlist remove throws', async () => {
      primeWishlistWithSingleItem();
      mockCartService.getCart.mockResolvedValue(shopCart);
      mockCartService.getCartById.mockResolvedValue(shopCart);
      mockCartApi.removeCartItem.mockRejectedValue(new Error('Emporix had a moment'));

      const result = await wishlistService.moveItemToCart('prod-1');

      // Cart is still in the result — partial failure must not roll the cart back.
      expect(result.cart).toBe(shopCart);
      expect(result.partialFailure).toBe('wishlist-remove-failed');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('does NOT touch the wishlist when the cart-side add throws', async () => {
      primeWishlistWithSingleItem();
      mockCartService.getCart.mockResolvedValue(shopCart);
      mockCartService.addItemToCart.mockRejectedValue(new Error('Cart add failed'));

      await expect(wishlistService.moveItemToCart('prod-1')).rejects.toThrow('Cart add failed');
      expect(mockCartApi.removeCartItem).not.toHaveBeenCalled();
    });
  });

  describe('enrichment', () => {
    it('excludes both deactivated AND unpriced items from totalKnownPrice', async () => {
      const rawCart = makeRawCart({
        items: [
          { id: 'l-a', product: { id: 'prod-a' }, quantity: 1 } as RawCartItem,
          { id: 'l-b', product: { id: 'prod-b' }, quantity: 2 } as RawCartItem,
          { id: 'l-c', product: { id: 'prod-c' }, quantity: 3 } as RawCartItem,
        ],
      });
      mockCartApi.getCartByCriteria.mockResolvedValue(rawCart);
      mockMapper.mapToService.mockReturnValue(
        makeMappedWishlist({
          items: [
            makeMappedWishlistItem({ id: 'l-a', productId: 'prod-a', quantity: 1 }),
            makeMappedWishlistItem({ id: 'l-b', productId: 'prod-b', quantity: 2 }),
            makeMappedWishlistItem({ id: 'l-c', productId: 'prod-c', quantity: 3 }),
          ],
        }),
      );
      // prod-a is deactivated (purchasable=false) → excluded from total
      // prod-b is unpriced → excluded
      // prod-c is actionable → INCLUDED at amount 7 * qty 3 = 21
      mockProductService.getProductById.mockImplementation(async (id: string) => {
        if (id === 'prod-a') return { ...widgetProduct, id: 'prod-a', purchasable: false } as Product;
        return { ...widgetProduct, id } as Product;
      });
      mockPriceService.getProductPrices.mockResolvedValue(
        new Map<string, ProductPrice | null>([
          ['prod-a', makeProductPrice({ productId: 'prod-a', amount: 5 })],
          ['prod-b', null],
          ['prod-c', makeProductPrice({ productId: 'prod-c', amount: 7 })],
        ]),
      );

      const result = await wishlistService.getDefaultWishlist();

      expect(result!.items.find((i) => i.productId === 'prod-a')?.isPurchasable).toBe(false);
      expect(result!.items.find((i) => i.productId === 'prod-b')?.hasCurrentPrice).toBe(false);
      expect(result!.totalKnownPrice?.gross.amount).toBe(21);
    });

    it('falls back to the unenriched wishlist when an enrichment step crashes unexpectedly', async () => {
      const rawCart = makeRawCart({
        items: [{ id: 'line-1', product: { id: 'prod-1' }, quantity: 1 } as RawCartItem],
      });
      mockCartApi.getCartByCriteria.mockResolvedValue(rawCart);
      mockMapper.mapToService.mockReturnValue(makeMappedWishlist({ items: [makeMappedWishlistItem()] }));
      // Simulate an unexpected synchronous throw inside the enrichment pipeline
      mockPriceService.getProductPrices.mockResolvedValue(null as unknown as Map<string, ProductPrice | null>);

      const result = await wishlistService.getDefaultWishlist();

      expect(result).not.toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ cartId: 'wl-cart-1' }),
        expect.stringContaining('Wishlist enrichment failed unexpectedly'),
      );
    });
  });
});
