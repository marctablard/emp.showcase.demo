import type { CartAppliedDiscount } from '@/platform/services/model/cart/cart';
import type { OrderDiscount } from '@/platform/services/model/order/order';
import {
  cartCouponCodesForCurrencyConflict,
  cartCouponCodesForMessage,
  currentDiscountIndexForCode,
  isShopperFacingCartPromo,
  isShopperFacingOrderPromo,
  optionalSavingsTotal,
  orderGoodsSavings,
  removableCartDiscountIndexes,
  removableCartPromoAtIndex,
  resolveGoodsSavingsAmount,
  shopperFacingCartPromos,
} from './applied-promo-display';

const goods: CartAppliedDiscount = {
  code: 'ACCESSORIES15',
  discountIndex: 0,
  amount: 1.5,
  currency: 'EUR',
  type: 'PERCENT',
};

describe('applied-promo-display', () => {
  it('keeps goods and free-shipping coupons', () => {
    expect(isShopperFacingCartPromo(goods)).toBe(true);
    expect(
      isShopperFacingCartPromo({
        code: 'FREESHIP',
        discountIndex: 1,
        amount: 0,
        currency: 'EUR',
        type: 'FREE_SHIPPING',
      }),
    ).toBe(true);
  });

  it('hides the TOTAL rollup and zero-effect goods coupons', () => {
    expect(isShopperFacingCartPromo({ code: 'TOTAL', discountIndex: 0, amount: 10, currency: 'EUR' })).toBe(false);
    expect(
      isShopperFacingCartPromo({ code: 'NOMATCH', discountIndex: 2, amount: 0, currency: 'EUR', type: 'PERCENT' }),
    ).toBe(false);
    expect(isShopperFacingOrderPromo({ code: 'TOTAL', value: 101.1, currency: 'EUR' })).toBe(false);
    expect(isShopperFacingOrderPromo({ code: '10POFF', value: 101.1, currency: 'EUR' } as OrderDiscount)).toBe(true);
    expect(
      isShopperFacingOrderPromo({
        code: 'VKTEST-COUPON05',
        value: 0,
        currency: 'EUR',
        type: 'FREE_SHIPPING',
      }),
    ).toBe(true);
    expect(isShopperFacingOrderPromo({ code: 'NOMATCH', value: 0, currency: 'EUR', type: 'PERCENT' })).toBe(false);
  });

  it('filters a mixed chip list', () => {
    expect(
      shopperFacingCartPromos([
        goods,
        { code: 'TOTAL', discountIndex: 1, amount: 10, currency: 'EUR' },
        { code: 'NOMATCH', discountIndex: 2, amount: 0, currency: 'EUR' },
      ]).map((discount) => discount.code),
    ).toEqual(['ACCESSORIES15']);
  });

  it('lists coupon codes for toasts without TOTAL', () => {
    expect(
      cartCouponCodesForMessage([
        goods,
        { code: 'TOTAL', discountIndex: 1, amount: 10, currency: 'EUR' },
        { code: 'NOMATCH', discountIndex: 2, amount: 0, currency: 'EUR' },
        { code: 'STALE10', discountIndex: 3, amount: 0, currency: 'EUR', valid: false },
      ]),
    ).toEqual(['ACCESSORIES15', 'NOMATCH', 'STALE10']);
  });

  it('omits invalid coupons from currency-conflict toasts', () => {
    expect(
      cartCouponCodesForCurrencyConflict([
        goods,
        { code: 'TOTAL', discountIndex: 1, amount: 10, currency: 'EUR' },
        { code: 'STALE10', discountIndex: 3, amount: 0, currency: 'EUR', valid: false },
      ]),
    ).toEqual(['ACCESSORIES15']);
  });

  it('uses shopper-facing goods rows instead of summing TOTAL plus coupon rows', () => {
    expect(
      orderGoodsSavings({
        currency: 'EUR',
        savingsTotal: 101.1,
        discounts: [
          { code: 'TOTAL', value: 101.1, currency: 'EUR' },
          { code: '10POFF', value: 101.1, currency: 'EUR' },
        ],
      }),
    ).toEqual({ amount: 101.1, currency: 'EUR' });
  });

  it('does not treat a mixed savingsTotal rollup as goods savings', () => {
    expect(
      orderGoodsSavings({
        currency: 'EUR',
        savingsTotal: 16.17,
        discounts: [{ code: 'LS10PTOTAL', value: 11.22, currency: 'EUR' }],
      }),
    ).toEqual({ amount: 11.22, currency: 'EUR' });
  });

  it('falls back to shopper-facing coupon values when savingsTotal is missing', () => {
    expect(
      orderGoodsSavings({
        currency: 'EUR',
        discounts: [
          { code: 'TOTAL', value: 101.1, currency: 'EUR' },
          { code: '10POFF', value: 101.1, currency: 'EUR' },
        ],
      }),
    ).toEqual({ amount: 101.1, currency: 'EUR' });
  });

  it('uses the goods-figure delta when a shipping waiver is also in savingsTotal', () => {
    expect(
      resolveGoodsSavingsAmount({
        savingsTotal: 16.17,
        shippingFree: true,
        discountedNet: 57.93,
        originalNet: 69.15,
      }),
    ).toBe(11.22);
  });

  it('spreads savingsTotal only when the amount is a number', () => {
    expect(optionalSavingsTotal(11.22)).toEqual({ savingsTotal: 11.22 });
    expect(optionalSavingsTotal(undefined)).toEqual({});
  });

  it('does not treat a shipping-only waiver as goods savings', () => {
    expect(
      resolveGoodsSavingsAmount({
        savingsTotal: 4.95,
        shippingFree: true,
        discountedNet: 69.15,
        originalNet: 69.15,
      }),
    ).toBeUndefined();
  });

  it('does not treat fee-only savingsTotal as goods savings when discounted figures are omitted', () => {
    expect(
      resolveGoodsSavingsAmount({
        savingsTotal: 4.95,
        shippingFree: false,
        originalNet: 69.15,
      }),
    ).toBeUndefined();
  });

  it('sums goods coupons instead of savingsTotal when a free-shipping promo is also applied', () => {
    expect(
      orderGoodsSavings({
        currency: 'EUR',
        savingsTotal: 16.17,
        discounts: [
          { code: 'LS10PTOTAL', value: 11.22, currency: 'EUR' },
          { code: 'FREESHIP', value: 4.95, currency: 'EUR', type: 'FREE_SHIPPING' },
        ],
      }),
    ).toEqual({ amount: 11.22, currency: 'EUR' });
  });

  it('does not treat fee-only savingsTotal as order goods savings', () => {
    expect(
      orderGoodsSavings({
        currency: 'EUR',
        savingsTotal: 4.95,
        discounts: [{ code: 'FEEONLY', value: 0, currency: 'EUR', type: 'PERCENT' }],
      }),
    ).toBeUndefined();
    expect(orderGoodsSavings({ currency: 'EUR', savingsTotal: 4.95 })).toBeUndefined();
  });

  it('uses published goods figures when the discounts array is omitted', () => {
    expect(
      orderGoodsSavings({
        currency: 'EUR',
        savingsTotal: 11.22,
        goodsDiscountedNet: 57.93,
        price: {
          subtotal: { net: 69.15, gross: 82.29, tax: 13.14, currency: 'EUR' },
          total: { net: 57.93, gross: 68.94, tax: 11.01, currency: 'EUR' },
        },
      }),
    ).toEqual({ amount: 11.22, currency: 'EUR' });
  });

  it('does not treat a free-shipping waiver as goods savings', () => {
    expect(
      orderGoodsSavings({
        currency: 'EUR',
        savingsTotal: 6.5,
        discounts: [{ code: 'SHIPFREE', value: 6.5, currency: 'EUR', type: 'FREE_SHIPPING' }],
      }),
    ).toBeUndefined();
    expect(
      orderGoodsSavings({
        currency: 'EUR',
        discounts: [
          { code: 'TOTAL', value: 6.5, currency: 'EUR' },
          { code: 'SHIPFREE', value: 6.5, currency: 'EUR', type: 'FREE_SHIPPING' },
        ],
      }),
    ).toBeUndefined();
  });

  it('returns removable coupon indexes without the TOTAL rollup, highest first', () => {
    expect(
      removableCartDiscountIndexes([
        goods,
        { code: 'TOTAL', discountIndex: 1, amount: 10, currency: 'EUR' },
        { code: 'NOMATCH', discountIndex: 2, amount: 0, currency: 'EUR' },
        { code: 'STALE10', discountIndex: 3, amount: 0, currency: 'EUR', valid: false },
      ]),
    ).toEqual([3, 2, 0]);
  });

  it('hides invalid coupons from shopper-facing chips but keeps their DELETE index', () => {
    const stale = { code: 'STALE10', discountIndex: 3, amount: 0, currency: 'EUR', valid: false as const };
    expect(shopperFacingCartPromos([goods, stale])).toEqual([goods]);
    expect(currentDiscountIndexForCode([goods, stale], 'STALE10')).toBe(3);
    expect(currentDiscountIndexForCode([goods, stale], 'GONE')).toBeUndefined();
  });

  it('prefers the shopper-visible row when the same code has a stale invalid and a later valid index', () => {
    const stale = { code: 'SAVE10', discountIndex: 0, amount: 0, currency: 'EUR', valid: false as const };
    const fresh = { code: 'SAVE10', discountIndex: 2, amount: 1.5, currency: 'EUR', valid: true as const };
    expect(currentDiscountIndexForCode([stale, fresh], 'SAVE10')).toBe(2);
    expect(
      removableCartPromoAtIndex([stale, { code: 'TOTAL', discountIndex: 1, amount: 10, currency: 'EUR' }], 1),
    ).toBeUndefined();
    expect(removableCartPromoAtIndex([goods], 0)).toEqual(goods);
  });
});
