import { NextResponse } from 'next/server';
import { extractUpstreamMessage } from '@/lib/common/extract-upstream-message';
import { CartErrorCode } from '@/platform/services/model/cart/error-codes';

function resolveCartAddItemErrorCode(errorMessage: string): CartErrorCode | undefined {
  if (errorMessage.includes('PriceIds') && errorMessage.includes('invalid')) {
    return CartErrorCode.PRICE_SITE_INCOMPATIBLE;
  }
  if (errorMessage.includes('price is not available') || errorMessage.includes('not available for this site')) {
    return CartErrorCode.PRICE_NOT_AVAILABLE;
  }
  if (
    errorMessage.includes('siteCode') &&
    (errorMessage.includes('mismatch') || errorMessage.includes('does not match'))
  ) {
    return CartErrorCode.CART_SITE_MISMATCH;
  }
  return undefined;
}

export function cartAddItemErrorResponse(errorMessage: string): NextResponse {
  const upstreamMessage = extractUpstreamMessage(errorMessage);
  const code = resolveCartAddItemErrorCode(errorMessage);
  if (code) {
    return NextResponse.json(
      {
        error: upstreamMessage || errorMessage,
        code,
        details: errorMessage,
      },
      { status: 400 },
    );
  }
  if (upstreamMessage) {
    return NextResponse.json({ error: upstreamMessage, details: errorMessage }, { status: 400 });
  }
  // Unexpected failures: generic client copy; the route already logs the real error.
  return NextResponse.json({ error: 'Failed to add item to cart' }, { status: 500 });
}
