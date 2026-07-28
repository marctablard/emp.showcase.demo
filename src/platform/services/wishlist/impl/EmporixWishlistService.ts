import { inject } from 'inversify';
import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import { baseUrl } from '@/lib/utils';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCartApi } from '@/platform/integrations/emporix/cart/EmporixCartApi';
import type EmporixCommonUtil from '@/platform/integrations/emporix/common/util/EmporixCommonUtil';
import type { EmporixAddCartItemRequest, EmporixUpdateCartItemRequest } from '@/platform/integrations/emporix/model';
import type {
  EmporixCart,
  EmporixCartItem,
  EmporixCreateCartRequest,
} from '@/platform/integrations/emporix/model/cart';
import type { CartService, CartStatus, CartStatusDetailCode } from '@/platform/services/cart/CartService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Cart } from '@/platform/services/model/cart/cart';
import type { Media } from '@/platform/services/model/common';
import type { ProductPrice } from '@/platform/services/model/price/price';
import type { Product } from '@/platform/services/model/product';
import type { Session } from '@/platform/services/model/session/session';
import type { WishlistMapper } from '@/platform/services/model/wishlist/WishlistMapper';
import type { Wishlist, WishlistItemKeySpec } from '@/platform/services/model/wishlist/wishlist';
import type { PriceService } from '@/platform/services/price/PriceService';
import type { ProductService } from '@/platform/services/product/ProductService';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { WishlistService } from '@/platform/services/wishlist/WishlistService';
import { WISHLIST_CART_TYPE } from '@/platform/services/wishlist/constants';

interface MoveItemToCartResult {
  wishlist: Wishlist | null;
  cart: Cart;
  partialFailure?: 'wishlist-remove-failed';
  status: CartStatus;
  statusDetailCode?: CartStatusDetailCode;
  statusDetailPayload?: { availableQuantity?: number } & Record<string, unknown>;
}

/**
 * Wishlist service backed by an Emporix cart of `type = wishlist`. Customer-scoped, never
 * touches the session's currentCart pointer, lazy-create + auto-delete on empty.
 */
