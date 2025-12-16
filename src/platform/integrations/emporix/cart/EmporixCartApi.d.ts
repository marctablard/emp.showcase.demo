import {
  EmporixAddCartItemRequest,
  EmporixCart,
  EmporixCreateCartRequest,
  EmporixPaginatedResponse,
  EmporixSearchParams,
  EmporixUpdateCartItemRequest,
} from '../model';

/**
 * Interface for Cart API operations
 */
export interface EmporixCartApi {
  /**
   * Create a new cart
   * @param createCartRequest Cart creation request
   * @returns Promise with the created cart ID
   */
  createCart(createCartRequest: EmporixCreateCartRequest): Promise<string>;

  /**
   * Get cart by ID
   * @param cartId Cart ID
   * @param checkSession Whether to check the Session-Ownership of the Cart
   * @returns Promise with the cart details
   */
  getCart(cartId: string, checkSession?: boolean): Promise<EmporixCart | null>;

  /**
   * Get cart by criteria (sessionId, customerId, siteCode)
   * @param siteCode Site code
   * @param sessionId Optional session ID for anonymous customers
   * @param customerId Optional customer ID for logged-in customers
   * @param type Optional cart type (e.g., "shopping")
   * @returns Promise with the cart details
   */
  getCartByCriteria(
    siteCode: string,
    sessionId?: string,
    customerId?: string,
    type?: string,
  ): Promise<EmporixCart | null>;

  /**
   * Search for carts by criteria (sessionId, customerId, siteCode)
   * @param searchParams Search parameters
   * @returns Promise with the cart details
   */
  searchCarts(searchParams: EmporixSearchParams<EmporixCart>): Promise<EmporixPaginatedResponse<EmporixCart>>;

  /**
   * Add item to cart
   * @param cartId Cart ID
   * @param item Item to add
   * @returns Promise with the created item ID
   */
  addItemToCart(cartId: string, item: EmporixAddCartItemRequest): Promise<string>;

  /**
   * Get all items in a cart
   * @param cartId Cart ID
   * @returns Promise with array of cart items
   */
  getCartItems(cartId: string): Promise<CartItem[]>;

  /**
   * Update cart item
   * @param cartId Cart ID
   * @param itemId Item ID
   * @param updateRequest Update request with quantity and optional price information
   * @returns Promise resolving when update is complete
   */
  updateCartItemQuantity(cartId: string, itemId: string, updateRequest: EmporixUpdateCartItemRequest): Promise<void>;

  /**
   * Remove item from cart
   * @param cartId Cart ID
   * @param itemId Item ID
   * @returns Promise resolving when removal is complete
   */
  removeCartItem(cartId: string, itemId: string): Promise<void>;

  /**
   * Delete a cart
   * @param cartId Cart ID
   * @returns Promise resolving when deletion is complete
   */
  deleteCart(cartId: string): Promise<void>;

  /**
   * Update cart
   * @param cartId Cart ID
   * @param cart Partial cart to update
   * @returns Promise resolving when update is complete
   */
  updateCart(cartId: string, cart: Partial<EmporixCart>): Promise<void>;

  /**
   * Change cart currency
   * @param cartId Cart ID
   * @param currency New currency code
   * @returns Promise resolving when currency change is complete
   */
  changeCurrency(cartId: string, currency: string): Promise<void>;

  /**
   * Change cart site
   * @param cartId Cart ID
   * @param siteCode New site code
   * @returns Promise resolving when site change is complete
   */
  changeSite(cartId: string, siteCode: string): Promise<void>;

  /**
   * Refresh cart
   * @param cartId Cart ID
   * @returns Promise resolving when refresh is complete
   */
  refreshCart(cartId: string): Promise<void>;

  /**
   * Merge two carts into one
   * @param sourceCartId The ID of the source cart
   * @param targetCartId The ID of the target cart
   * @returns Promise resolving when the carts are merged
   */
  mergeCarts(sourceCartId: string, targetCartId: string): Promise<void>;
}
