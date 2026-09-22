import type { Approval } from '@/platform/services/model/approval';
import { resolveApprovalCartGoods } from './approval-cart-goods';

function approval(resource: Partial<Approval['resource']> = {}): Approval {
  return {
    id: 'approval-1',
    status: 'PENDING',
    resourceType: 'CART',
    action: 'CHECKOUT',
    resource: {
      id: 'cart-1',
      ...resource,
    },
    requestor: { userId: 'r', firstName: 'R', lastName: 'R', email: 'r@example.com' },
    approver: { userId: 'a', firstName: 'A', lastName: 'A' },
    createdAt: '2026-09-22T00:00:00.000Z',
  };
}

describe('resolveApprovalCartGoods', () => {
  it('treats a lower totalPrice net as the post-coupon goods net', () => {
    const result = resolveApprovalCartGoods(
      approval({
        subtotalAggregate: { currency: 'EUR', netValue: 2600.9, grossValue: 3095.07, taxValue: 494.17 },
        totalPrice: { currency: 'EUR', amount: 2340.81, netValue: 2340.81, grossValue: 2785.56, taxValue: 444.75 },
      }),
      2600.9,
    );

    expect(result.discounted).toBe(true);
    expect(result.originalNet).toBe(2600.9);
    expect(result.net).toBe(2340.81);
    expect(result.vat).toBe(444.75);
    expect(result.savings).toBe(260.09);
  });

  it('does not invent a saving when totalPrice is higher than the goods subtotal', () => {
    const result = resolveApprovalCartGoods(
      approval({
        subtotalAggregate: { currency: 'CHF', netValue: 150, grossValue: 161.55, taxValue: 11.55 },
        totalPrice: { currency: 'CHF', amount: 170, netValue: 170, grossValue: 182.29, taxValue: 12.29 },
      }),
      150,
    );

    expect(result.discounted).toBe(false);
    expect(result.net).toBe(150);
    expect(result.savings).toBeUndefined();
  });

  it('keeps the line goods net when no charged total is present', () => {
    const result = resolveApprovalCartGoods(
      approval({
        subtotalAggregate: { currency: 'EUR', netValue: 100, grossValue: 119, taxValue: 19 },
      }),
      100,
    );

    expect(result.discounted).toBe(false);
    expect(result.net).toBe(100);
    expect(result.vat).toBe(19);
  });
});
