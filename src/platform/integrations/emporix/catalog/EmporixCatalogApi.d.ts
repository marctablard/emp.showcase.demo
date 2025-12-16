import { EmporixCatalog, EmporixPaginatedResponse, EmporixSearchParams } from '../model';

/**
 * Emporix Catalog API interface
 * @link https://developer.emporix.io/docs/openapi/catalog/
 */
export interface EmporixCatalogApi {
  /**
   * Retrieves a list of catalogs.
   * @link https://api.emporix.io/catalog/{tenant}/catalogs
   * @param page number
   * @param pageSize number
   */
  getCatalogs(params: EmporixSearchParams<any>): Promise<EmporixPaginatedResponse<EmporixCatalog>>;

  /**
   * Retrieves a specific catalog by ID.
   * @link https://api.emporix.io/catalog/{tenant}/catalogs/{catalogId}
   * @param id catalog ID
   */
  getCatalog(id: string): Promise<EmporixCatalog | null>;
}
