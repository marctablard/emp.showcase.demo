import { injectable } from '@/platform/core/di/injectable';
import type { SsrConfig, SsrService } from '../SsrService';

/**
 * Default implementation of SsrService that reads configuration from environment variables
 */
@injectable('SsrService', 'Singleton')
class DefaultSsrService implements SsrService {
  private config: SsrConfig;

  constructor() {
    this.config = this.parseEnvironmentVariables();
  }

  /**
   * Parse environment variables and build SSR configuration
   */
  private parseEnvironmentVariables(): SsrConfig {
    const cartEnabled = process.env.NEXT_SSR_CART === 'true';
    const productEnabled = process.env.NEXT_SSR_PRODUCT === 'true';
    const pricesEnabled = process.env.NEXT_SSR_PRODUCT_PRICES === 'true';
    const availabilityEnabled = process.env.NEXT_SSR_PRODUCT_STOCK === 'true';
    const variantsEnabled = process.env.NEXT_SSR_PRODUCT_VARIANTS === 'true';
    const categoriesEnabled = process.env.NEXT_SSR_PRODUCT_CATEGORIES === 'true';
    const searchEnabled = process.env.NEXT_SSR_SEARCH === 'true';

    // If product is disabled, return false
    // If product is enabled but no sub-options are set, return true
    // If product is enabled and sub-options are set, return object with sub-options
    let productConfig: boolean | { prices?: boolean; availability?: boolean; variants?: boolean; categories?: boolean };

    if (!productEnabled) {
      productConfig = false;
    } else {
      // Product enabled with specific options
      productConfig = {
        prices: pricesEnabled,
        availability: availabilityEnabled,
        variants: variantsEnabled,
        categories: categoriesEnabled,
      };
    }

    return {
      cart: cartEnabled,
      product: productConfig,
      search: searchEnabled,
    };
  }

  getConfig(): SsrConfig {
    return this.config;
  }

  isCartSsrEnabled(): boolean {
    return this.config.cart;
  }

  isProductSsrEnabled():
    | boolean
    | { prices?: boolean; availability?: boolean; variants?: boolean; categories?: boolean } {
    return this.config.product;
  }

  isProductPricesSsrEnabled(): boolean {
    if (typeof this.config.product === 'boolean') {
      return this.config.product;
    }
    return this.config.product.prices ?? false;
  }

  isProductAvailabilitySsrEnabled(): boolean {
    if (typeof this.config.product === 'boolean') {
      return this.config.product;
    }
    return this.config.product.availability ?? false;
  }

  isProductVariantsSsrEnabled(): boolean {
    if (typeof this.config.product === 'boolean') {
      return this.config.product;
    }
    return this.config.product.variants ?? false;
  }

  isSearchSsrEnabled(): boolean {
    return this.config.search;
  }
}

export default DefaultSsrService;
