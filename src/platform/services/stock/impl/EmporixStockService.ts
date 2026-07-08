import { inject } from 'inversify';
import { createUnavailableStock } from '@/lib/common/stock-availability';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixAvailabilityApi } from '@/platform/integrations/emporix/availability/EmporixAvailabilityApi';
import type { EmporixAvailability } from '@/platform/integrations/emporix/model/availability';
import type { StockAvailability } from '../../model/common';
import type { StockService } from '../StockService';

/**
 * Implementation of StockService using Emporix Availability API
 */
@injectable('EmporixStockService', 'Singleton')
class EmporixStockService implements StockService {
  constructor(@inject('EmporixAvailabilityApi') private availabilityApi: EmporixAvailabilityApi) {}

  private mapAvailability(availability: EmporixAvailability): StockAvailability {
    return {
      productId: availability.productId,
      availableQuantity: availability.stockLevel,
      availableInDays: null,
      isAvailable: availability.available,
    };
  }

  /**
   * Get stock availability for a product
   * @param site Site code
   * @param productId Product ID
   * @returns Stock availability information
   */
  async getStockAvailability(site: string, productId: string): Promise<StockAvailability> {
    const availability = await this.availabilityApi.getProductAvailability(productId, site);

    if (!availability) {
      return createUnavailableStock(productId);
    }

    return this.mapAvailability(availability);
  }

  async getStockAvailabilities(site: string, productIds: string[]): Promise<Record<string, StockAvailability>> {
    const uniqueIds = [...new Set(productIds.filter(Boolean))];
    const result = Object.fromEntries(uniqueIds.map((productId) => [productId, createUnavailableStock(productId)]));

    if (uniqueIds.length === 0) {
      return result;
    }

    const paginated = await this.availabilityApi.searchProductAvailabilities(
      site,
      uniqueIds,
      1,
      Math.max(uniqueIds.length, 20),
    );

    paginated.items.forEach((availability) => {
      const mapped = this.mapAvailability(availability);
      result[mapped.productId] = mapped;

      const requestedId = uniqueIds.find(
        (productId) => productId === availability.productId || productId === availability.id,
      );
      if (requestedId && requestedId !== mapped.productId) {
        result[requestedId] = { ...mapped, productId: requestedId };
      }
    });

    return result;
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