@injectable('WishlistService', 'Singleton')
class EmporixWishlistService implements WishlistService {
  constructor(
    @inject('EmporixCartApi') private cartApi: EmporixCartApi,
    @inject('EmporixCommonUtil') private commonUtil: EmporixCommonUtil,
    @inject('EmporixWishlistMapper') private mapper: WishlistMapper<EmporixCart, EmporixCartItem>,
    @inject('CartService') private cartService: CartService,
    @inject('SessionService') private sessionService: SessionService,
    @inject('PriceService') private priceService: PriceService,
    @inject('ProductService') private productService: ProductService,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  async getDefaultWishlist(): Promise<Wishlist | null> {
    const { session, customerId } = await this.requireAuthenticatedSession();
    const rawCart = await this.resolveWishlistCart(session.siteCode, customerId);
    if (!rawCart) return null;
    return this.enrichWishlist(this.mapper.mapToService(rawCart), session);
  }

  async addItem(productId: string, quantity: number): Promise<Wishlist> {
    const { session, customerId } = await this.requireAuthenticatedSession();

    const existing = await this.resolveWishlistCart(session.siteCode, customerId);
    const initialCart = existing ?? (await this.createWishlistCart(session, customerId));
    const wishlistCart = await this.ensureWishlistCurrencyMatchesSession(initialCart, session);
    const siteCode = wishlistCart.siteCode || session.siteCode;

    const product = await this.productService.getProductById(productId);
    if (!product) {
      throw new Error('Product missing');
    }

    const existingLine = wishlistCart.items?.find((i) => i.product?.id === productId);
    if (existingLine) {
      // Wishlist invariant: one line per product. Merge by incrementing quantity instead of
      // duplicating. Merge REQUIRES a current price (Emporix rejects price-less updates).
      const newQuantity = existingLine.quantity + quantity;
      const price = await this.getPriceFor(productId, newQuantity, siteCode, session);
      if (!price) throw new Error('Price missing');
      const updateRequest: EmporixUpdateCartItemRequest = {
        quantity: newQuantity,
        price: this.buildPricePayload(price),
      };
      await this.withStalePriceRecovery(wishlistCart.id, () =>
        this.cartApi.updateCartItemQuantity(wishlistCart.id, existingLine.id, updateRequest),
      );
    } else {
      const price = await this.getPriceFor(productId, quantity, siteCode, session);
      if (!price) throw new Error('Price missing');
      const addItemRequest: EmporixAddCartItemRequest = {
        siteCode,
        itemYrn: this.commonUtil.generateProductYrn(productId),
        quantity,
        product: {
          id: productId,
          ...this.buildProductNamePayload(product.name),
          sku: product.sku,
          images: product.images?.map((img: Media) => ({ id: img.url, url: img.url })),
        },
        price: this.buildPricePayload(price),
      };
      await this.withStalePriceRecovery(wishlistCart.id, () =>
        this.cartApi.addItemToCart(wishlistCart.id, addItemRequest),
      );
    }

    return this.refreshAndEnrich(wishlistCart.id, session, 'Wishlist not found after adding item');
  }

  async updateItemQuantity(productId: string, quantity: number): Promise<Wishlist> {
    const { session, customerId } = await this.requireAuthenticatedSession();

    const initialCart = await this.resolveWishlistCart(session.siteCode, customerId);
    if (!initialCart) throw new Error('Wishlist not found');

    const wishlistCart = await this.ensureWishlistCurrencyMatchesSession(initialCart, session);
    const line = this.findLineByProductId(wishlistCart, productId);
    if (!line) throw new Error('Wishlist item not found');

    const siteCode = wishlistCart.siteCode || session.siteCode;
    const price = await this.getPriceFor(productId, quantity, siteCode, session);
    if (!price) throw new Error('Price missing');

    const updateRequest: EmporixUpdateCartItemRequest = {
      quantity,
      price: this.buildPricePayload(price),
    };
    await this.withStalePriceRecovery(wishlistCart.id, () =>
      this.cartApi.updateCartItemQuantity(wishlistCart.id, line.id, updateRequest),
    );

    return this.refreshAndEnrich(wishlistCart.id, session, 'Wishlist not found after quantity update');
  }

  async removeItem(productId: string): Promise<Wishlist | null> {
    const { session, customerId } = await this.requireAuthenticatedSession();

    const wishlistCart = await this.resolveWishlistCart(session.siteCode, customerId);
    if (!wishlistCart) throw new Error('Wishlist not found');

    const line = this.findLineByProductId(wishlistCart, productId);
    if (!line) throw new Error('Wishlist item not found');

    await this.cartApi.removeCartItem(wishlistCart.id, line.id);

    const refreshed = await this.cartApi.getCart(wishlistCart.id);
    if (!refreshed) return null;
    const finalized = await this.finalizeAfterRemove(refreshed);
    return finalized ? await this.enrichWishlist(finalized, session) : null;
  }

  async moveItemToCart(productId: string): Promise<MoveItemToCartResult> {
    const { session, customerId } = await this.requireAuthenticatedSession();

    const wishlistCart = await this.resolveWishlistCart(session.siteCode, customerId);
    if (!wishlistCart) throw new Error('Wishlist not found');

    const line = this.findLineByProductId(wishlistCart, productId);
    if (!line) throw new Error('Wishlist item not found');

    const quantity = line.quantity;
    const shoppingCart = await this.resolveOrCreateShoppingCart(session);

    // Add to cart FIRST — if this throws (e.g. missing price), the wishlist stays untouched.
    const cartAddResult = await this.cartService.addItemToCart(shoppingCart.id, productId, quantity);

    let wishlistResult: Wishlist | null;
    let partialFailure: 'wishlist-remove-failed' | undefined;
    try {
      await this.cartApi.removeCartItem(wishlistCart.id, line.id);
      const refreshed = await this.cartApi.getCart(wishlistCart.id);
      const finalized = refreshed ? await this.finalizeAfterRemove(refreshed) : null;
      wishlistResult = finalized ? await this.enrichWishlist(finalized, session) : null;
    } catch (error) {
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          wishlistCartId: wishlistCart.id,
          productId,
        },
        'Failed to remove item from wishlist after successful cart add — returning partial failure',
      );
      wishlistResult = await this.enrichWishlist(this.mapper.mapToService(wishlistCart), session);
      partialFailure = 'wishlist-remove-failed';
    }

    const finalCart = await this.cartService.getCartById(shoppingCart.id);
    if (!finalCart) throw new Error('Shopping cart not found after wishlist move');

