import { StockAvailability } from '../model/common';

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
