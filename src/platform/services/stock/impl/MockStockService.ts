import { injectable } from '@/platform/core/di/injectable';
import type { StockAvailability } from '../../model/common';
import type { StockService } from '../StockService';

/**
 * Mock implementation of StockService
 * Always returns 40 as available quantity and +28 days for availability
 */
@injectable('MockStockService', 'Singleton')
export class MockStockService implements StockService {
  /**
   * Get stock availability for a product
   * @param site Site code
   * @param productId Product ID
   * @returns Stock availability information with fixed values
   */
  async getStockAvailability(site: string, productId: string): Promise<StockAvailability> {
    return {
      productId,
      availableQuantity: 40,
      availableInDays: 28,
      isAvailable: true,
    };
  }

  async getStockAvailabilities(site: string, productIds: string[]): Promise<Record<string, StockAvailability>> {
    const entries = await Promise.all(
      productIds.map(async (productId) => [productId, await this.getStockAvailability(site, productId)]),
    );
    return Object.fromEntries(entries);
  }

  /**
   * Check if a product has sufficient stock for the requested quantity
   * @param site Site code
   * @param productId Product ID
   * @param quantity Requested quantity
   * @returns True if sufficient stock is available (40 units), false otherwise
   */
  async hasSufficientStock(site: string, productId: string, quantity: number): Promise<boolean> {
    const stockInfo = await this.getStockAvailability(site, productId);
    return quantity <= stockInfo.availableQuantity;
  }
}

export default MockStockService;
