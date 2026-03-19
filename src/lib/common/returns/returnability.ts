import type { ReturnStatus } from '@/platform/services/model/return';

/**
 * Return statuses that count toward "already returned" quantities.
 * Excludes REJECTED since those returns were denied and items are still available.
 */
const COUNTED_RETURN_STATUSES: ReadonlySet<ReturnStatus> = new Set<ReturnStatus>([
  'PENDING',
  'APPROVED',
  'REVIEWED',
  'CLOSED',
]);

export interface ReturnItemSummary {
  itemId: string;
  orderedQuantity: number;
  alreadyReturned: number;
  remaining: number;
}

export interface OrderReturnability {
  orderItemSummaries: ReturnItemSummary[];
  hasAnyReturnableItem: boolean;
}

interface OrderItemInput {
  id: string;
  quantity: number;
}

interface HistoricalReturnItem {
  id: string;
  quantity: number;
}

interface HistoricalReturnOrder {
  id: string;
  items: HistoricalReturnItem[];
}

interface HistoricalReturn {
  status: ReturnStatus;
  orders: HistoricalReturnOrder[];
}

export function isReturnStatusCounted(status: ReturnStatus): boolean {
  return COUNTED_RETURN_STATUSES.has(status);
}

/**
 * Computes per-item returnability for an order given its items and
 * all historical returns that reference that order.
 */
export function computeOrderReturnability(
  orderId: string,
  orderItems: OrderItemInput[],
  historicalReturns: HistoricalReturn[],
): OrderReturnability {
  const returnedByItem = new Map<string, number>();

  for (const ret of historicalReturns) {
    if (!isReturnStatusCounted(ret.status)) {
      continue;
    }

    for (const order of ret.orders) {
      if (order.id !== orderId) {
        continue;
      }
      for (const item of order.items) {
        const prev = returnedByItem.get(item.id) ?? 0;
        returnedByItem.set(item.id, prev + item.quantity);
      }
    }
  }

  const orderItemSummaries: ReturnItemSummary[] = orderItems.map((item) => {
    const alreadyReturned = returnedByItem.get(item.id) ?? 0;
    const remaining = Math.max(0, item.quantity - alreadyReturned);

    return {
      itemId: item.id,
      orderedQuantity: item.quantity,
      alreadyReturned,
      remaining,
    };
  });

  const hasAnyReturnableItem = orderItemSummaries.some((s) => s.remaining > 0);

  return { orderItemSummaries, hasAnyReturnableItem };
}

/**
 * Builds a lookup map from item ID to remaining returnable quantity.
 */
export function buildRemainingQuantityMap(returnability: OrderReturnability): Map<string, number> {
  const map = new Map<string, number>();
  for (const summary of returnability.orderItemSummaries) {
    map.set(summary.itemId, summary.remaining);
  }
  return map;
}
