import type { Approval } from '@/platform/services/model/approval';
import { resolveCartOrderOverviewShippingTax, resolveCartOrderOverviewTotalGross } from './approval-cart-overview';

const chApproval: Approval = {
  id: 'approval-ch',
  status: 'PENDING',
  resourceType: 'CART',
  action: 'CHECKOUT',
  resource: {
    id: 'cart-ch',
    totalPrice: {
      currency: 'CHF',
      amount: 170,
      netValue: 170,
      grossValue: 182.29,
      taxValue: 12.29,
    },
    subtotalAggregate: { currency: 'CHF', netValue: 150, grossValue: 161.55, taxValue: 11.55 },
  },
  requestor: {
    userId: 'requestor-1',
    firstName: 'Requester',
    lastName: 'One',
    email: 'requestor@example.com',
  },
  approver: {
    userId: 'approver-1',
    firstName: 'Approver',
    lastName: 'One',
  },
  createdAt: '2026-06-03T07:09:38.112Z',
};

describe('approval-cart-overview', () => {
  it('reads Total from totalPrice.grossValue and never from amount/netValue', () => {
    expect(resolveCartOrderOverviewTotalGross(chApproval)).toBe(182.29);
    expect(resolveCartOrderOverviewTotalGross(chApproval)).not.toBe(170);
  });

  it('estimates shipping tax as gross leftover after goods net, VAT, and shipping fee', () => {
    const result = resolveCartOrderOverviewShippingTax({
      totalGross: 182.29,
      shippingFee: 20,
      goodsNet: 150,
      goodsVat: 11.55,
    });

    expect(result.shippingTaxEstimated).toBe(0.74);
    expect(result.showShippingTaxEstimated).toBe(true);
  });

  it('hides the shipping-tax row when shipping is free, even if leftover would be positive', () => {
    const result = resolveCartOrderOverviewShippingTax({
      totalGross: 182.29,
      shippingFee: 0,
      goodsNet: 150,
      goodsVat: 11.55,
    });

    expect(result.shippingTaxEstimated).toBe(0);
    expect(result.showShippingTaxEstimated).toBe(false);
  });

  it('hides the shipping-tax row when the leftover is 0', () => {
    const result = resolveCartOrderOverviewShippingTax({
      totalGross: 63.05,
      shippingFee: 0,
      goodsNet: 60.05,
      goodsVat: 3,
    });

    expect(result.shippingTaxEstimated).toBe(0);
    expect(result.showShippingTaxEstimated).toBe(false);
  });

  it('hides the shipping-tax row when leftover is negative (snapshot total excludes selected shipping)', () => {
    const result = resolveCartOrderOverviewShippingTax({
      totalGross: 63.05,
      shippingFee: 11,
      goodsNet: 60.05,
      goodsVat: 3,
    });

    expect(result.shippingTaxEstimated).toBeLessThanOrEqual(0);
    expect(result.showShippingTaxEstimated).toBe(false);
  });

  it('hides the shipping-tax row when totalPrice.grossValue is missing', () => {
    const result = resolveCartOrderOverviewShippingTax({
      shippingFee: 20,
      goodsNet: 150,
      goodsVat: 11.55,
    });

    expect(result.showShippingTaxEstimated).toBe(false);
    expect(resolveCartOrderOverviewTotalGross({ ...chApproval, resource: { id: 'cart-1' } })).toBeUndefined();
  });
});
