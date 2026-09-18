/**
 * Stable selector for the customer-facing message. The English `error` text stays in the
 * response as a diagnostic for logs and non-UI consumers; the storefront renders the
 * translation behind this code instead.
 *
 * Deliberately dependency-free: the browser imports these codes, so nothing from the
 * integration layer may be reachable from here.
 */
export const RETURN_ERROR_CODE = {
  RETURNS_FETCH_FAILED: 'RETURNS_FETCH_FAILED',
  RETURN_FETCH_FAILED: 'RETURN_FETCH_FAILED',
  RETURN_NOT_FOUND: 'RETURN_NOT_FOUND',
  ORDER_ID_REQUIRED: 'ORDER_ID_REQUIRED',
  ITEMS_REQUIRED: 'ITEMS_REQUIRED',
  REASON_CODE_REQUIRED: 'REASON_CODE_REQUIRED',
  REASON_CODE_INVALID: 'REASON_CODE_INVALID',
  REASON_DETAILS_INVALID: 'REASON_DETAILS_INVALID',
  ITEM_ID_INVALID: 'ITEM_ID_INVALID',
  ITEM_QUANTITY_INVALID: 'ITEM_QUANTITY_INVALID',
  ITEM_REASON_CODE_TYPE_INVALID: 'ITEM_REASON_CODE_TYPE_INVALID',
  ITEM_REASON_CODE_INVALID: 'ITEM_REASON_CODE_INVALID',
  ITEM_REASON_DETAILS_INVALID: 'ITEM_REASON_DETAILS_INVALID',
  ITEM_NOT_IN_ORDER: 'ITEM_NOT_IN_ORDER',
  ITEM_EXCEEDS_RETURNABLE_QUANTITY: 'ITEM_EXCEEDS_RETURNABLE_QUANTITY',
  VALIDATION_UNAVAILABLE: 'VALIDATION_UNAVAILABLE',
  UPSTREAM_SESSION_EXPIRED: 'UPSTREAM_SESSION_EXPIRED',
  UPSTREAM_FORBIDDEN: 'UPSTREAM_FORBIDDEN',
  UPSTREAM_REJECTED: 'UPSTREAM_REJECTED',
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
  UPSTREAM_FAILURE: 'UPSTREAM_FAILURE',
} as const;

export type ReturnErrorCode = (typeof RETURN_ERROR_CODE)[keyof typeof RETURN_ERROR_CODE];

/**
 * Values a translated message may interpolate. Sent alongside the code, never pre-rendered.
 * `sku` is the article number the shopper actually sees; the internal order-entry id stays
 * in the log context.
 */
export interface ReturnErrorParams {
  sku?: string;
  requested?: number;
  remaining?: number;
}
