import type { Paginated, Product } from '../../types/data';
import { PriceFetchOptions } from '../price/PriceService';

/**
 * Options for fetching products with additional data
 */
export interface ProductFetchOptions {
  /** Include product variants */
  variants?: boolean;
  /** Include product prices */
  prices?: boolean | PriceFetchOptions;
  /** Include availability */
  availability?: boolean;
  /** Include product categories */
  categories?: boolean;
  /**
   * Active customer-segment ids resolved server-side. `undefined` = unscoped (anonymous /
   * unsegmented); an array = products outside the segment scope are dropped; `[]` = empty scope,
   * nothing is returned and no upstream membership call is made (fail closed). Never taken from
   * the client request.
   */
  segmentIds?: string[];
  /**
   * Effective site the products mode / `segmentIds` were resolved for. Segment membership checks
   * use it so the scope and the mode agree on one site; when absent the session site is used
   * (COP-4822). Only meaningful together with `segmentIds`; never taken from the client request.
   */
  siteCode?: string;
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

  /**
   * COP-4822 AC4: whether `productId` is inside the resolved segment scope.
   * `segmentIds === undefined` is unscoped (anonymous / unsegmented / All Products) and returns
   * `true`. `[]` or a missing site is an empty scope and returns `false` without an upstream call.
   */
  isInSegmentScope(productId: string, options?: Pick<ProductFetchOptions, 'segmentIds' | 'siteCode'>): Promise<boolean>;
}