    return {
      wishlist: wishlistResult,
      cart: finalCart,
      status: cartAddResult.status,
      statusDetailCode: cartAddResult.statusDetailCode,
      statusDetailPayload: cartAddResult.statusDetailPayload,
      ...(partialFailure ? { partialFailure } : {}),
    };
  }

  private async requireAuthenticatedSession(): Promise<{ session: Session; customerId: string }> {
    const session = await this.sessionService.getCurrent();
    if (!session) throw new Error('Failed to get session context');
    if (!isAuthenticatedSessionCustomerId(session.customerId)) {
      throw new Error('Wishlist requires an authenticated customer');
    }
    return { session, customerId: session.customerId };
  }

  private resolveWishlistCart(siteCode: string, customerId: string): Promise<EmporixCart | null> {
    return this.cartApi.getCartByCriteria(siteCode, undefined, customerId, WISHLIST_CART_TYPE, false);
  }

  private async createWishlistCart(session: Session, customerId: string): Promise<EmporixCart> {
    const createRequest: EmporixCreateCartRequest = {
      customerId,
      siteCode: session.siteCode,
      currency: session.currency,
      type: WISHLIST_CART_TYPE,
      channel: {
        name: 'storefront',
        source: baseUrl,
      },
      sessionValidated: true,
    };

    let cartId: string;
    try {
      cartId = await this.cartApi.createCart(createRequest);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Duplicate key found for a unique index.')) {
        const existing = await this.resolveWishlistCart(session.siteCode, customerId);
        if (existing) return existing;
      }
      throw error;
    }

    const created = await this.cartApi.getCart(cartId);
    if (!created) throw new Error('Wishlist not found after creation');
    this.logger.info({ cartId, customerId, siteCode: session.siteCode }, 'Created default wishlist');
    return created;
  }

  private async resolveOrCreateShoppingCart(session: Session): Promise<Cart> {
    const existing = await this.cartService.getCart();
    if (existing) return existing;
    const cartId = await this.cartService.createCart(session.currency, session.siteCode);
    const created = await this.cartService.getCartById(cartId);
    if (!created) throw new Error('Failed to create shopping cart for wishlist move');
    return created;
  }

  private findLineByProductId(wishlistCart: EmporixCart, productId: string): EmporixCartItem | undefined {
    return wishlistCart.items?.find((i) => i.product?.id === productId);
  }

  private getPriceFor(
    productId: string,
    quantity: number,
    siteCode: string,
    session: Session,
  ): Promise<ProductPrice | null> {
    return this.priceService.getProductPrice(productId, quantity, undefined, {
      siteCode,
      currency: session.currency,
      country: session.country,
    });
  }

  private buildPricePayload(price: ProductPrice) {
    return {
      priceId: price.id,
      effectiveAmount: price.amount,
      originalAmount: price.originalAmount ?? price.amount,
      currency: price.currency,
    };
  }

  /** Refetch the wishlist cart after a mutation, map + enrich, throw if it vanished. */
  private async refreshAndEnrich(cartId: string, session: Session, missingError: string): Promise<Wishlist> {
    const refreshed = await this.cartApi.getCart(cartId);
    if (!refreshed) throw new Error(missingError);
    return this.enrichWishlist(this.mapper.mapToService(refreshed), session);
  }

  private isStalePriceIdError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('PriceIds') && error.message.includes('invalid');
  }

  /**
   * Run a wishlist mutation, recovering once from "PriceIds invalid" by refreshing the cart
   * (which re-prices all existing lines) and retrying.
   */
  private async withStalePriceRecovery<T>(cartId: string, op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } catch (error) {
      if (!this.isStalePriceIdError(error)) throw error;
      this.logger.info({ cartId }, 'Wishlist line mutation hit stale priceId — refreshing and retrying');
      await this.cartApi.refreshCart(cartId);
      return op();
    }
  }

  /**
   * Align the wishlist's currency with the session before mutating. Emporix validates new
   * line prices against the cart's currency; if they differ, the mutation 400s.
   */
  private async ensureWishlistCurrencyMatchesSession(rawCart: EmporixCart, session: Session): Promise<EmporixCart> {
    const cartCur = (rawCart.currency ?? '').trim().toUpperCase();
    const sessionCur = (session.currency ?? '').trim().toUpperCase();
    if (!cartCur || !sessionCur || cartCur === sessionCur) return rawCart;

    this.logger.info(
      { cartId: rawCart.id, cartCurrency: rawCart.currency, sessionCurrency: session.currency },
      'Aligning wishlist currency with session before line mutation',
    );
    await this.cartApi.changeCurrency(rawCart.id, session.currency);
    const refreshed = await this.cartApi.getCart(rawCart.id);
    if (!refreshed) throw new Error('Wishlist not found after currency alignment');
    return refreshed;
  }

  private async enrichWishlist(wishlist: Wishlist, session: Session): Promise<Wishlist> {
    try {
      if (wishlist.items.length === 0) return wishlist;

      const productIds = wishlist.items.map((item) => item.productId);
      const [products, prices] = await Promise.all([
        Promise.all(
          productIds.map((id) =>
            this.productService.getProductById(id).catch((error) => {
              this.logger.warn(
                { err: error instanceof Error ? error.message : String(error), productId: id },
                'Wishlist enrichment: product lookup failed — treating as non-purchasable',
              );
              return null;
            }),
          ),
        ),
        this.priceService
          .getProductPrices(productIds, undefined, undefined, {
            siteCode: wishlist.siteCode,
            currency: session.currency,
            country: session.country,
          })
          .catch((error) => {
            this.logger.warn(
              { err: error instanceof Error ? error.message : String(error) },
              'Wishlist enrichment: batch price lookup failed — treating all items as unpriced',
            );
            return new Map<string, null>();
          }),
      ]);

      const enrichedItems = wishlist.items.map((item, index) => {
        const product = products[index];
        const livePrice = prices.get(item.productId);
        const hasCurrentPrice = livePrice != null;

        let price = item.price;
        if (livePrice) {
          const gross = livePrice.tax?.grossValue ?? livePrice.amount;
          const net = livePrice.tax?.netValue ?? livePrice.amount;
          const hasDiscount = livePrice.originalAmount != null && livePrice.originalAmount !== livePrice.amount;
          price = {
            gross: {
              amount: gross,
              currency: livePrice.currency,
              ...(hasDiscount ? { originalAmount: livePrice.originalAmount } : {}),
            },
            net: { amount: net, currency: livePrice.currency },
          };
        }

        return {
          ...item,
          isPurchasable: !!product && product.purchasable === true,
          hasCurrentPrice,
          price,
          keySpecs: this.buildKeySpecs(product),
        };
      });

      const pricedItems = enrichedItems.filter((i) => i.isPurchasable && i.hasCurrentPrice && i.price);
      const totalKnownPrice =
        pricedItems.length > 0
          ? {
              gross: {
                amount: pricedItems.reduce((sum, i) => sum + i.price!.gross.amount * i.quantity, 0),
                currency: pricedItems[0].price!.gross.currency,
              },
              net: {
                amount: pricedItems.reduce((sum, i) => sum + i.price!.net.amount * i.quantity, 0),
                currency: pricedItems[0].price!.net.currency,
              },
            }
          : undefined;

      return { ...wishlist, items: enrichedItems, totalKnownPrice };
    } catch (error) {
      this.logger.warn(
        {
          err: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          cartId: wishlist.id,
        },
        'Wishlist enrichment failed unexpectedly — returning unenriched wishlist',
      );
      return wishlist;
    }
  }

  private async finalizeAfterRemove(rawCart: EmporixCart): Promise<Wishlist | null> {
    if (!rawCart.items?.length) {
      try {
        await this.cartApi.deleteCart(rawCart.id);
        this.logger.info({ cartId: rawCart.id }, 'Deleted empty default wishlist');
        return null;
      } catch (error) {
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error), cartId: rawCart.id },
          'Failed to delete empty wishlist — returning mapped empty wishlist',
        );
      }
    }
    return this.mapper.mapToService(rawCart);
  }

  private buildProductNamePayload(name: Product['name'] | undefined): {
    name?: string;
    localizedName?: { [language: string]: string };
  } {
    if (typeof name === 'string') return { name };
    if (name && typeof name === 'object') {
      return { localizedName: { ...(name as { [language: string]: string }) } };
    }
    return {};
  }

  /** Same shape as the PDP "Key Specs" block — variant attributes then template attributes. */
  private buildKeySpecs(product: Product | null | undefined): WishlistItemKeySpec[] | undefined {
    if (!product) return undefined;
    const specs: WishlistItemKeySpec[] = [];

    for (const attribute of product.variantAttributes ?? []) {
      const value = product.variantAttributeValues?.[attribute.key];
      if (value === undefined || value === null || value === '') continue;
      specs.push({
        key: attribute.key,
        labelKey: `filters.mixins.productVariantAttributes.${attribute.key}`,
        value,
        source: 'variant',
      });
    }

    const template = product.templateAttributes ?? {};
    for (const key of Object.keys(template)) {
      const value = template[key];
      if (value === undefined || value === null || value === '') continue;
      specs.push({
        key,
        labelKey: `filters.mixins.productTemplateAttributes.${key}`,
        value,
        source: 'template',
      });
    }

    return specs.length > 0 ? specs : undefined;
  }
}

export default EmporixWishlistService;
