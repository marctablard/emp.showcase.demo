import type { Cart } from '@/platform/services/model/cart';
import { buildCheckoutOrderSummaryBreakdown, buildCheckoutOrderSummaryFromCart } from './checkout-order-summary';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Confirmation-shaped oracle for the ticket numbers (not the helper formula written twice). */
const CONFIRMATION_ORACLE_STANDARD = { total: { gross: 129.24 } };
const CONFIRMATION_ORACLE_REDUCED = { total: { gross: 128.44 } };

const CH_CART_TAX = { amount: 7.7, netValue: 100, grossValue: 107.7, currency: 'CHF' };

describe('buildCheckoutOrderSummaryBreakdown', () => {
  it('uses refreshed cart.tax.amount as goodsVat (CH 7.7, not leftover 19)', () => {
    const breakdown = buildCheckoutOrderSummaryBreakdown({
      goodsNet: CH_CART_TAX.netValue,
      goodsVat: CH_CART_TAX.amount,
      shippingFee: 20,
      shippingVatRate: 7.7,
      shippingTaxCodePresent: true,
      currency: CH_CART_TAX.currency,
    });

    expect(breakdown.goodsVat).toBe(7.7);
    expect(breakdown.goodsVat).not.toBe(19);
  });

  it('computes shipping VAT 1.54 at 7.7% on fee 20 and matches the confirmation oracle total', () => {
    const breakdown = buildCheckoutOrderSummaryBreakdown({
      goodsNet: 100,
      goodsVat: 7.7,
      shippingFee: 20,
      shippingVatRate: 7.7,
      shippingTaxCodePresent: true,
      currency: 'CHF',
    });

    expect(breakdown.shippingVat).toBe(1.54);
    expect(breakdown.showShippingVat).toBe(true);
    expect(breakdown.shippingVatLookupFailed).toBe(false);
    expect(breakdown.total).toBe(CONFIRMATION_ORACLE_STANDARD.total.gross);
  });

  it('computes shipping VAT 0.74 at 3.7% on fee 20 and matches the alternate confirmation oracle', () => {
    const breakdown = buildCheckoutOrderSummaryBreakdown({
      goodsNet: 100,
      goodsVat: 7.7,
      shippingFee: 20,
      shippingVatRate: 3.7,
      shippingTaxCodePresent: true,
      currency: 'CHF',
    });

    expect(breakdown.shippingVat).toBe(0.74);
    expect(breakdown.showShippingVat).toBe(true);
    expect(breakdown.shippingVatLookupFailed).toBe(false);
    expect(breakdown.total).toBe(CONFIRMATION_ORACLE_REDUCED.total.gross);
  });

  it('hides Shipping VAT as a successful 0 when the looked-up rate is 0', () => {
    const breakdown = buildCheckoutOrderSummaryBreakdown({
      goodsNet: 100,
      goodsVat: 7.7,
      shippingFee: 20,
      shippingVatRate: 0,
      shippingTaxCodePresent: true,
      currency: 'CHF',
    });

    expect(breakdown.shippingVat).toBe(0);
    expect(breakdown.showShippingVat).toBe(false);
    expect(breakdown.shippingVatLookupFailed).toBe(false);
    expect(breakdown.total).toBe(127.7);
  });

  it('hides Shipping VAT when the shipping fee is missing', () => {
    const breakdown = buildCheckoutOrderSummaryBreakdown({
      goodsNet: 100,
      goodsVat: 7.7,
      shippingVatRate: 7.7,
      shippingTaxCodePresent: true,
      currency: 'CHF',
    });

    expect(breakdown.shippingFee).toBeUndefined();
    expect(breakdown.shippingVat).toBe(0);
    expect(breakdown.showShippingVat).toBe(false);
    expect(breakdown.shippingVatLookupFailed).toBe(false);
    expect(breakdown.total).toBe(107.7);
  });

  it('includes feesTotal in the total', () => {
    const breakdown = buildCheckoutOrderSummaryBreakdown({
      goodsNet: 100,
      goodsVat: 7.7,
      shippingFee: 20,
      shippingVatRate: 7.7,
      shippingTaxCodePresent: true,
      feesTotal: 5,
      currency: 'CHF',
    });

    expect(breakdown.feesTotal).toBe(5);
    expect(breakdown.total).toBe(134.24);
  });

  it('defaults feesTotal to 0', () => {
    const breakdown = buildCheckoutOrderSummaryBreakdown({
      goodsNet: 100,
      goodsVat: 7.7,
      shippingFee: 20,
      shippingVatRate: 7.7,
      shippingTaxCodePresent: true,
      currency: 'CHF',
    });

    expect(breakdown.feesTotal).toBe(0);
    expect(breakdown.total).toBe(CONFIRMATION_ORACLE_STANDARD.total.gross);
  });

  it('does not treat taxCode present + undefined rate as a successful VAT=0 hide', () => {
    const breakdown = buildCheckoutOrderSummaryBreakdown({
      goodsNet: 100,
      goodsVat: 7.7,
      shippingFee: 20,
      shippingVatRate: undefined,
      shippingTaxCodePresent: true,
      currency: 'CHF',
    });

    expect(breakdown.shippingVatLookupFailed).toBe(true);
    expect(breakdown.showShippingVat).toBe(false);
    expect(breakdown.shippingVat).toBe(0);
    expect(breakdown.total).toBe(127.7);
  });
});

