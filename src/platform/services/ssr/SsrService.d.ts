import { ProductFetchOptions } from '@/platform/services/product';

/**
 * SSR (Server-Side Rendering) configuration for controlling what data is fetched during SSR
 */
export interface SsrConfig {
  /** Cart SSR configuration */
  cart: boolean;

  /** Product SSR configuration */
  product:
    | boolean
    | {
        /** Fetch prices during SSR */
        prices?: boolean;
        /** Fetch availability/stock during SSR */
        availability?: boolean;
        /** Fetch variants during SSR */
        variants?: boolean;
        /** Fetch categories during SSR */
        categories?: boolean;
      };

  /** Search SSR configuration */
  search: boolean;
}

/**
 * Service for managing SSR configuration based on environment variables
 */
export interface SsrService {
  /**
   * Get the current SSR configuration
   * @returns SSR configuration object
   */
  getConfig(): SsrConfig;

  /**
   * Check if cart should be fetched during SSR
   * @returns true if cart SSR is enabled
   */
  isCartSsrEnabled(): boolean;

  /**
   * Get product SSR configuration
   * @returns false if disabled, true if all enabled, or object with specific options
   */
  isProductSsrEnabled(): boolean | ProductFetchOptions;

  /**
   * Check if product prices should be fetched during SSR
   * @returns true if product prices SSR is enabled
   */
  isProductPricesSsrEnabled(): boolean;

  /**
   * Check if product availability should be fetched during SSR
   * @returns true if product availability SSR is enabled
   */
  isProductAvailabilitySsrEnabled(): boolean;

  /**
   * Check if product variants should be fetched during SSR
   * @returns true if product variants SSR is enabled
   */
  isProductVariantsSsrEnabled(): boolean;

  /**
   * Check if search should be fetched during SSR
   * @returns true if search SSR is enabled
   */
  isSearchSsrEnabled(): boolean;
}
