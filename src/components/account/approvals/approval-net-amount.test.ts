import type { Approval } from '@/platform/services/model/approval';
import { resolveApprovalNetAmount, resolveApprovalTotalNetAmount } from './approval-net-amount';

const finding26Approval: Approval = {
  id: 'approval-finding-26',
  status: 'PENDING',
  resourceType: 'CART',
  action: 'CHECKOUT',
  resource: {
    id: 'cart-finding-26',
    items: [
      { productId: 'p1', quantity: 1, itemPrice: { currency: 'EUR', amount: 37 } },
      { productId: 'p2', quantity: 1, itemPrice: { currency: 'EUR', amount: 23.05 } },
    ],
    totalPrice: { currency: 'EUR', amount: 63.05 },
    subtotalAggregate: { currency: 'EUR', netValue: 60.05, grossValue: 63.05, taxValue: 3 },
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

const cop6178Approval: Approval = {
  ...finding26Approval,
  id: 'approval-cop-6178',
  resource: {
    ...finding26Approval.resource,
    id: 'cart-cop-6178',
    totalPrice: { currency: 'EUR', amount: 1445.89, netValue: 1205.79 },
    subtotalAggregate: { currency: 'EUR', netValue: 1194.79, grossValue: 1421.8, taxValue: 226.99 },
  },
  details: {
    currency: 'EUR',
    shipping: {
      methodId: 'dhl',
      zoneId: 'de',
      methodName: 'DHL',
      amount: 11,
      taxCode: 'SHIPPING',
    },
  },
};

describe('approval-net-amount', () => {
  it('resolves goods net from subtotalAggregate.netValue only (finding 26: 60.05)', () => {
    const goods = resolveApprovalNetAmount(finding26Approval);

    expect(goods).toEqual({ amount: 60.05, currency: 'EUR' });
    expect(goods?.amount).not.toBe(63.05);
    expect(goods?.amount).not.toBe(finding26Approval.resource.totalPrice?.amount);
  });

  it('resolves total net amount as goods net + shipping net', () => {
    expect(resolveApprovalTotalNetAmount(cop6178Approval)?.amount).toBeCloseTo(1205.79, 2);
    expect(resolveApprovalTotalNetAmount(cop6178Approval)).toEqual({ amount: 1205.79, currency: 'EUR' });
  });

  it('adds shipping amount only and never a shipping-tax term', () => {
    const total = resolveApprovalTotalNetAmount(cop6178Approval);

    expect(total).toEqual({ amount: 1194.79 + 11, currency: 'EUR' });
    expect(total?.amount).not.toBe(1194.79 + 11 + 2.1);
  });

  it('treats missing or undefined shipping as goods only', () => {
    expect(resolveApprovalTotalNetAmount(finding26Approval)).toEqual({ amount: 60.05, currency: 'EUR' });

    const undefinedShipping: Approval = {
      ...finding26Approval,
      details: { currency: 'EUR', shipping: undefined },
    };
    expect(resolveApprovalTotalNetAmount(undefinedShipping)).toEqual({ amount: 60.05, currency: 'EUR' });
  });

  it('leaves the goods helper unchanged when shipping is 11', () => {
    expect(resolveApprovalNetAmount(cop6178Approval)).toEqual({ amount: 1194.79, currency: 'EUR' });
    expect(resolveApprovalNetAmount(cop6178Approval)?.amount).not.toBe(1205.79);
  });

  it('returns null for total net when the goods helper returns null', () => {
    const noGoods: Approval = {
      ...finding26Approval,
      resource: { id: 'cart-empty' },
      details: {
        currency: 'EUR',
        shipping: { methodId: 'dhl', zoneId: 'de', methodName: 'DHL', amount: 11 },
      },
    };

    expect(resolveApprovalNetAmount(noGoods)).toBeNull();
    expect(resolveApprovalTotalNetAmount(noGoods)).toBeNull();
  });
});
