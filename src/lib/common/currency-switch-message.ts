export type CurrencySwitchBlockedCopy = {
  key: 'currencySwitchCouponBlocked' | 'currencySwitchCartBlocked';
  values: { fromCurrency: string; toCurrency: string; codes?: string };
};

function uniqueCouponCodes(codes: string[] | undefined): string[] {
  return [...new Set((codes ?? []).map((code) => code.trim()).filter((code) => code.length > 0))];
}

/**
 * Shopper copy when `/changeCurrency` rejects. Coupon-only (or coupon-bearing) carts
 * get the COP-4815 instruction to remove the codes first.
 */
export function currencySwitchBlockedCopy(
  fromCurrency: string,
  toCurrency: string,
  couponCodes?: string[],
): CurrencySwitchBlockedCopy {
  const codes = uniqueCouponCodes(couponCodes);
  if (codes.length > 0) {
    return {
      key: 'currencySwitchCouponBlocked',
      values: { fromCurrency, toCurrency, codes: codes.join(', ') },
    };
  }
  return {
    key: 'currencySwitchCartBlocked',
    values: { fromCurrency, toCurrency },
  };
}
