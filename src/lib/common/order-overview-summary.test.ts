import type { Order } from '@/platform/services/model/order/order';
import { buildOrderOverviewBreakdown } from './order-overview-summary';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const noCouponOrder: Order = {
  id: 'order-1',
  status: 'CREATED',
  items: [],
  currency: 'EUR',
  price: {
    subtotal: { net: 100, gross: 119, tax: 19, currency: 'EUR' },
    total: { net: 100, gross: 119, tax: 19, currency: 'EUR' },
  },
  shipping: {
    methods: [{ id: 'pickup', name: 'Pickup', price: 5, currency: 'EUR' }],
    total: { value: 5, currency: 'EUR' },
  },
};

describe('buildOrderOverviewBreakdown', () => {
  it('keeps the no-coupon sequence inputs: net value of goods, VAT, shipping, total', () => {
    const breakdown = buildOrderOverviewBreakdown(noCouponOrder);

    expect(breakdown.goodsNet).toBe(100);
    expect(breakdown.goodsVat).toBe(19);
    expect(breakdown.shippingFee).toBe(5);
    expect(breakdown.total).toBe(119);
    expect(breakdown.currency).toBe('EUR');
    expect(breakdown.hasAppliedCoupons).toBeUndefined();
    expect(breakdown.couponApplyBasis).toBeUndefined();
    expect(breakdown.originalGoodsNet).toBeUndefined();
    expect(breakdown.originalGoodsVat).toBeUndefined();
    expect(breakdown.originalGoodsGross).toBeUndefined();
    expect(breakdown.savingsTotal).toBeUndefined();
    expect(breakdown.goodsDiscountedGross).toBeUndefined();
    expect(breakdown.discounts).toBeUndefined();
  });

  it('exposes a net-applied coupon box and savings when coupons apply before tax', () => {
    const breakdown = buildOrderOverviewBreakdown({
      ...noCouponOrder,
      discounts: [
        { code: 'TOTAL', value: 101.1, currency: 'EUR' },
        { code: '10POFF', value: 101.1, currency: 'EUR' },
      ],
      savingsTotal: 101.1,
      totalDiscountCalculationType: 'ApplyDiscountBeforeTax',
      includesTax: false,
      goodsDiscountedNet: 909.89,
      goodsDiscountedVat: 172.88,
      goodsDiscountedGross: 1082.77,
      price: {
        subtotal: { net: 1010.99, gross: 1203.08, tax: 192.09, currency: 'EUR', taxRate: 19 },
        total: { net: 909.89, gross: 1082.77, tax: 172.88, currency: 'EUR' },
      },
      shipping: undefined,
    });

    expect(breakdown.hasAppliedCoupons).toBe(true);
    expect(breakdown.couponApplyBasis).toBe('net');
    expect(breakdown.discounts?.map((discount) => discount.code)).toEqual(['TOTAL', '10POFF']);
    expect(breakdown.originalGoodsNet).toBe(1010.99);
    expect(breakdown.originalGoodsVat).toBeUndefined();
    expect(breakdown.originalGoodsGross).toBeUndefined();
    expect(breakdown.goodsDiscountedGross).toBeUndefined();
    expect(breakdown.goodsNet).toBe(909.89);
    expect(breakdown.goodsVat).toBe(172.88);
    expect(breakdown.savingsTotal).toBe(101.1);
    expect(breakdown.total).toBe(1082.77);
    expect(breakdown.shippingFee).toBeUndefined();
  });

  it('exposes a gross-applied coupon box when totalDiscountCalculationType is ApplyDiscountAfterTax', () => {
    const breakdown = buildOrderOverviewBreakdown({
      ...noCouponOrder,
      discounts: [{ code: 'GROSS10', value: 16.11, currency: 'EUR' }],
      savingsTotal: 16.11,
      totalDiscountCalculationType: 'ApplyDiscountAfterTax',
      includesTax: true,
      goodsDiscountedNet: 70,
      goodsDiscountedVat: 12,
      goodsDiscountedGross: 82,
      price: {
        subtotal: { net: 82.45, gross: 98.11, tax: 15.66, currency: 'EUR' },
        total: { net: 70, gross: 86.95, tax: 12, currency: 'EUR' },
      },
      shipping: undefined,
    });

    expect(breakdown.hasAppliedCoupons).toBe(true);
    expect(breakdown.couponApplyBasis).toBe('gross');
    expect(breakdown.discounts).toEqual([{ code: 'GROSS10', value: 16.11, currency: 'EUR' }]);
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
    expect(breakdown.total).toBe(86.95);
  });

  it('omits goodsDiscountedGross when after-tax orders have no discountedPrice', () => {
    const breakdown = buildOrderOverviewBreakdown({
      ...noCouponOrder,
      discounts: [{ code: 'SHIPFREE', value: 6.5, currency: 'EUR' }],
      savingsTotal: 6.5,
      totalDiscountCalculationType: 'ApplyDiscountAfterTax',
      includesTax: true,
    });

    expect(breakdown.hasAppliedCoupons).toBe(true);
    expect(breakdown.couponApplyBasis).toBe('gross');
    expect(breakdown.originalGoodsGross).toBe(119);
    expect(breakdown.goodsDiscountedGross).toBeUndefined();
  });
});
