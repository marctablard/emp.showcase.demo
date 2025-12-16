import type { Cart } from '../model/cart/cart';

/**
 * Interface for handling Cart Migration Operations
 */
export interface CartMigrationService {
  /**
   * Migrates a cart to the current customer
   * @param cartId The ID of the cart to migrate
   * @returns Promise that resolves when the cart is migrated
   */
  migrateCartToCustomer(cartId: string, customerId: string): Promise<void>;

  /**
   * Merges two carts into one
   * @param anonymousCartId The ID of the anonymous cart
   * @param customerCartId The ID of the logged in customer cart
   */
  mergeCarts(anonymousCartId: string, customerCartId: string): Promise<void>;
}
