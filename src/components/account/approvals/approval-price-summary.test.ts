import type { Approval } from '@/platform/services/model/approval';
import { resolveApprovalBasePriceBreakdown, resolveApprovalQuotedPriceBreakdown } from './approval-price-summary';

const sampleApproval: Approval = {
  id: '6a63c4f4d2e6011b0eeccc8b',
  status: 'EXPIRED',
  action: 'CHECKOUT',
  resourceType: 'QUOTE',
  resource: {
    id: 'Q1000457',
    items: [
      {
        quantity: 1,
        itemId: '6a2a72c030b791467d3a2622',
        itemPrice: {
          currency: 'EUR',
          amount: 183.14,
          unitPrice: 171,
          newUnitPrice: 153.9,
          netValue: 153.9,
          grossValue: 183.14,
          taxValue: 29.24,
        },
      },
      {
        quantity: 1,
        itemId: '6a0c0ac38793283a1ebfa888',
        itemPrice: {
          currency: 'EUR',
          amount: 24.69,
          unitPrice: 23.05,
          newUnitPrice: 20.75,
          netValue: 20.75,
          grossValue: 24.69,
          taxValue: 3.94,
        },
      },
      {
        quantity: 1,
        itemId: '65465526--65465526002',
        itemPrice: {
          currency: 'EUR',
          amount: 18.21,
          unitPrice: 17,
          newUnitPrice: 15.3,
          netValue: 15.3,
          grossValue: 18.21,
          taxValue: 2.91,
        },
      },
    ],
    totalPrice: { currency: 'EUR', amount: 193.4, netValue: 193.4, grossValue: 229.49, taxValue: 36.09 },
    subTotalPrice: { currency: 'EUR', amount: 189.95, netValue: 189.95, grossValue: 226.04, taxValue: 36.09 },
    subtotalAggregate: { currency: 'EUR', netValue: 189.95, grossValue: 226.04, taxValue: 36.09 },
  },
  requestor: {
    userId: '22958026',
    firstName: 'Pawel',
    lastName: 'Requester2',
    email: 'p.bambynek+requester2@emporix.com',
  },
  approver: {
    userId: '69874565',
    firstName: 'Pawel',
    lastName: 'Admin',
  },
  createdAt: '2026-07-24T20:03:00.428Z',
  updatedAt: '2026-08-03T21:00:00.054Z',
  details: {
    currency: 'EUR',
    shipping: { amount: 0 } as never,
  },
};

describe('approval-price-summary', () => {
  it('builds Base Price from item unitPrice (not gross amount / aggregate)', () => {
    const base = resolveApprovalBasePriceBreakdown(sampleApproval);

    // 171 + 23.05 + 17
    expect(base.netValueOfGoods).toBeCloseTo(211.05, 2);
    // tax ≈ 19% on each base line from calculated tax/net ratios
    expect(base.tax).toBeCloseTo(40.1, 1);
    expect(base.shippingFee).toBe(0);
    expect(base.discountAmount).toBeCloseTo(211.05 - 189.95, 2);
    expect(base.total).toBeCloseTo(base.netValueOfGoods + base.tax + base.shippingFee, 2);
  });

  it('builds Quoted Price from subtotalAggregate.netValue (goods-only)', () => {
    const quoted = resolveApprovalQuotedPriceBreakdown(sampleApproval);

    expect(quoted.netValueOfGoods).toBeCloseTo(189.95, 2);
    expect(quoted.tax).toBeCloseTo(36.09, 2);
    expect(quoted.shippingFee).toBe(0);
    expect(quoted.total).toBeCloseTo(189.95 + 36.09, 2);
    expect(quoted.taxRate).toBe(19);
  });

  it('prefers subtotalAggregate.netValue over a differing subTotalPrice.netValue', () => {
    const approval: Approval = {
      ...sampleApproval,
      resource: {
        ...sampleApproval.resource,
        subTotalPrice: { currency: 'USD', amount: 767.9, netValue: 767.9, grossValue: 900.72, taxValue: 143.82 },
        subtotalAggregate: { currency: 'USD', netValue: 756.9, grossValue: 900.72, taxValue: 143.82 },
      },
    };

    expect(resolveApprovalQuotedPriceBreakdown(approval).netValueOfGoods).toBe(756.9);
  });
});
