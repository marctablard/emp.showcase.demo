import type { CartAppliedDiscount } from '@/platform/services/model/cart/cart';
import type { OrderDiscount } from '@/platform/services/model/order/order';
import {
  cartCouponCodesForMessage,
  isShopperFacingCartPromo,
  isShopperFacingOrderPromo,
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
});
