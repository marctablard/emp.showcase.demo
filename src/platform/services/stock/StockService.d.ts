/**
 * Stock availability information for a product
 */
export interface StockAvailability {
  /**
   * Product ID
   */
  productId: string;

  /**
   * Available quantity in stock
   */
  availableQuantity: number;

  /**
   * Number of days until the product is available if not in stock
   * null if the product is in stock or unavailable
   */
  availableInDays: number | null;

  /**
   * Whether the product is available for order
   */
  isAvailable: boolean;
}

/**
 * Service for checking product stock availability
 */
export interface StockService {
  /**
   * Get stock availability for a product
   * @param site Site code
   * @param productId Product ID
   * @returns Stock availability information
   */
  getStockAvailability(site: string, productId: string): Promise<StockAvailability>;

  /**
   * Check if a product has sufficient stock for the requested quantity
   * @param site Site code
   * @param productId Product ID
   * @param quantity Requested quantity
   * @returns True if sufficient stock is available, false otherwise
   */
  hasSufficientStock(site: string, productId: string, quantity: number): Promise<boolean>;
}
