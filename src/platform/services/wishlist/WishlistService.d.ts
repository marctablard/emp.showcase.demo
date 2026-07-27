import type { CartStatus, CartStatusDetailCode } from '../cart/CartService';
import type { Cart } from '../model/cart/cart';
import type { Wishlist } from '../model/wishlist/wishlist';

/**
 * Service for managing a customer's default wishlist.
 *
 * Lifecycle: a wishlist exists only when it has at least one item. The empty default
 * wishlist is created lazily on the first `addItem` and deleted automatically when the last
 * item is removed (via `removeItem` or `moveItemToCart`).
 */
export interface WishlistService {
  /**
   * Resolve the customer's default wishlist by siteCode, customerId and `type = wishlist`.
   * @returns The wishlist, or null if the customer has no wishlist yet.
   * @throws If there is no authenticated customer session.
   */
  getDefaultWishlist(): Promise<Wishlist | null>;

  /**
   * Add a product to the default wishlist, creating the wishlist lazily on first add.
   * @returns The updated wishlist.
   * @throws If there is no authenticated customer session, or the product does not exist, or
   *         (on merge into an existing line) no current price is available.
   */
  addItem(productId: string, quantity: number): Promise<Wishlist>;

  /**
   * Update the quantity of the wishlist line for the given product.
   * @throws If the wishlist does not exist, the product is not on the wishlist, or no current
   *         price is available.
   */
  updateItemQuantity(productId: string, quantity: number): Promise<Wishlist>;

  /**
   * Remove the product from the wishlist. If the removal empties the wishlist, the underlying
   * wishlist cart is deleted and `null` is returned.
   * @throws If the wishlist does not exist or the product is not on the wishlist.
   */
  removeItem(productId: string): Promise<Wishlist | null>;

  /**
   * Add the wishlist line for the given product to the customer's shopping cart (creating the
   * shopping cart if needed), then remove it from the wishlist.
   * @throws If the wishlist does not exist, the product is not on the wishlist, or the
   *         cart-side add fails.
   */
  moveItemToCart(productId: string): Promise<{
    wishlist: Wishlist | null;
    cart: Cart;
    partialFailure?: 'wishlist-remove-failed';
    status: CartStatus;
    statusDetailCode?: CartStatusDetailCode;
    statusDetailPayload?: { availableQuantity?: number } & Record<string, unknown>;
  }>;
}
