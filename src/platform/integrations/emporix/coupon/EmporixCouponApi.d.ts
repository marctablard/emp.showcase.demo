/**
 * Coupon Service — `POST /coupon/{tenant}/coupons/{code}/validation`.
 *
 * The Cart Service collapses every coupon rejection into one generic 400
 * ("Discount with code X is not valid"), so the storefront cannot tell an unknown code from a
 * segment/customer restriction or an unmet order threshold. The Coupon Service validation runs
 * the same checks and reports a typed reason; it is used only to classify a rejection.
 */
export type EmporixCouponValidationOutcome =
  | { ok: true }
  | {
      ok: false;
      status: number;
      /** Top-level error classification, e.g. `business_error`, `resource_not_found`. */
      type?: string;
      /**
       * `details[].type` values, e.g. `coupon_segment_customer_not_assigned`,
       * `coupon_redemption_forbidden`, `coupon_expired`, `coupon_discount_currency_incorrect`.
       */
      detailTypes: string[];
    };

export interface EmporixCouponValidationRequest {
  /**
   * Cart goods subtotal in the cart currency. Only used to classify a rejection the Cart Service
   * already made, so the exact threshold basis (net vs gross) does not change the outcome class:
   * a threshold miss the coupon service does not see still ends up "not applicable".
   */
  orderTotal: { amount: number; currency: string };
  legalEntityId?: string;
  /**
   * Shopper identity for service-token / on-behalf validation. Omit for anonymous
   * so Coupon Service treats the lookup as an anonymous redemption check.
   */
  customerNumber?: string;
}

export interface EmporixCouponApi {
  /**
   * Checks whether the current shopper could redeem `code` without redeeming it.
   * Never throws on a 4xx — the rejection is the result. Network/5xx errors are thrown.
   */
  validateCoupon(code: string, request: EmporixCouponValidationRequest): Promise<EmporixCouponValidationOutcome>;
}
