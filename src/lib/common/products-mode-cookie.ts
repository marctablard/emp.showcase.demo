/**
 * Opt-in cookie for the "ALL PRODUCTS MODE" of a segmented customer (COP-4822).
 *
 * The cookie is written/cleared only by `PUT /api/customer-segment/products-mode` after the
 * server validated `canToggleAllProducts`, and it is honoured only by `ProductsModeService`.
 * Its value is bound to the customer id (`all.<customerId>`) so a stale cookie left by another
 * user on the same browser is ignored. Plain constant like `CURRENCY_COOKIE_NAME`.
 */
export const PRODUCTS_MODE_COOKIE_NAME = 'next-products-mode';

const OPT_IN_PREFIX = 'all.';

/** Builds the opt-in cookie value bound to `customerId`. */
export function formatProductsModeOptIn(customerId: string): string {
  return `${OPT_IN_PREFIX}${customerId}`;
}

/** `true` only when `value` is exactly the opt-in value bound to `customerId`. */
export function isProductsModeOptIn(value: string | undefined, customerId: string): boolean {
  return value !== undefined && value === formatProductsModeOptIn(customerId);
}
