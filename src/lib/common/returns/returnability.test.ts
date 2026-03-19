import type { ReturnStatus } from '@/platform/services/model/return';
import { buildRemainingQuantityMap, computeOrderReturnability, isReturnStatusCounted } from './returnability';

describe('isReturnStatusCounted', () => {
  it.each<[ReturnStatus, boolean]>([
    ['PENDING', true],
    ['APPROVED', true],
    ['REVIEWED', true],
    ['CLOSED', true],
    ['REJECTED', false],
  ])('status %s should return %s', (status, expected) => {
    expect(isReturnStatusCounted(status)).toBe(expected);
  });
});

describe('computeOrderReturnability', () => {
  const orderId = 'order-1';

  const makeReturn = (
    status: ReturnStatus,
    items: Array<{ id: string; quantity: number }>,
    returnOrderId = orderId,
  ) => ({
    status,
    orders: [{ id: returnOrderId, items }],
  });

  it('returns full quantity when no historical returns exist', () => {
    const result = computeOrderReturnability(
      orderId,
      [
        { id: 'item-a', quantity: 5 },
        { id: 'item-b', quantity: 3 },
      ],
      [],
    );

    expect(result.hasAnyReturnableItem).toBe(true);
    expect(result.orderItemSummaries).toEqual([
      { itemId: 'item-a', orderedQuantity: 5, alreadyReturned: 0, remaining: 5 },
      { itemId: 'item-b', orderedQuantity: 3, alreadyReturned: 0, remaining: 3 },
    ]);
  });

  it('reduces remaining by counted return quantities', () => {
    const result = computeOrderReturnability(
      orderId,
      [{ id: 'item-a', quantity: 10 }],
      [makeReturn('APPROVED', [{ id: 'item-a', quantity: 3 }])],
    );

    expect(result.orderItemSummaries[0]).toEqual({
      itemId: 'item-a',
      orderedQuantity: 10,
      alreadyReturned: 3,
      remaining: 7,
    });
    expect(result.hasAnyReturnableItem).toBe(true);
  });

  it('aggregates across multiple returns', () => {
    const result = computeOrderReturnability(
      orderId,
      [{ id: 'item-a', quantity: 10 }],
      [makeReturn('PENDING', [{ id: 'item-a', quantity: 4 }]), makeReturn('CLOSED', [{ id: 'item-a', quantity: 3 }])],
    );

    expect(result.orderItemSummaries[0].alreadyReturned).toBe(7);
    expect(result.orderItemSummaries[0].remaining).toBe(3);
  });

  it('excludes REJECTED returns from aggregation', () => {
    const result = computeOrderReturnability(
      orderId,
      [{ id: 'item-a', quantity: 5 }],
      [
        makeReturn('APPROVED', [{ id: 'item-a', quantity: 2 }]),
        makeReturn('REJECTED', [{ id: 'item-a', quantity: 3 }]),
      ],
    );

    expect(result.orderItemSummaries[0].alreadyReturned).toBe(2);
    expect(result.orderItemSummaries[0].remaining).toBe(3);
  });

  it('clamps remaining at zero when over-returned', () => {
    const result = computeOrderReturnability(
      orderId,
      [{ id: 'item-a', quantity: 2 }],
      [makeReturn('APPROVED', [{ id: 'item-a', quantity: 5 }])],
    );

    expect(result.orderItemSummaries[0].remaining).toBe(0);
    expect(result.hasAnyReturnableItem).toBe(false);
  });

  it('ignores returns for different orders', () => {
    const result = computeOrderReturnability(
      orderId,
      [{ id: 'item-a', quantity: 5 }],
      [makeReturn('APPROVED', [{ id: 'item-a', quantity: 5 }], 'other-order')],
    );

    expect(result.orderItemSummaries[0].alreadyReturned).toBe(0);
    expect(result.orderItemSummaries[0].remaining).toBe(5);
  });

  it('handles empty order items', () => {
    const result = computeOrderReturnability(orderId, [], []);
    expect(result.orderItemSummaries).toEqual([]);
    expect(result.hasAnyReturnableItem).toBe(false);
  });

  it('handles items in returns not present in order items', () => {
    const result = computeOrderReturnability(
      orderId,
      [{ id: 'item-a', quantity: 5 }],
      [makeReturn('APPROVED', [{ id: 'item-unknown', quantity: 3 }])],
    );

    expect(result.orderItemSummaries).toHaveLength(1);
    expect(result.orderItemSummaries[0].remaining).toBe(5);
  });

  it('returns hasAnyReturnableItem false when all items fully returned', () => {
    const result = computeOrderReturnability(
      orderId,
      [
        { id: 'item-a', quantity: 2 },
        { id: 'item-b', quantity: 3 },
      ],
      [
        makeReturn('APPROVED', [
          { id: 'item-a', quantity: 2 },
          { id: 'item-b', quantity: 3 },
        ]),
      ],
    );

    expect(result.hasAnyReturnableItem).toBe(false);
  });

  it('handles mixed return statuses correctly', () => {
    const result = computeOrderReturnability(
      orderId,
      [{ id: 'item-a', quantity: 10 }],
      [
        makeReturn('PENDING', [{ id: 'item-a', quantity: 2 }]),
        makeReturn('REJECTED', [{ id: 'item-a', quantity: 3 }]),
        makeReturn('REVIEWED', [{ id: 'item-a', quantity: 1 }]),
        makeReturn('CLOSED', [{ id: 'item-a', quantity: 4 }]),
      ],
    );

    expect(result.orderItemSummaries[0].alreadyReturned).toBe(7);
    expect(result.orderItemSummaries[0].remaining).toBe(3);
  });
});

describe('buildRemainingQuantityMap', () => {
  it('creates a map from item summaries', () => {
    const returnability = computeOrderReturnability(
      'order-1',
      [
        { id: 'item-a', quantity: 5 },
        { id: 'item-b', quantity: 3 },
      ],
      [],
    );

    const map = buildRemainingQuantityMap(returnability);
    expect(map.get('item-a')).toBe(5);
    expect(map.get('item-b')).toBe(3);
  });
});
