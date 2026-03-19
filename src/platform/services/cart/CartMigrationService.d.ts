/**
 * Interface for handling Cart Migration Operations
 */
export interface CartMigrationService {
  /**
   * Merges two carts into one
   * @param anonymousCartId The ID of the anonymous cart
   * @param customerCartId The ID of the logged in customer cart
   */
  mergeCarts(anonymousCartId: string, customerCartId: string): Promise<void>;
}
