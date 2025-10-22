import type { Paginated, Product } from '../../types/data';

/**
 * Options for fetching products with additional data
 */
export interface ProductFetchOptions {
  /** Include product variants */
  variants?: boolean;
  /** Include product prices */
  prices?: boolean;
  /** Include product categories */
  categories?: boolean;
}

/**
 * Interface for product service.
 * Defines methods for product operations.
 */
export interface ProductService {
  /**
   * Retrieves a product by its ID.
   * @param id The ID of the product to retrieve.
   * @param options Optional fetch options for including variants or prices.
   * @returns The product if found, otherwise undefined.
   */
  getProductById(id: string, options?: ProductFetchOptions): Promise<Product | undefined>;

  /**
   * Retrieves a list of variant products for a specified parent product.
   * @param parentId The ID of the parent product.
   * @param options Optional fetch options for including additional data.
   * @returns A list of variant products.
   */
  getVariantProducts(parentId: string, options?: ProductFetchOptions): Promise<Product[]>;

  /**
   * Retrieves a paginated list of products.
   * @param page Optional page number.
   * @param pageSize Optional page size.
   * @param options Optional fetch options for including additional data.
   * @returns A paginated list of products.
   */
  getProducts(page?: number, pageSize?: number, options?: ProductFetchOptions): Promise<Paginated<Product>>;

  /**
   * Adds additional data (brands, labels, categories, prices, variants) to mapped products.
   * @param mappedProducts The already mapped products to enhance.
   * @param options Optional fetch options for including additional data.
   * @returns Enhanced products with additional data.
   */
  addAdditionalData(mappedProducts: Product[], options?: ProductFetchOptions): Promise<Product[]>;
}
