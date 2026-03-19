export const CART_CURRENCY_UPDATE_ERROR_CODE = {
  CART_NOT_FOUND: 'CART_NOT_FOUND',
  SITE_NOT_FOUND: 'SITE_NOT_FOUND',
  UNSUPPORTED_CURRENCY: 'UNSUPPORTED_CURRENCY',
  FORBIDDEN: 'FORBIDDEN',
  CONTEXT_MISMATCH: 'CONTEXT_MISMATCH',
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

const UPSTREAM_STATUS_REGEX = /(?:\bstatus\b["':\s]+)?(400|401|403|404|409|422|500|502|503)\b/i;

export function extractUpstreamStatus(message: string): number | undefined {
  const match = message.match(UPSTREAM_STATUS_REGEX);
  if (!match) {
    return undefined;
  }

  const status = Number(match[1]);
  return Number.isNaN(status) ? undefined : status;
}

export function extractUpstreamBody(message: string): string | undefined {
  const openIndex = message.indexOf('{');
  if (openIndex < 0) {
    return undefined;
  }

  return message.slice(openIndex, openIndex + 400);
}
