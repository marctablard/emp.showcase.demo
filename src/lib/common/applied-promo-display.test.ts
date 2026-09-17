import type { CartAppliedDiscount } from '@/platform/services/model/cart/cart';
import type { OrderDiscount } from '@/platform/services/model/order/order';
import {
  cartCouponCodesForMessage,
  isShopperFacingCartPromo,
  isShopperFacingOrderPromo,
  orderGoodsSavings,
  removableCartDiscountIndexes,
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
      ]),
    ).toEqual(['ACCESSORIES15', 'NOMATCH']);
  });

  it('uses savingsTotal instead of summing TOTAL plus coupon rows', () => {
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
      ]),
    ).toEqual([2, 0]);
  });
});
