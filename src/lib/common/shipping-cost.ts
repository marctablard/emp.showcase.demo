import type { ShippingMethod } from '@/platform/services/model/shipping';

/**
 * Lowest resolved shipping fee among methods. Returns `undefined` when the list is empty
 * or no method has a resolvable `cost.amount` (caller should hide the cost line).
 */
export function resolveDefaultShippingCost(methods: ShippingMethod[]): number | undefined {
  let lowest: number | undefined;

  for (const method of methods) {
    const amount = method.cost?.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      continue;
    }
    if (lowest === undefined || amount < lowest) {
      lowest = amount;
    }
  }

  return lowest;
}
