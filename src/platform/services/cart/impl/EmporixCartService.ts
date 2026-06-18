import { inject } from 'inversify';
import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import { baseUrl } from '@/lib/utils';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCartApi } from '@/platform/integrations/emporix/cart/EmporixCartApi';
import type EmporixCommonUtil from '@/platform/integrations/emporix/common/util/EmporixCommonUtil';
import type { EmporixAddCartItemRequest, EmporixUpdateCartItemRequest } from '@/platform/integrations/emporix/model';
import type { EmporixCart, EmporixCartAddress, EmporixCartItem } from '@/platform/integrations/emporix/model/cart';
import type { CartService, CartShippingAddress, ModifyCartItemResult } from '@/platform/services/cart/CartService';
import type { CartStatus, CartStatusDetailCode } from '@/platform/services/cart/CartService';
import {
  CART_CURRENCY_UPDATE_ERROR_CODE,
  CartCurrencyUpdateError,
  extractUpstreamBody,
  extractUpstreamStatus,
} from '@/platform/services/cart/errors';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Cart } from '@/platform/services/model/cart/cart';
import type { Session } from '@/platform/services/model/session/session';
import type { PriceFetchOptions, PriceService } from '@/platform/services/price/PriceService';
import type { ProductService } from '@/platform/services/product/ProductService';
import type { StockService } from '@/platform/services/stock/StockService';
import type { CartMapper } from '../../model/cart/CartMapper';
import type { Media, Paginated, PaginationQuery } from '../../model/common';
import type { SessionService } from '../../session/SessionService';
import type { SiteService } from '../../site/SiteService';

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
    @inject('LoggerService') private logger: LoggerService,
    @inject('SiteService') private siteService: SiteService,
  ) {}

  private normalizeLegalEntityId(value: string | undefined): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  /**
   * Use explicit match-prices (site + session currency + country) for cart mutations.
   * `match-prices-by-context` can diverge from the shop session cookie when propagation lags,
   * which produced priceIds incompatible with the cart currency.
   */
  private explicitPriceParamsForCartOperation(session: Session, cartSiteCode: string): PriceFetchOptions {
    return {
      siteCode: cartSiteCode,
      currency: session.currency,
      country: session.country,
    };
  }

  private normalizeCurrencyCode(value: string | undefined): string {
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
  }

  /**
   * Emporix validates new line prices against the cart's pricing currency. If the cart still
   * carries a stale currency (e.g. site default while the session already switched), match-prices
   * for the session can yield a priceId that the cart API rejects ("PriceIds … from cart are invalid").
   */
  private async ensureCartCurrencyMatchesSessionBeforeLineMutation(
    rawCart: EmporixCart,
    session: Session,
  ): Promise<EmporixCart> {
    const cartCur = this.normalizeCurrencyCode(rawCart.currency);
    const sessionCur = this.normalizeCurrencyCode(session.currency);
    if (!cartCur || !sessionCur || cartCur === sessionCur) {
      return rawCart;
    }

    this.logger.info(
      { cartId: rawCart.id, cartCurrency: rawCart.currency, sessionCurrency: session.currency },
      'Aligning cart currency with session before cart line mutation',
    );
    await this.updateCurrency(rawCart.id, session.currency);
    const refreshed = await this.cartApi.getCart(rawCart.id);
    if (!refreshed) {
      throw new Error('Cart not found after currency alignment');
    }
    return refreshed;
  }

  private isCartOptimisticLockConflict(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    const m = error.message;
    return m.includes('optimistic_locking') && m.includes('metadata.version');
  }

  /**
   * B2B: when the session carries a legal entity, the cart must use the same `legalEntityId`.
   * Otherwise we clear the session cart pointer and return null so callers can create an empty cart.
   */
  private async ensureCartMatchesSessionLegalEntity(
    cart: EmporixCart | null | undefined,
    session: { legalEntityId?: string; cartId?: string },
  ): Promise<EmporixCart | null> {
    if (!cart) {
      return null;
    }
    const expected = this.normalizeLegalEntityId(session.legalEntityId);
    if (!expected) {
      return cart;
    }
    const onCart = this.normalizeLegalEntityId(cart.legalEntityId);
    if (onCart === expected) {
      return cart;
    }
    this.logger.info(
      {
        cartId: cart.id,
        cartLegalEntityId: cart.legalEntityId,
        sessionLegalEntityId: session.legalEntityId,
      },
      'Discarding cart — legalEntityId does not match session (no cross-company cart reuse)',
    );
    await this.sessionService.clearCart();
    return null;
  }

  async createCart(currency: string, siteCode: string): Promise<string> {
    // TODO extract these information to a SiteConfigService
    const createCartRequest = {
      siteCode,
      currency,
      type: 'shopping',
      channel: {
        name: 'storefront',
        source: baseUrl,
      },
      sessionValidated: true,
    };
    try {
      const cartId = await this.cartApi.createCart(createCartRequest);
      // Emporix POST /carts does not always persist `currentCart` on the session context immediately
      // for anonymous flows. Without this, GET /api/cart?create=true can return null (getCartById
      // / follow-up getCart) and the client shows "No cart available" until a full page reload.
      await this.sessionService.setCart(cartId);
      return cartId;
    } catch (error) {
      // Cart already exists for this session — Emporix returns either
      // 409 Conflict or a "Duplicate key found" error. Fall back to the existing cart.
      if (
        error instanceof Error &&
        (error.message.includes('Conflict') || error.message.includes('Duplicate key found for a unique index.'))
      ) {
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
    const currentSiteCode = session.siteCode;
    let cart;

    // Try to get cart by cached ID (trusted - cartId is cleared on site change in setSite())
    if (session.cartId) {
      cart = await this.cartApi.getCart(session.cartId);

      // Site guard: skip cart from a different site (race condition in setSite)
      if (cart && cart.siteCode !== currentSiteCode) {
        this.logger.info(
          { cartId: session.cartId, cartSite: cart.siteCode, currentSite: currentSiteCode },
          'Skipping cart from different site — searching for current site cart',
        );
        cart = undefined;
      }

      // Safety check: if user is logged in but the cached cart is anonymous,
      // discard it and search for the customer's actual cart.
      // This happens when the anonymous→customer cart merge didn't complete during login
      // (e.g. B2B legalEntityId filtering prevented finding the anonymous cart).
      if (cart && isAuthenticatedSessionCustomerId(session.customerId) && !cart.customerId) {
        this.logger.info(
          { cartId: session.cartId, customerId: session.customerId },
          'Skipping stale anonymous cart for logged-in user — searching for customer cart',
        );
        cart = undefined;
      }

      if (cart) {
        cart = await this.ensureCartMatchesSessionLegalEntity(cart, session);
      }
    }

    // Fallback to search by criteria if no valid cart found
    if (!cart) {
      const isAuthenticated = isAuthenticatedSessionCustomerId(session.customerId);
      const sessionLegalEntity = this.normalizeLegalEntityId(session.legalEntityId);
      const skipSessionIdCartFallback = isAuthenticated && sessionLegalEntity !== '';

      // For authenticated users, prefer customer-owned cart lookup first.
      // Never pass create=true here — auto-created carts use the site's default
      // currency which silently overwrites the session currency chosen by the user.
      // Cart creation with the correct currency is handled by the caller (API route).
      if (isAuthenticated) {
        try {
          cart = await this.cartApi.getCartByCriteria(
            currentSiteCode,
            undefined,
            session.customerId,
            'shopping',
            false,
          );
          cart = await this.ensureCartMatchesSessionLegalEntity(cart, session);
        } catch (error) {
          throw this.mapCartResolutionError(error, {
            fallbackCode: CART_CURRENCY_UPDATE_ERROR_CODE.FORBIDDEN,
            fallbackMessage: 'Failed to resolve customer cart after login',
          });
        }
      }

      // Anonymous or fallback lookup by session criteria — not used for authenticated B2B with a
      // session legalEntityId, otherwise session-scoped lookup could return another company's cart.
      if (!cart && !skipSessionIdCartFallback) {
        try {
          cart = await this.cartApi.getCartByCriteria(currentSiteCode, session.id, undefined, 'shopping', false);
          cart = await this.ensureCartMatchesSessionLegalEntity(cart, session);
        } catch (error) {
          throw this.mapCartResolutionError(error, {
            fallbackCode: CART_CURRENCY_UPDATE_ERROR_CODE.UPSTREAM_FAILURE,
            fallbackMessage: 'Failed to resolve session cart',
          });
        }
      }

      // Update session with correct cart ID if found/created
      if (cart) {
        await this.sessionService.setCart(cart.id);
      }
    }

    return cart ? this.mapper.mapToService(cart) : null;
  }

  async getCartById(id: string, checkSession = true): Promise<Cart | null> {
    const raw = await this.cartApi.getCart(id, checkSession);
    if (!raw) {
      return null;
    }
    if (checkSession) {
      const session = await this.sessionService.getCurrent();
      if (session) {
        const aligned = await this.ensureCartMatchesSessionLegalEntity(raw, session);
        if (!aligned) {
          return null;
        }
      }
    }
    return this.mapper.mapToService(raw);
  }

  async addItemToCart(cartId: string, productId: string, quantity: number): Promise<ModifyCartItemResult> {
    const [initialRawCart, product, session] = await Promise.all([
      this.cartApi.getCart(cartId),
      this.productService.getProductById(productId),
      this.sessionService.getCurrent(),
    ]);
    let rawCart = initialRawCart;
    if (!rawCart) {
      throw new Error('Cart not found');
    }
    if (!session) {
      throw new Error('Failed to get session context');
    }
    if (!product) {
      throw new Error('Product missing');
    }

    // Determine the cart's effective site code
    let cartSiteCode = rawCart.siteCode || session.siteCode;

    // GUARD: If cart belongs to a different site, auto-recover by fetching/creating the correct cart.
    // This handles race conditions where the session site changed but the cart ID wasn't updated yet.
    if (cartSiteCode !== session.siteCode) {
      this.logger.warn(
        { cartId, cartSite: cartSiteCode, sessionSite: session.siteCode },
        'Cart belongs to different site — auto-recovering correct cart',
      );
      const correctCart = await this.getCart();
      if (!correctCart) {
        throw new Error('Failed to get cart for current site');
      }
      // Prevent infinite recursion: if we got back the same cart, something is fundamentally wrong
      if (correctCart.id === cartId) {
        throw new Error(
          `Cart site mismatch cannot be resolved: cart ${cartId} site=${cartSiteCode}, session site=${session.siteCode}`,
        );
      }
      return this.addItemToCart(correctCart.id, productId, quantity);
    }

    rawCart = await this.ensureCartCurrencyMatchesSessionBeforeLineMutation(rawCart, session);
    cartSiteCode = rawCart.siteCode || session.siteCode;

    const price = await this.priceService.getProductPrice(
      productId,
      quantity,
      undefined,
      this.explicitPriceParamsForCartOperation(session, cartSiteCode),
    );

    // TODO find existing cartItem and merge if desired
    if (!price) {
      throw new Error('Price missing');
    }
    const { hasSufficientStock, availableQuantity } = await this.checkStock(cartSiteCode, productId, quantity);

    const productNamePayload: { name?: string; localizedName?: { [language: string]: string } } = {};
    if (typeof product.name === 'string') {
      productNamePayload.name = product.name;
    } else if (product.name && typeof product.name === 'object') {
      // Persist the full localized map on the cart line so the UI can resolve it per render.
      // This avoids stamping the language active at add time onto every subsequent view of the cart.
      productNamePayload.localizedName = { ...(product.name as { [language: string]: string }) };
    }

    const addItemRequest: EmporixAddCartItemRequest = {
      siteCode: cartSiteCode,
      itemYrn: this.commonUtil.generateProductYrn(productId),
      quantity,
      product: {
        id: productId,
        ...productNamePayload,
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
    const postAlignCartId = rawCart.id;
    const itemId = await this.cartApi.addItemToCart(postAlignCartId, addItemRequest);

    const cart = await this.getCartById(postAlignCartId);
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
    let cart = await this.getCartById(cartId);
    if (!cart) {
      throw new Error('Cart not found');
    }
    let cartItem = cart.items.find((item) => item.id === itemId);
    if (!cartItem || !cartItem.product?.id) {
      throw new Error('Cart item not found');
    }

    const cartSiteCode = cart.site;
    const session = await this.sessionService.getCurrent();

    // GUARD: Cart-session site alignment check.
    // Unlike addItemToCart, we don't auto-recover here because the user is interacting
    // with specific cart items — replacing the cart under them would be confusing.
    if (session && cartSiteCode !== session.siteCode) {
      this.logger.warn(
        { cartId, cartSite: cartSiteCode, sessionSite: session.siteCode },
        'Cart belongs to different site during quantity update — aborting',
      );
      throw new Error('Cart belongs to a different site. Please refresh the page.');
    }

    if (!session) {
      throw new Error('Failed to get session context');
    }

    const rawCartForCurrency = await this.cartApi.getCart(cartId);
    if (rawCartForCurrency) {
      const aligned = await this.ensureCartCurrencyMatchesSessionBeforeLineMutation(rawCartForCurrency, session);
      if (this.normalizeCurrencyCode(rawCartForCurrency.currency) !== this.normalizeCurrencyCode(aligned.currency)) {
        cart = await this.getCartById(cartId);
        if (!cart) {
          throw new Error('Cart not found');
        }
        cartItem = cart.items.find((item) => item.id === itemId);
        if (!cartItem || !cartItem.product?.id) {
          throw new Error('Cart item not found');
        }
      }
    }

    const price = await this.priceService.getProductPrice(
      cartItem.product.id,
      quantity,
      undefined,
      this.explicitPriceParamsForCartOperation(session, cartSiteCode),
    );

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

    const { hasSufficientStock, availableQuantity } = await this.checkStock(cart?.site, cartItem.product.id, quantity);
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

  /**
   * Refresh a cart with automatic cleanup of orphaned legalEntityId.
   *
   * The Emporix refreshCart endpoint rejects anonymous carts that have a legalEntityId set
   * ("Anonymous cart cannot be assigned to a legal entity"). This can happen when a previous
   * bug caused legalEntityId to be spread onto anonymous carts via updateCart. The field is
   * stored on the backend but may NOT be returned by the GET /carts/{id} endpoint, so we
   * cannot detect it preemptively — instead we catch the specific error, clear the field,
   * and retry the refresh.
   */
  private async refreshCartOnceWithCleanup(cartId: string): Promise<void> {
    try {
      await this.cartApi.refreshCart(cartId);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Anonymous cart cannot be assigned to a legal entity')) {
        // This error occurs when refreshCart is called on an anonymous cart using a customer
        // session token whose context includes a legalEntityId (B2B customer).
        // The legalEntityId comes from the SESSION CONTEXT, not the cart field itself,
        // so clearing it on the cart object won't help. Check if the cart is actually
        // anonymous and the session is logged-in — if so, this is a mismatched-cart
        // situation that should be resolved by switching to the customer's own cart.
        const freshCart = await this.cartApi.getCart(cartId);
        const session = await this.sessionService.getCurrent();

        if (freshCart && !freshCart.customerId && session?.customerId) {
          // The cart is anonymous but the user is logged in — this cart shouldn't be
          // operated on with the customer session. Log and re-throw to let the caller
          // handle it (e.g. by fetching the correct customer cart).
          this.logger.warn(
            { cartId, customerId: session.customerId },
            'Cannot refresh anonymous cart with customer session (legalEntityId from session context) — cart/session mismatch',
          );
          throw error;
        }

        // Fallback: if the cart has a customerId but still hits this error, try the
        // original cleanup approach (clear orphaned legalEntityId on the cart itself)
        this.logger.warn({ cartId }, 'Detected orphaned legalEntityId on cart — clearing before retry');
        if (!freshCart) {
          throw error;
        }

        await this.cartApi.updateCart(cartId, {
          metadata: {
            ...freshCart.metadata,
            version: (freshCart.metadata?.version ?? 0) + 1,
          },
          legalEntityId: '',
        } as Partial<EmporixCart>);

        // Retry refresh after cleanup
        await this.cartApi.refreshCart(cartId);
      } else {
        throw error;
      }
    }
  }

  /**
   * Emporix persists carts with optimistic locking. Concurrent updates (e.g. parallel
   * shipping PATCHes) can yield 409 on refresh; bounded retries with backoff match API guidance.
   */
  private async refreshCartWithCleanup(cartId: string): Promise<void> {
    const maxAttempts = 4;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await this.refreshCartOnceWithCleanup(cartId);
        return;
      } catch (error) {
        if (this.isCartOptimisticLockConflict(error) && attempt < maxAttempts - 1) {
          this.logger.warn({ cartId, attempt }, 'Cart refresh hit optimistic lock — retrying');
          await new Promise((r) => setTimeout(r, 45 * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }
  }

  private async updateShippingInfoOnce(
    cartId: string,
    shippingAddress: CartShippingAddress,
    billingAddress?: CartShippingAddress,
  ): Promise<void> {
    const cart = await this.cartApi.getCart(cartId);
    if (!cart) {
      throw new Error('Cart not found');
    }

    const addresses: EmporixCartAddress[] = [{ ...shippingAddress, type: 'SHIPPING' as const }];
    if (billingAddress) {
      addresses.push({ ...billingAddress, type: 'BILLING' as const });
    }

    await this.cartApi.updateCart(cartId, {
      metadata: {
        ...cart.metadata,
        version: (cart.metadata?.version ?? 0) + 1,
      },
      addresses,
    });
    await this.refreshCartWithCleanup(cartId);
  }

  async updateShippingInfo(
    cartId: string,
    shippingAddress: CartShippingAddress,
    billingAddress?: CartShippingAddress,
  ): Promise<void> {
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await this.updateShippingInfoOnce(cartId, shippingAddress, billingAddress);
        return;
      } catch (error) {
        if (this.isCartOptimisticLockConflict(error) && attempt < maxAttempts - 1) {
          this.logger.warn(
            { cartId, attempt },
            'Cart shipping update hit optimistic lock — retrying with fresh version',
          );
          await new Promise((r) => setTimeout(r, 55 * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }
  }

  async updateCurrency(cartId: string, currency: string): Promise<void> {
    const canonicalCart = await this.resolveCanonicalCartForCurrencyUpdate(cartId);
    const site = await this.siteService.getSite(canonicalCart.siteCode);
    if (!site) {
      throw new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.SITE_NOT_FOUND, 'Site not found');
    }

    if (!site.currencies.find((siteCurrency) => siteCurrency.code === currency || siteCurrency.id === currency)) {
      throw new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.UNSUPPORTED_CURRENCY, 'Currency not supported');
    }
    try {
      await this.cartApi.changeCurrency(canonicalCart.id, currency);
      await this.refreshCartWithCleanup(canonicalCart.id);
    } catch (error) {
      throw this.mapCartResolutionError(error, {
        fallbackCode: CART_CURRENCY_UPDATE_ERROR_CODE.UPSTREAM_FAILURE,
        fallbackMessage: 'Failed to update cart currency',
      });
    }

    if (canonicalCart.id !== cartId) {
      this.logger.info(
        { requestedCartId: cartId, canonicalCartId: canonicalCart.id },
        'Recovered stale cart id during currency update',
      );
    }
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
      this.logger.error({ err: error }, 'Error getting cart by criteria');
      return null;
    }
  }

  private async resolveCanonicalCartForCurrencyUpdate(cartId: string): Promise<EmporixCart> {
    const directCart = await this.cartApi.getCart(cartId);
    if (directCart) {
      return directCart;
    }

    const recoveredCart = await this.getCart();
    if (!recoveredCart) {
      throw new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.CART_NOT_FOUND, 'Cart not found');
    }

    const canonicalRawCart = await this.cartApi.getCart(recoveredCart.id);
    if (!canonicalRawCart) {
      throw new CartCurrencyUpdateError(
        CART_CURRENCY_UPDATE_ERROR_CODE.STALE_CART_ID,
        'Session cart id is stale and no canonical cart could be resolved',
      );
    }

    return canonicalRawCart;
  }

  private mapCartResolutionError(
    error: unknown,
    fallback: {
      fallbackCode: (typeof CART_CURRENCY_UPDATE_ERROR_CODE)[keyof typeof CART_CURRENCY_UPDATE_ERROR_CODE];
      fallbackMessage: string;
    },
  ): CartCurrencyUpdateError {
    if (error instanceof CartCurrencyUpdateError) {
      return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const upstreamStatus = extractUpstreamStatus(errorMessage);
    const upstreamBody = extractUpstreamBody(errorMessage);

    if (upstreamStatus === 403) {
      return new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.FORBIDDEN, 'Forbidden cart context', {
        upstreamStatus,
        upstreamBody,
      });
    }

    if (upstreamStatus === 400 || upstreamStatus === 409 || upstreamStatus === 422) {
      return new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.CONTEXT_MISMATCH, 'Cart context mismatch', {
        upstreamStatus,
        upstreamBody,
      });
    }

    if (upstreamStatus === 404) {
      return new CartCurrencyUpdateError(CART_CURRENCY_UPDATE_ERROR_CODE.CART_NOT_FOUND, 'Cart not found', {
        upstreamStatus,
        upstreamBody,
      });
    }

    return new CartCurrencyUpdateError(fallback.fallbackCode, fallback.fallbackMessage, {
      upstreamStatus,
      upstreamBody,
    });
  }
}

export default EmporixCartService;
