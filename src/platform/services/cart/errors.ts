export const CART_CURRENCY_UPDATE_ERROR_CODE = {
  CART_NOT_FOUND: 'CART_NOT_FOUND',
  SITE_NOT_FOUND: 'SITE_NOT_FOUND',
  UNSUPPORTED_CURRENCY: 'UNSUPPORTED_CURRENCY',
  FORBIDDEN: 'FORBIDDEN',
  CONTEXT_MISMATCH: 'CONTEXT_MISMATCH',
  /** `/changeCurrency` rejected because an applied coupon cannot be repriced. */
  COUPON_CURRENCY_CONFLICT: 'COUPON_CURRENCY_CONFLICT',
  STALE_CART_ID: 'STALE_CART_ID',
  UPSTREAM_FAILURE: 'UPSTREAM_FAILURE',
} as const;

export type CartCurrencyUpdateErrorCode =
  (typeof CART_CURRENCY_UPDATE_ERROR_CODE)[keyof typeof CART_CURRENCY_UPDATE_ERROR_CODE];

export class CartCurrencyUpdateError extends Error {
  public readonly upstreamStatus?: number;
  public readonly upstreamBody?: string;

  constructor(
    public readonly code: CartCurrencyUpdateErrorCode,
    message: string,
    details?: { upstreamStatus?: number; upstreamBody?: string },
  ) {
    super(message);
    this.name = 'CartCurrencyUpdateError';
    this.upstreamStatus = details?.upstreamStatus;
    this.upstreamBody = details?.upstreamBody;
  }
}

/** Works across bundle boundaries where `instanceof` can fail for the same class. */
export function isCartCurrencyUpdateError(error: unknown): error is CartCurrencyUpdateError {
  return (
    error instanceof CartCurrencyUpdateError || (error instanceof Error && error.name === 'CartCurrencyUpdateError')
  );
}

/**
 * Why the platform rejected a coupon, classified from the Coupon Service validation response.
 * Drives a distinct shopper-facing message per class without leaking upstream text.
 */
export const CART_DISCOUNT_REASON = {
  /** No coupon with this code exists. */
  CODE_NOT_FOUND: 'CODE_NOT_FOUND',
  /** The code exists but is not redeemable right now (expired). */
  NOT_ACTIVE: 'NOT_ACTIVE',
  /** The code is already on this cart. */
  ALREADY_APPLIED: 'ALREADY_APPLIED',
  /** The code exists but this customer (segment, allow-list, anonymous) may not redeem it. */
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
  /** The code exists and the customer may use it, but the cart does not satisfy its restrictions. */
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const;

export type CartDiscountReason = (typeof CART_DISCOUNT_REASON)[keyof typeof CART_DISCOUNT_REASON];

/** `CartDiscountError` message for a caller-supplied cart id that belongs to another site (mapped to 403). */
export const CART_SITE_MISMATCH_MESSAGE = 'Cart belongs to a different site';

export class CartDiscountError extends Error {
  public readonly upstreamStatus?: number;
  public readonly upstreamBody?: string;
  public readonly reason?: CartDiscountReason;

  constructor(
    message: string,
    details?: { upstreamStatus?: number; upstreamBody?: string; reason?: CartDiscountReason },
  ) {
    super(message);
    this.name = 'CartDiscountError';
    this.upstreamStatus = details?.upstreamStatus;
    this.upstreamBody = details?.upstreamBody;
    this.reason = details?.reason;
  }
}

/** Works across bundle boundaries where `instanceof` can fail for the same class. */
export function isCartDiscountError(error: unknown): error is CartDiscountError {
  return error instanceof CartDiscountError || (error instanceof Error && error.name === 'CartDiscountError');
}

const UPSTREAM_STATUS_REGEX = /(?:\bstatus\b["':\s]+)?(400|401|403|404|409|422|500|502|503)\b/i;

export function extractUpstreamStatus(message: string): number | undefined {
  const match = message.match(UPSTREAM_STATUS_REGEX);
  if (!match) {
    return undefined;
  }

  const status = Number(match[1]);
  return Number.isNaN(status) ? undefined : status;
}

const COUPON_CURRENCY_HINT =
  /\b(coupon|promo(?:\s*code)?s?|discount\s+(?:currency|code|does|is|cannot|can'?t)|applied\s+discount)\b/i;

function structuredCurrencyFailureText(body: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== 'object') {
      return undefined;
    }
    const record = parsed as Record<string, unknown>;
    const parts = ['message', 'detail', 'error', 'description', 'code']
      .map((key) => record[key])
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    return parts.length > 0 ? parts.join(' ') : undefined;
  } catch {
    return undefined;
  }
}

/** True when an upstream currency-change payload names a coupon, not a generic item/price miss. */
export function isCouponRelatedCurrencyFailure(message: string, upstreamBody?: string): boolean {
  if (COUPON_CURRENCY_HINT.test(message)) {
    return true;
  }
  if (typeof upstreamBody !== 'string') {
    return false;
  }
  return COUPON_CURRENCY_HINT.test(structuredCurrencyFailureText(upstreamBody) ?? upstreamBody);
}

export function extractUpstreamBody(message: string): string | undefined {
  const openIndex = message.indexOf('{');
  if (openIndex < 0) {
    return undefined;
  }

  return message.slice(openIndex, openIndex + 400);
}