describe('buildCheckoutOrderSummaryFromCart', () => {
  const cart: Cart = {
    id: 'cart-1',
    currency: 'EUR',
    site: 'main',
    items: [],
    tax: { amount: 13.14, netValue: 69.15, grossValue: 82.29, currency: 'EUR' },
    shippingCosts: {
      amount: 0.01,
      currency: 'EUR',
      tax: {
        amount: 0,
        currency: 'EUR',
        netValue: 0.01,
        grossValue: 0.01,
        taxCode: 'ZERO',
        taxRate: 0,
      },
    },
    subTotalPrice: { amount: 82.29, currency: 'EUR' },
    totalPrice: { amount: 82.3, currency: 'EUR' },
  };

  it('hides the cart minimum shipping estimate until a method is picked', () => {
    const breakdown = buildCheckoutOrderSummaryFromCart(cart);

    expect(breakdown.goodsNet).toBe(69.15);
    expect(breakdown.goodsVat).toBe(13.14);
    expect(breakdown.shippingFee).toBeUndefined();
    expect(breakdown.shippingVat).toBe(0);
    expect(breakdown.showShippingVat).toBe(false);
    expect(breakdown.shippingVatLookupFailed).toBe(false);
    expect(breakdown.total).toBe(82.29);
    expect(breakdown.currency).toBe('EUR');
  });

  it('does not show cart shipping VAT until a method is picked', () => {
    const breakdown = buildCheckoutOrderSummaryFromCart({
      ...cart,
      shippingCosts: {
        amount: 20,
        currency: 'CHF',
        tax: {
          amount: 1.54,
          currency: 'CHF',
          netValue: 20,
          grossValue: 21.54,
          taxCode: 'STANDARD',
          taxRate: 7.7,
        },
      },
      tax: CH_CART_TAX,
      totalPrice: { amount: 129.24, currency: 'CHF' },
      currency: 'CHF',
    });

    expect(breakdown.shippingFee).toBeUndefined();
    expect(breakdown.shippingVat).toBe(0);
    expect(breakdown.showShippingVat).toBe(false);
    expect(breakdown.total).toBe(107.7);
  });

  it('keeps cart totals when the selected shipping fee matches the cart snapshot', () => {
    const breakdown = buildCheckoutOrderSummaryFromCart(cart, { amount: 0.01 });

    expect(breakdown.shippingFee).toBe(0.01);
    expect(breakdown.total).toBe(82.3);
    expect(breakdown.showShippingVat).toBe(false);
  });

  it('overlays a different picked method fee without adding fee × rate VAT', () => {
    const breakdown = buildCheckoutOrderSummaryFromCart(cart, { amount: 4.95 });

    expect(breakdown.shippingFee).toBe(4.95);
    expect(breakdown.shippingVat).toBe(0);
    expect(breakdown.showShippingVat).toBe(false);
    expect(breakdown.total).toBe(87.24);
  });

  it('matches checkout and mini-cart totals for the live DE cart + DHL Standard overlay', () => {
    const liveCart: Cart = {
      ...cart,
      tax: { amount: 911.49, netValue: 4797, grossValue: 5708.49, currency: 'EUR' },
      shippingCosts: {
        amount: 0,
        currency: 'EUR',
        tax: {
          amount: 0,
          currency: 'EUR',
          netValue: 0,
          grossValue: 0,
          taxCode: 'ZERO',
          taxRate: 0,
        },
      },
      subTotalPrice: { amount: 5708.49, currency: 'EUR' },
      totalPrice: { amount: 5708.49, currency: 'EUR' },
    };

    const checkout = buildCheckoutOrderSummaryFromCart(liveCart, { amount: 4.95 });
    const miniCart = buildCheckoutOrderSummaryFromCart(liveCart, { amount: 4.95 });

    expect(checkout).toEqual(miniCart);
    expect(checkout.shippingFee).toBe(4.95);
    expect(checkout.total).toBe(5713.44);
  });

  it('does not expose original/savings flags when the cart has no discounts', () => {
    const breakdown = buildCheckoutOrderSummaryFromCart(cart);

    expect(breakdown.hasAppliedCoupons).toBeUndefined();
    expect(breakdown.couponApplyBasis).toBeUndefined();
    expect(breakdown.originalGoodsNet).toBeUndefined();
    expect(breakdown.originalGoodsVat).toBeUndefined();
    expect(breakdown.originalGoodsGross).toBeUndefined();
    expect(breakdown.savingsTotal).toBeUndefined();
    expect(breakdown.goodsDiscountedGross).toBeUndefined();
    expect(breakdown.goodsNet).toBe(69.15);
    expect(breakdown.goodsVat).toBe(13.14);
    expect(breakdown.shippingFee).toBeUndefined();
    expect(breakdown.total).toBe(82.29);
  });

  it('exposes original goods net, discounted goods, and platform savings when coupons apply', () => {
    const breakdown = buildCheckoutOrderSummaryFromCart({
      ...cart,
      discounts: [{ code: 'LS10PTOTAL', discountIndex: 0, amount: 11.22, currency: 'EUR' }],
      savingsTotal: 11.22,
      totalDiscountCalculationType: 'ApplyDiscountBeforeTax',
      includesTax: false,
      goodsDiscountedNet: 57.93,
      goodsDiscountedVat: 11.01,
    });

    expect(breakdown.hasAppliedCoupons).toBe(true);
    expect(breakdown.couponApplyBasis).toBe('net');
    expect(breakdown.originalGoodsNet).toBe(69.15);
    expect(breakdown.originalGoodsVat).toBeUndefined();
    expect(breakdown.originalGoodsGross).toBeUndefined();
    expect(breakdown.goodsDiscountedGross).toBeUndefined();
    expect(breakdown.goodsNet).toBe(57.93);
    expect(breakdown.goodsVat).toBe(11.01);
    expect(breakdown.savingsTotal).toBe(11.22);
  });

  it('flags goodsDiscounted for a goods coupon and leaves shippingFree unset', () => {
    const breakdown = buildCheckoutOrderSummaryFromCart({
      ...cart,
      discounts: [{ code: 'LS10PTOTAL', discountIndex: 0, amount: 11.22, currency: 'EUR' }],
      savingsTotal: 11.22,
      totalDiscountCalculationType: 'ApplyDiscountBeforeTax',
      goodsDiscountedNet: 57.93,
      goodsDiscountedVat: 11.01,
    });

    expect(breakdown.goodsDiscounted).toBe(true);
    expect(breakdown.shippingFree).toBeUndefined();
  });

  it('free-shipping coupon: goods untouched, picked fee shown for strike-through, total not inflated', () => {
    const freeShippingCart: Cart = {
      ...cart,
      discounts: [{ code: 'FREESHIP', discountIndex: 0, amount: 4.95, currency: 'EUR' }],
      savingsTotal: 4.95,
      totalDiscountCalculationType: 'ApplyDiscountBeforeTax',
      goodsDiscountedNet: 69.15,
      goodsDiscountedVat: 13.14,
      freeShipping: true,
      // Emporix zeroes totalShipping; finalPrice already excludes shipping.
      shippingCosts: {
        amount: 0,
        currency: 'EUR',
        tax: { amount: 0, currency: 'EUR', netValue: 0, grossValue: 0, taxCode: 'ZERO', taxRate: 0 },
      },
      totalPrice: { amount: 82.29, currency: 'EUR' },
    };

    const picked = buildCheckoutOrderSummaryFromCart(freeShippingCart, { amount: 4.95 });
    expect(picked.hasAppliedCoupons).toBe(true);
    expect(picked.goodsDiscounted).toBe(false);
    expect(picked.shippingFree).toBe(true);
    expect(picked.goodsNet).toBe(69.15);
    expect(picked.shippingFee).toBe(4.95);
    expect(picked.shippingVat).toBe(0);
    expect(picked.showShippingVat).toBe(false);
    expect(picked.total).toBe(82.29);

    const unpicked = buildCheckoutOrderSummaryFromCart(freeShippingCart);
    expect(unpicked.shippingFree).toBe(true);
    expect(unpicked.shippingFee).toBeUndefined();
    expect(unpicked.total).toBe(82.29);
  });

  it('does not subtract pre-discount shippingCosts from a waived final total', () => {
    const fallbackShippingCart: Cart = {
      ...cart,
      discounts: [{ code: 'FREESHIP', discountIndex: 0, amount: 0, currency: 'EUR', type: 'FREE_SHIPPING' }],
      savingsTotal: 4.95,
      freeShipping: true,
      shippingCosts: {
        amount: 4.95,
        currency: 'EUR',
        tax: { amount: 0, currency: 'EUR', netValue: 4.95, grossValue: 4.95, taxCode: 'STANDARD', taxRate: 0 },
      },
      totalPrice: { amount: 82.29, currency: 'EUR' },
    };

    expect(buildCheckoutOrderSummaryFromCart(fallbackShippingCart, { amount: 4.95 }).total).toBe(82.29);
    expect(buildCheckoutOrderSummaryFromCart(fallbackShippingCart).total).toBe(82.29);
  });

  it('exposes a gross-applied stack when totalDiscountCalculationType is ApplyDiscountAfterTax', () => {
    const tax = { amount: 15.66, netValue: 82.45, grossValue: 98.11, currency: 'EUR' };
    const breakdown = buildCheckoutOrderSummaryFromCart({
      ...cart,
      tax,
      discounts: [{ code: 'GROSS10', discountIndex: 0, amount: 16.11, currency: 'EUR' }],
      savingsTotal: 16.11,
      totalDiscountCalculationType: 'ApplyDiscountAfterTax',
      includesTax: true,
      goodsDiscountedNet: 70,
      goodsDiscountedVat: 12,
      goodsDiscountedGross: 82,
    });

    expect(breakdown.hasAppliedCoupons).toBe(true);
    expect(breakdown.couponApplyBasis).toBe('gross');
    expect(breakdown.originalGoodsNet).toBe(82.45);
    expect(breakdown.originalGoodsVat).toBe(15.66);
    expect(breakdown.originalGoodsVat).not.toBe(breakdown.goodsVat);
    expect(breakdown.originalGoodsGross).toBe(98.11);
    expect(round2((breakdown.originalGoodsNet ?? 0) + (breakdown.originalGoodsVat ?? 0))).toBe(
      breakdown.originalGoodsGross,
    );
    expect(breakdown.savingsTotal).toBe(16.11);
    expect(breakdown.goodsDiscountedGross).toBe(82);
    expect(breakdown.goodsNet).toBe(70);
    expect(breakdown.goodsVat).toBe(12);
  });

  it('uses the goods delta, not savingsTotal, when a shipping waiver is also applied', () => {
    const breakdown = buildCheckoutOrderSummaryFromCart({
      ...cart,
      discounts: [
        { code: 'LS10PTOTAL', discountIndex: 0, amount: 11.22, currency: 'EUR' },
        { code: 'FREESHIP', discountIndex: 1, amount: 4.95, currency: 'EUR', type: 'FREE_SHIPPING' },
      ],
      savingsTotal: 16.17,
      totalDiscountCalculationType: 'ApplyDiscountBeforeTax',
      goodsDiscountedNet: 57.93,
      goodsDiscountedVat: 11.01,
      freeShipping: true,
    });

    expect(breakdown.goodsDiscounted).toBe(true);
    expect(breakdown.shippingFree).toBe(true);
    expect(breakdown.savingsTotal).toBe(11.22);
  });

  it('keeps current goodsNet when savings exist without discounted net', () => {
    const breakdown = buildCheckoutOrderSummaryFromCart({
      ...cart,
      savingsTotal: 6.915,
    });

    expect(breakdown.hasAppliedCoupons).toBe(true);
    expect(breakdown.couponApplyBasis).toBe('net');
    expect(breakdown.originalGoodsNet).toBe(69.15);
    expect(breakdown.savingsTotal).toBe(6.915);
    expect(breakdown.goodsNet).toBe(69.15);
    expect(breakdown.goodsVat).toBe(13.14);
  });
});
