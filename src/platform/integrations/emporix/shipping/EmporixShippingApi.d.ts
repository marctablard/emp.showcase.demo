import {
  EmporixActualDeliveryWindow,
  EmporixFindSiteRequest,
  EmporixShippingMethod,
  EmporixShippingSite,
} from '../model/shipping';

/**
 * Interface for shipping API operations
 */
export interface EmporixShippingApi {
  /**
   * Get a shipping method by ID
   * @param siteId - The site ID
   * @param zoneId - The zone ID
   * @param methodId - The method ID
   */
  getShippingMethod(siteId: string, zoneId: string, methodId: string): Promise<EmporixShippingMethod | null>;

  /**
   * Get all shipping methods for a zone
   * @param siteId - The site ID
   * @param zoneId - The zone ID
   */
  getShippingMethods(siteId: string, zoneId: string): Promise<EmporixShippingMethod[]>;

  /**
   * Find shipping sites based on location
   * @param request - The find site request containing postal code and country
   */
  findSite(request: EmporixFindSiteRequest): Promise<EmporixShippingSite[]>;

  /**
   * Delivery windows for a cart. The cart must already have country/zip.
   * Optional `postalCode` overrides the cart zip for the lookup.
   */
  getDeliveryWindowsByCart(cartId: string, postalCode?: string): Promise<EmporixActualDeliveryWindow[]>;
}
