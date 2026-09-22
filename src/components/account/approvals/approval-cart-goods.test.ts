import type { Approval } from '@/platform/services/model/approval';
import { resolveApprovalCartGoods } from './approval-cart-goods';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

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

  it('does not treat goods plus shipping as a coupon when the total is higher only by shipping', () => {
    const result = resolveApprovalCartGoods(
      {
        ...approval({
          subtotalAggregate: { currency: 'EUR', netValue: 1194.79, grossValue: 1421.8, taxValue: 226.99 },
          totalPrice: { currency: 'EUR', amount: 1445.89, netValue: 1205.79, grossValue: 1445.89, taxValue: 240.1 },
        }),
        details: {
          currency: 'EUR',
          shipping: { methodId: 'dhl', zoneId: 'de', methodName: 'DHL', amount: 11 },
        },
      },
      1194.79,
    );

    expect(result.discounted).toBe(false);
    expect(result.net).toBe(1194.79);
    expect(result.savings).toBeUndefined();
  });

  it('keeps a goods-only charged total when shipping details are present beside it', () => {
    const result = resolveApprovalCartGoods(
      {
        ...approval({
          subtotalAggregate: { currency: 'EUR', netValue: 1194.79, grossValue: 1421.8, taxValue: 226.99 },
          totalPrice: { currency: 'EUR', amount: 1194.79, netValue: 1194.79, grossValue: 1421.8, taxValue: 226.99 },
        }),
        details: {
          currency: 'EUR',
          shipping: {
            methodId: 'dhl',
            zoneId: 'de',
            methodName: 'DHL',
            amount: 11,
            grossAmount: 12.19,
          },
        },
      },
      1194.79,
    );

    expect(result.discounted).toBe(false);
    expect(result.net).toBe(1194.79);
    expect(result.vat).toBe(226.99);
    expect(result.savings).toBeUndefined();
  });

  it('detects a coupon smaller than shipping after stripping shipping net from the charged total', () => {
    const result = resolveApprovalCartGoods(
      {
        ...approval({
          subtotalAggregate: { currency: 'EUR', netValue: 1194.79, grossValue: 1421.8, taxValue: 226.99 },
          totalPrice: { currency: 'EUR', amount: 1200.79, netValue: 1200.79, grossValue: 1428.94, taxValue: 228.15 },
        }),
        details: {
          currency: 'EUR',
          shipping: { methodId: 'dhl', zoneId: 'de', methodName: 'DHL', amount: 11 },
        },
      },
      1194.79,
    );

    expect(result.discounted).toBe(true);
    expect(result.net).toBe(1189.79);
    expect(result.savings).toBe(5);
  });

  it('strips shipping from a coupon larger than shipping when gross stays on the goods', () => {
    const goodsNet = 1174.79;
    const goodsVat = 223.21;
    const result = resolveApprovalCartGoods(
      {
        ...approval({
          subtotalAggregate: { currency: 'EUR', netValue: 1194.79, grossValue: 1421.8, taxValue: 226.99 },
          totalPrice: {
            currency: 'EUR',
            amount: goodsNet + 11,
            netValue: goodsNet + 11,
            grossValue: roundMoney(goodsNet + goodsVat),
            taxValue: goodsVat,
          },
        }),
        details: {
          currency: 'EUR',
          shipping: { methodId: 'dhl', zoneId: 'de', methodName: 'DHL', amount: 11 },
        },
      },
      1194.79,
    );

    expect(result.discounted).toBe(true);
    expect(result.net).toBe(1174.79);
    expect(result.savings).toBe(20);
    expect(result.vat).toBe(223.21);
  });

  it('keeps a goods-only discounted total when shipping details are stored separately', () => {
    const result = resolveApprovalCartGoods(
      {
        ...approval({
          subtotalAggregate: { currency: 'EUR', netValue: 100, grossValue: 119, taxValue: 19 },
          totalPrice: { currency: 'EUR', amount: 90, netValue: 90, grossValue: 107.1, taxValue: 17.1 },
        }),
        details: {
          currency: 'EUR',
          shipping: {
            methodId: 'dhl',
            zoneId: 'de',
            methodName: 'DHL',
            amount: 11,
            grossAmount: 12.19,
          },
        },
      },
      100,
    );

    expect(result.discounted).toBe(true);
    expect(result.net).toBe(90);
    expect(result.vat).toBe(17.1);
    expect(result.savings).toBe(10);
  });

  it('strips shipping VAT when gross excludes shipping and taxValue includes it', () => {
    const goodsNet = 1174.79;
    const goodsVat = 223.21;
    const shippingVat = 2.09;
    const result = resolveApprovalCartGoods(
      {
        ...approval({
          subtotalAggregate: { currency: 'EUR', netValue: 1194.79, grossValue: 1421.8, taxValue: 226.99 },
          totalPrice: {
            currency: 'EUR',
            amount: goodsNet + 11,
            netValue: goodsNet + 11,
            grossValue: roundMoney(goodsNet + goodsVat),
            taxValue: roundMoney(goodsVat + shippingVat),
          },
        }),
        details: {
          currency: 'EUR',
          shipping: {
            methodId: 'dhl',
            zoneId: 'de',
            methodName: 'DHL',
            amount: 11,
            grossAmount: 13.09,
          },
        },
      },
      1194.79,
    );

    expect(result.discounted).toBe(true);
    expect(result.net).toBe(1174.79);
    expect(result.vat).toBe(223.21);
    expect(result.savings).toBe(20);
  });

  it('strips shipping VAT from totalPrice.taxValue when grossAmount or taxRate is known', () => {
    const withGross = resolveApprovalCartGoods(
      {
        ...approval({
          subtotalAggregate: { currency: 'EUR', netValue: 100, grossValue: 119, taxValue: 19 },
          totalPrice: { currency: 'EUR', amount: 101, netValue: 101, grossValue: 121.19, taxValue: 20.19 },
        }),
        details: {
          currency: 'EUR',
          shipping: { methodId: 'dhl', zoneId: 'de', methodName: 'DHL', amount: 11, grossAmount: 12.19 },
        },
      },
      100,
    );
    const withRate = resolveApprovalCartGoods(
      {
        ...approval({
          subtotalAggregate: { currency: 'EUR', netValue: 100, grossValue: 119, taxValue: 19 },
          totalPrice: { currency: 'EUR', amount: 101, netValue: 101, grossValue: 121.1, taxValue: 20.1 },
        }),
        details: {
          currency: 'EUR',
          shipping: { methodId: 'dhl', zoneId: 'de', methodName: 'DHL', amount: 11, taxRate: 10 },
        },
      },
      100,
    );

    expect(withGross.discounted).toBe(true);
    expect(withGross.net).toBe(90);
    expect(withGross.vat).toBe(19);
    expect(withGross.savings).toBe(10);
    expect(withRate.vat).toBe(19);
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
