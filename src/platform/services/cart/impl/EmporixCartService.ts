import { inject } from 'inversify';
import { l10n } from '@/lib/utils';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCartApi } from '@/platform/integrations/emporix/cart/EmporixCartApi';
import type EmporixCommonUtil from '@/platform/integrations/emporix/common/util/EmporixCommonUtil';
import { EmporixAddCartItemRequest, EmporixUpdateCartItemRequest } from '@/platform/integrations/emporix/model';
import { EmporixCart, EmporixCartItem } from '@/platform/integrations/emporix/model/cart';
import type { CartService, ModifyCartItemResult } from '@/platform/services/cart/CartService';
import type { CartStatus, CartStatusDetailCode } from '@/platform/services/cart/CartService';
import type { Cart } from '@/platform/services/model/cart/cart';
import type { PriceService } from '@/platform/services/price/PriceService';
import type { ProductService } from '@/platform/services/product/ProductService';
import type { StockService } from '@/platform/services/stock/StockService';
import type { CartMapper } from '../../model/cart/CartMapper';
import { Media, Paginated, PaginationQuery } from '../../model/common';
import type { SessionService } from '../../session/SessionService';

/**
 * Implementation of CartService for Emporix cart data.
 * Maps between Emporix API cart format and internal Cart model.
 */
@injectable('CartService', 'Singleton')
class EmporixCartService implements CartService {
  constructor(
    @inject('EmporixCommonUtil') private commonUtil: EmporixCommonUtil,
    @inject('EmporixCartApi') private cartApi: EmporixCartApi,
    @inject('EmporixCartMapper') private mapper: CartMapper<EmporixCart, EmporixCartItem>,
    @inject('SessionService') private sessionService: SessionService,
    @inject('PriceService') private priceService: PriceService,
    @inject('ProductService') private productService: ProductService,
    @inject('StockService') private stockService: StockService,
  ) {}

  async createCart(currency: string, siteCode: string): Promise<string> {
    // TODO extract these information to a SiteConfigService
    const createCartRequest = {
      siteCode,
      currency,
      type: 'shopping',
      channel: {
        name: 'storefront',
        source: process.env.NEXT_PUBLIC_SERVER_URL || 'https://showcase.emporix.io',
      },
      sessionValidated: true,
    };
    try {
      const cartId = await this.cartApi.createCart(createCartRequest);
      return cartId;
    } catch (error) {
      // only business error can be that it's a duplicate
      if (error instanceof Error && error.message.includes('Duplicate key found for a unique index.')) {
        const existingCart = await this.getCart();
        if (!existingCart) {
          throw new Error('Failed to get session cart');
        }
        return existingCart.id;
      }
      throw error;
    }
  }

  async getCart(): Promise<Cart | null> {
    const session = await this.sessionService.getCurrent();
    if (!session) {
      throw new Error('Failed to get session context');
    }
    let cart;
    if (session.cartId) {
      cart = await this.cartApi.getCart(session.cartId);
    }
    // Fallback to search if no cart is assigned to session
    if (!cart) {
      cart = await this.cartApi.getCartByCriteria(session.siteCode || 'main', session.id, undefined, 'shopping');
      if (!cart && session.customerId) {
        cart = await this.cartApi.getCartByCriteria(
          session.siteCode || 'main',
          undefined,
          session.customerId,
          'shopping',
        );
      }
      if (cart) {
        await this.sessionService.setCart(cart.id);
      }
    }
    return cart ? this.mapper.mapToService(cart) : null;
  }

  async getCartById(id: string, checkSession = true): Promise<Cart | null> {
    const cart = await this.cartApi.getCart(id, checkSession);
    if (!cart) {
      return null;
    }
    return this.mapper.mapToService(cart);
  }

  async addItemToCart(cartId: string, productId: string, quantity: number): Promise<ModifyCartItemResult> {
    const [product, price, session] = await Promise.all([
      this.productService.getProductById(productId),
      this.priceService.getProductPrice(productId, quantity),
      this.sessionService.getCurrent(),
    ]);
    if (!product) {
      throw new Error('Product missing');
    }
    // TODO find existing cartItem and merge if desired
    if (!price) {
      throw new Error('Price missing');
    }
    const { hasSufficientStock, availableQuantity } = await this.checkStock(
      session.siteCode || 'main',
      productId,
      quantity,
    );

    const addItemRequest: EmporixAddCartItemRequest = {
      siteCode: session.siteCode || 'main',
      itemYrn: this.commonUtil.generateProductYrn(productId),
      quantity,
      product: {
        id: productId,
        name: l10n(product.name, session.language),
        description: l10n(product.description, session.language),
        sku: product.sku,
        images: product.images?.map((img: Media) => ({
          id: img.url,
          url: img.url,
        })),
      },
      price: {
        priceId: price.id,
        effectiveAmount: price.amount,
        originalAmount: price.originalAmount || price.amount,
        currency: price.currency,
      },
    };
    // Add item to cart regardless of stock availability
    // (we determine availability for information and handle the surplus asynchronously)
    const itemId = await this.cartApi.addItemToCart(cartId, addItemRequest);

    const cart = await this.getCartById(cartId);
    const cartItem = cart?.items.find((item) => item.id === itemId);
    if (!cartItem) {
      throw new Error('Cart item not found');
    }
    // Return result with appropriate status
    return {
      cartItem: cartItem,
      status: (hasSufficientStock ? 'OK' : 'PENDING') as CartStatus,
      statusDetailCode: (hasSufficientStock ? undefined : 'addToCart.insufficientStock') as CartStatusDetailCode,
      statusDetailPayload: { availableQuantity },
    };
  }

