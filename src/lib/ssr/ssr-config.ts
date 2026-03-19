import { ProductFetchOptions } from '@/platform/services/product';
import { SsrService } from '@/platform/services/ssr/SsrService';
import ssr from '@/platform/ssr';

/**
 * Get the SSR service instance
 */
function getSsrService(): SsrService {
  return ssr.get<SsrService>('SsrService');
}

/**
 * Get the complete SSR configuration
 */
export function getSsrConfig() {
  return getSsrService().getConfig();
}

/**
 * Check if cart should be fetched during SSR
 */
export function isCartSsrEnabled(): boolean {
  return getSsrService().isCartSsrEnabled();
}

/**
 * Get product SSR configuration
 * @returns false if disabled, true if all enabled, or object with specific options
 */
export function isProductSsrEnabled(): boolean | ProductFetchOptions {
  return getSsrService().isProductSsrEnabled();
}

/**
 * Check if product prices should be fetched during SSR
 */
export function isProductPricesSsrEnabled(): boolean {
  return getSsrService().isProductPricesSsrEnabled();
}

/**
 * Check if product availability should be fetched during SSR
 */
export function isProductAvailabilitySsrEnabled(): boolean {
  return getSsrService().isProductAvailabilitySsrEnabled();
}

/**
 * Check if product variants should be fetched during SSR
 */
export function isProductVariantsSsrEnabled(): boolean {
  return getSsrService().isProductVariantsSsrEnabled();
}

/**
 * Check if search should be fetched during SSR
 */
export function isSearchSsrEnabled(): boolean {
  return getSsrService().isSearchSsrEnabled();
}
