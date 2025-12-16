import { EmporixPaginatedResponse } from '../model';
import { EmporixAvailability, EmporixLocation } from '../model/availability';

export interface EmporixAvailabilityApi {
  /**
   * Retrieves all availability information for a specified site.
   * @link https://developer.emporix.io/docs/openapi/availability/#operation/GET-availability-retrieve-availability-site
   * @param site Site code
   * @param page Page number (optional)
   * @param pageSize Page size (optional)
   */
  getAvailabilitiesBySite(
    site: string,
    page?: number,
    pageSize?: number,
  ): Promise<EmporixPaginatedResponse<EmporixAvailability>>;

  /**
   * Retrieves availabilities for specified products on a specified site.
   * @link https://developer.emporix.io/docs/openapi/availability/#operation/POST-availability-search-products-site
   * @param site Site code
   * @param productIds Array of product IDs
   * @param page Page number (optional)
   * @param pageSize Page size (optional)
   */
  searchProductAvailabilities(
    site: string,
    productIds: string[],
    page?: number,
    pageSize?: number,
  ): Promise<EmporixPaginatedResponse<EmporixAvailability>>;

  /**
   * Retrieves a specified product's availability details.
   * @link https://developer.emporix.io/docs/openapi/availability/#operation/GET-availability-retrieve-product
   * @param productId Product ID
   * @param site Site code
   */
  getProductAvailability(productId: string, site: string): Promise<EmporixAvailability | undefined>;
}