  private async checkStock(site: string, productId: string, quantity: number) {
    let hasSufficientStock = true;
    if (process.env.NEXT_CART_STOCK_CHECK_ENABLED === 'true') {
      // Check if we have sufficient stock
      const stockAvailability = await this.stockService.getStockAvailability(site, productId);
      hasSufficientStock = quantity <= stockAvailability.availableQuantity;
      return { hasSufficientStock, availableQuantity: stockAvailability?.availableQuantity || 0 };
    }
    return { hasSufficientStock: true, availableQuantity: -1 };
  }

  async updateCartItemQuantity(cartId: string, itemId: string, quantity: number): Promise<ModifyCartItemResult> {
    const cart = await this.getCartById(cartId);
    const cartItem = cart?.items.find((item) => item.id === itemId);
    if (!cartItem || !cartItem.product?.id) {
      throw new Error('Cart item not found');
    }

    const [price] = await Promise.all([this.priceService.getProductPrice(cartItem.product.id, quantity)]);

    if (!price) {
      throw new Error('Price missing');
    }

    const updateRequest: EmporixUpdateCartItemRequest = {
      quantity,
      price: {
        effectiveAmount: price.amount,
        originalAmount: price.originalAmount || price.amount,
        currency: price.currency,
      },
    };

    const { hasSufficientStock, availableQuantity } = await this.checkStock(
      cart?.site || 'main',
      cartItem.product.id,
      quantity,
    );
    await this.cartApi.updateCartItemQuantity(cartId, itemId, updateRequest);

    // Update Item
    cartItem.quantity = quantity;
    cartItem.price.amount = updateRequest.price.effectiveAmount;
    cartItem.price.currency = updateRequest.price.currency;
    cartItem.price.originalAmount = updateRequest.price.originalAmount;

    return {
      cartItem: cartItem,
      status: (hasSufficientStock ? 'OK' : 'PENDING') as CartStatus,
      statusDetailCode: (hasSufficientStock ? undefined : 'addToCart.insufficientStock') as CartStatusDetailCode,
      statusDetailPayload: { availableQuantity },
    };
  }

  async removeCartItem(cartId: string, itemId: string): Promise<void> {
    await this.cartApi.removeCartItem(cartId, itemId);
  }

  async deleteCart(cartId: string): Promise<void> {
    await this.cartApi.deleteCart(cartId);
  }

  async updateShippingInfo(cartId: string, countryCode?: string, zipCode?: string): Promise<void> {
    // TODO Not used because of inconsistent Session/cart Handling
    // Get the session cart and update it
    const cart = await this.cartApi.getCart(cartId);
    if (!cart) {
      throw new Error('Cart not found');
    }
    await this.cartApi.updateCart(cartId, {
      ...cart,
      metadata: {
        ...cart.metadata,
        version: (cart.metadata?.version ?? 0) + 1,
      },
      countryCode,
      zipCode,
    });
    await this.cartApi.refreshCart(cartId);
  }

  async updateCurrency(cartId: string, currency: string): Promise<void> {
    await this.cartApi.changeCurrency(cartId, currency);
    await this.cartApi.refreshCart(cartId);
  }

  async updateSite(cartId: string, siteCode: string): Promise<void> {
    await this.cartApi.changeSite(cartId, siteCode);
    await this.cartApi.refreshCart(cartId);
  }

  async getSavedCarts(pagination: PaginationQuery): Promise<Paginated<Cart>> {
    const session = await this.sessionService.getCurrent();
    if (!session?.customerId) {
      throw new Error('Saved Carts not available for Anonymous Sessions');
    }
    const carts = await this.cartApi.searchCarts({
      ...pagination,
      criteria: {
        customerId: session.customerId,
        type: '~shopping-',
      },
    });
    return {
      items: carts.items.map((cart) => this.mapper.mapToService(cart)),
      page: carts.page,
      pageSize: carts.size,
      total: carts.total,
    };
  }

  async saveCart(cartId: string, type: string = 'shopping'): Promise<void> {
    const session = await this.sessionService.getCurrent();
    if (!session?.customerId) {
      throw new Error('Saved Carts not available for Anonymous Sessions');
    }
    await this.cartApi.updateCart(cartId, {
      type: `${type}-${cartId}`,
    });
    this.sessionService.setCart(cartId);
  }

  async loadCart(cartId: string, type: string = 'shopping'): Promise<void> {
    const [cart, session] = await Promise.all([this.cartApi.getCart(cartId), this.sessionService.getCurrent()]);
    if (!session?.customerId) {
      throw new Error('Saved Carts not available for Anonymous Sessions');
    }
    if (!cart) {
      throw new Error('Cart not found');
    }
    if (session?.cartId) {
      // Save Current Cart before switching
      await this.saveCart(session.cartId, type);
    }
    this.cartApi.updateCart(cartId, {
      type: `${type}-${cartId}`,
    });
    // lazy update to prevent refetching
    this.sessionService.setCart(cartId);
  }

  /**
   * Get cart by criteria (siteCode, sessionId, customerId, type)
   * Useful for retrieving carts when you don't have the cart ID but have other identifiers
   *
   * @param siteCode - The site code to filter by
   * @param sessionId - The session ID to filter by
   * @param customerId - The customer ID to filter by
   * @param type - The cart type to filter by (e.g., 'shopping')
   * @returns The mapped cart or null if not found
   */
  async getCartByCriteria(
    siteCode: string,
    sessionId: string,
    customerId?: string,
    type: string = 'shopping',
  ): Promise<Cart | null> {
    try {
      const cart = await this.cartApi.getCartByCriteria(siteCode, sessionId, customerId, type);
      return cart ? this.mapper.mapToService(cart) : null;
    } catch (error) {
      console.error('Error getting cart by criteria:', error);
      return null;
    }
  }
}

export default EmporixCartService;
