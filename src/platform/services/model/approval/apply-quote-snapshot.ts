import type { Approval, ApprovalDetails } from '@/platform/services/model/approval';
import type { Quote } from '@/platform/services/model/quote';

/**
 * QUOTE approvals omit `details` on create; GET often has no shipping.
 * Overlay Quote Service fields so Approval Details can show the quote shipping fee and VAT breakdown.
 */
export function applyQuoteSnapshotToApproval(approval: Approval, quote: Quote): Approval {
  const quoteShippingAmount = quote.shippingCost || 0;
  const existingShipping = approval.details?.shipping;
  const hasMappedShipping = typeof existingShipping?.amount === 'number' && existingShipping.amount > 0;
  const quoteGross = typeof quote.shippingGross === 'number' ? quote.shippingGross : undefined;

  const shipping = hasMappedShipping
    ? {
        ...existingShipping,
        grossAmount: existingShipping.grossAmount ?? quoteGross,
      }
    : quoteShippingAmount > 0
      ? {
          methodId: existingShipping?.methodId || quote.shippingMethod || '',
          methodName: existingShipping?.methodName || quote.shippingMethod || '',
          amount: quoteShippingAmount,
          zoneId: existingShipping?.zoneId || '',
          taxCode: existingShipping?.taxCode,
          grossAmount: existingShipping?.grossAmount ?? quoteGross,
        }
      : existingShipping;

  const existingAddresses = approval.details?.addresses;
  const addresses =
    existingAddresses && existingAddresses.length > 0
      ? existingAddresses
      : quote.shippingAddress
        ? [quote.shippingAddress]
        : existingAddresses;

  const details: ApprovalDetails = {
    currency: approval.details?.currency || quote.currency,
    paymentMethods: approval.details?.paymentMethods,
    payment: approval.details?.payment,
    shipping,
    addresses,
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
