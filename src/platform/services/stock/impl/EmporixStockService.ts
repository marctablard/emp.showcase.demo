import { inject } from 'inversify';
import type { EmporixAvailabilityApi } from '@/platform/integrations/emporix/availability/EmporixAvailabilityApi';
import type { StockAvailability, StockService } from '../StockService';

/**
 * Implementation of StockService using Emporix Availability API
 */
//@injectable('StockService', 'Singleton')
class EmporixStockService implements StockService {
  constructor(@inject('EmporixAvailabilityApi') private availabilityApi: EmporixAvailabilityApi) {}

  /**
   * Get stock availability for a product
   * @param site Site code
   * @param productId Product ID
   * @returns Stock availability information
   */
  async getStockAvailability(site: string, productId: string): Promise<StockAvailability> {
    const availability = await this.availabilityApi.getProductAvailability(productId, site);

    // Default availability if product is not found
    if (!availability) {
      return {
        productId,
        availableQuantity: 0,
        availableInDays: null,
        isAvailable: false,
      };
    }

    // Map Emporix availability to StockAvailability
    return {
      productId: availability.productId,
      availableQuantity: availability.stockLevel,
      availableInDays: null,
      isAvailable: availability.available,
    };
  }

  /**
   * Check if a product has sufficient stock for the requested quantity
   * @param site Site code
   * @param productId Product ID
   * @param quantity Requested quantity
   * @returns True if sufficient stock is available, false otherwise
   */
  async hasSufficientStock(site: string, productId: string, quantity: number): Promise<boolean> {
    const availability = await this.getStockAvailability(site, productId);

    // If the product is not available, it doesn't have sufficient stock
    if (!availability.isAvailable) {
      return false;
    }

    // Check if the available quantity is sufficient
    return availability.availableQuantity >= quantity;
  }
}

export default EmporixStockService;
