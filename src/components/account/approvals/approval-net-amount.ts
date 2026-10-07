import type { Approval } from '@/platform/services/model/approval';

/**
 * Resolves the model-backed goods net (header “Total net amount” via
 * `resolveApprovalTotalNetAmount`). CART Order Overview “Total value of goods”
 * uses `totalPrice.grossValue` in `approval-cart-overview.ts` (shipping is not
 * in that snapshot).
 *
 * Finding 26: do not use `resource.totalPrice.amount` for net display — that field
 * is often VAT-inclusive (e.g. 63.05) while net of goods is `subtotalAggregate.netValue`
 * (e.g. 60.05). Matches ApprovalsTable Net Total (`resource.subtotalAggregate.netValue`).
 *
 * Preference (model fields only, no UI arithmetic):
 * 1. `subtotalAggregate.netValue`
 * 2. `subTotalPrice.netValue` ?? `subTotalPrice.amount`
 * 3. `totalPrice.netValue` when explicitly present
 *
 * Never falls back to `totalPrice.amount`.
 */
export function resolveApprovalNetAmount(approval: Approval): { amount: number; currency: string } | null {
  const aggregate = approval.resource.subtotalAggregate;
  if (aggregate) {
    return { amount: aggregate.netValue, currency: aggregate.currency };
  }

  const subTotal = approval.resource.subTotalPrice;
  if (subTotal) {
    return {
      amount: subTotal.netValue ?? subTotal.amount,
      currency: subTotal.currency,
    };
  }

  const totalPrice = approval.resource.totalPrice;
  if (totalPrice?.netValue != null) {
    return { amount: totalPrice.netValue, currency: totalPrice.currency };
  }

  return null;
}

/**
 * Header “Total net amount”: goods net + net shipping (excludes shipping tax).
 * Goods come from `resolveApprovalNetAmount`. Shipping is `details.shipping.amount ?? 0`.
 */
export function resolveApprovalTotalNetAmount(approval: Approval): { amount: number; currency: string } | null {
  const goods = resolveApprovalNetAmount(approval);
  if (!goods) {
    return null;
  }

  return {
    amount: goods.amount + (approval.details?.shipping?.amount ?? 0),
    currency: goods.currency,
  };
}
