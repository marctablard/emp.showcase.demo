import type { Cart, CartItem } from '../model/cart/cart';
import type { Address } from '../model/common';
import type { CartCurrencyUpdateErrorCode } from './errors';

/**
 * Address data for cart-level shipping/tax context.
 * Subset of Address — only the fields relevant for cart address resolution.
 */
export type CartShippingAddress = Partial<Omit<Address, 'id' | 'isDefault' | 'geoLocation'>>;

/**
 * Cart status enum for tracking cart item availability
 */
export type CartStatus = 'OK' | 'PENDING';

/**
 * Cart status detail codes
 */
export type CartStatusDetailCode = 'addToCart.insufficientStock';

/**
 * Result of adding an item to cart with stock check
 */
export interface ModifyCartItemResult {
  /**
   * The ID of the added item
   */
  cartItem: CartItem;

  /**
   * Status of the cart after adding the item
   */
  status: CartStatus;

  /**
   * Detail code for the status (if applicable)
   */
  statusDetailCode?: CartStatusDetailCode;

  /**
   * Additional payload for the status detail code (if applicable)
   */
  statusDetailPayload?: any;
}

export interface CartCurrencyUpdateFailure {
  code: CartCurrencyUpdateErrorCode;
  message: string;
}

/**
 * Interface for cart service.
 * Defines methods for cart operations.
 */
export interface CartService {
  /**
   * Creates a new cart
   * @param currency Currency code for the cart
   * @param siteCode Site code for the cart
   * @returns The ID of the created cart
   */
  createCart(currency: string, siteCode: string): Promise<string>;

  /**
   * Retrieves the current Sessions Cart.
   * @returns The cart if found, otherwise undefined.
   */
  getCart(): Promise<Cart | null>;

  /**
   * Retrieves a cart by its ID.
   * @param id The ID of the cart to retrieve.
   * @param checkSession Whether to check Session-Ownership of the Cart
   * @returns The cart if found, otherwise undefined.
   */
  getCartById(id: string, checkSession?: boolean): Promise<Cart | null>;

  /**
   * Adds an item to a cart with stock checking
   * @param cartId The ID of the cart
   * @param productId The ID of the product to add
   * @param quantity The quantity to add
   * @returns Result containing item ID, cart status, and updated cart
   */
  addItemToCart(cartId: string, productId: string, quantity: number): Promise<ModifyCartItemResult>;

  /**
   * Updates the quantity of an item in the cart with stock checking
   * @param cartId The ID of the cart
   * @param itemId The ID of the item to update
   * @param quantity The new quantity
   * @returns Result containing updated cart item, cart status, and status detail code
   */
  updateCartItemQuantity(cartId: string, itemId: string, quantity: number): Promise<ModifyCartItemResult>;

  /**
   * Removes an item from the cart
   * @param cartId The ID of the cart
   * @param itemId The ID of the item to remove
   */
  removeCartItem(cartId: string, itemId: string): Promise<void>;

  /**
   * Deletes a cart
   * @param cartId The ID of the cart to delete
   */
  deleteCart(cartId: string): Promise<void>;

  /**
   * Updates the shipping address on the cart for tax/shipping cost calculation during checkout.
   * Sets an address with type SHIPPING (and optionally BILLING) via the cart addresses array,
   * then refreshes the cart to recalculate prices.
   * @param cartId The ID of the cart
   * @param shippingAddress The shipping address for tax/shipping determination
   * @param billingAddress Optional billing address
   */
  updateShippingInfo(
    cartId: string,
    shippingAddress: CartShippingAddress,
    billingAddress?: CartShippingAddress,
  ): Promise<void>;

  /**
   * Updates the currency for a cart
   * @param cartId The ID of the cart
   * @param currency The new currency code
   */
  updateCurrency(cartId: string, currency: string): Promise<void>;

  /**
   * Updates the site for a cart
   * @param cartId The ID of the cart
   * @param siteCode The new site code
   */
  updateSite(cartId: string, siteCode: string): Promise<void>;

  /**
   * Retrieves the saved carts for the current customer
   * @param pagination The pagination query
   * @returns The saved carts
   */
  getSavedCarts(pagination: PaginationQuery): Promise<Paginated<Cart>>;

  /**
   * Saves the cart
   * @param cartId The ID of the cart to save
   */
  saveCart(cartId: string, type?: string): Promise<void>;

  /**
   * Loads the cart (the current cart will be saved if necessary)
   * @param cartId The ID of the cart to load
   * @param type The type of the cart to load
   */
  loadCart(cartId: string, type?: string): Promise<void>;

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
  getCartByCriteria(siteCode: string, sessionId: string, customerId?: string, type?: string): Promise<Cart | null>;
}
