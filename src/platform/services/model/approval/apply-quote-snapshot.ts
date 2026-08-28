import type { Approval, ApprovalDetails } from '@/platform/services/model/approval';
import type { CheckoutAddress, OrderShipping } from '@/platform/services/model/checkout';
import type { Quote } from '@/platform/services/model/quote';

/**
 * QUOTE GET omits `details.shipping` and `taxAggregate`. Skip Quote Service when both
 * paid shipping (net + gross) and a VAT breakdown are already on the snapshot.
 */
export function quoteApprovalNeedsSnapshot(approval: Approval): boolean {
  if (approval.resourceType !== 'QUOTE' || !approval.resource.id) {
    return false;
  }
  const shipping = approval.details?.shipping;
  const hasPaidShipping = typeof shipping?.amount === 'number' && shipping.amount > 0;
  const hasShippingGross = typeof shipping?.grossAmount === 'number';
  const hasTaxAggregate = (approval.resource.taxAggregate?.lines?.length ?? 0) > 0;
  return !(hasPaidShipping && hasShippingGross && hasTaxAggregate);
}

function resolveShipping(existingShipping: OrderShipping | undefined, quote: Quote): OrderShipping | undefined {
  const quoteGross = typeof quote.shippingGross === 'number' ? quote.shippingGross : undefined;
  const hasMappedShipping = typeof existingShipping?.amount === 'number' && existingShipping.amount > 0;

  if (hasMappedShipping) {
    return {
      ...existingShipping,
      grossAmount: existingShipping.grossAmount ?? quoteGross,
    };
  }

  const quoteShippingAmount = quote.shippingCost || 0;
  if (quoteShippingAmount > 0) {
    return {
      methodId: existingShipping?.methodId || quote.shippingMethod || '',
      methodName: existingShipping?.methodName || quote.shippingMethod || '',
      amount: quoteShippingAmount,
      zoneId: existingShipping?.zoneId || '',
      taxCode: existingShipping?.taxCode,
      grossAmount: existingShipping?.grossAmount ?? quoteGross,
    };
  }

  return existingShipping;
}

function resolveAddresses(
  existingAddresses: CheckoutAddress[] | undefined,
  quote: Quote,
): CheckoutAddress[] | undefined {
  if (existingAddresses && existingAddresses.length > 0) {
    return existingAddresses;
  }
  if (quote.shippingAddress) {
    return [quote.shippingAddress];
  }
  return existingAddresses;
}

/**
 * QUOTE approvals omit `details` on create; GET often has no shipping.
 * Overlay Quote Service fields so Approval Details can show the quote shipping fee and VAT breakdown.
 */
export function applyQuoteSnapshotToApproval(approval: Approval, quote: Quote): Approval {
  const details: ApprovalDetails = {
    currency: approval.details?.currency || quote.currency,
    paymentMethods: approval.details?.paymentMethods,
    payment: approval.details?.payment,
    shipping: resolveShipping(approval.details?.shipping, quote),
    addresses: resolveAddresses(approval.details?.addresses, quote),
  };

  return {
    ...approval,
    details,
    resource: {
      ...approval.resource,
      taxAggregate: approval.resource.taxAggregate ?? quote.taxAggregate,
    },
  };
}
