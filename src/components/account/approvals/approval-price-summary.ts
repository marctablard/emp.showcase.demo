import type { Approval, ApprovalPrice, ApprovalResourceItem } from '@/platform/services/model/approval';

export interface ApprovalPriceCardBreakdown {
  netValueOfGoods: number;
  tax: number;
  shippingFee: number;
  /** Net goods + tax + net shipping (matches Quote Base/Quoted card footers). */
  total: number;
  /** Net savings vs quoted goods when Base uses `unitPrice`. */
  discountAmount: number;
  taxRate?: number;
}

function shippingFeeOf(approval: Approval): number {
  return approval.details?.shipping?.amount ?? 0;
}

/** Effective tax rate % from mapped line price fields (approval API has no taxRate). */
export function resolveApprovalItemTaxRate(price: ApprovalPrice): number | undefined {
  const net = price.netValue ?? price.newUnitPrice;
  if (typeof net === 'number' && net > 0 && typeof price.taxValue === 'number') {
    return (price.taxValue / net) * 100;
  }
  if (typeof net === 'number' && net > 0 && typeof price.grossValue === 'number') {
    return ((price.grossValue - net) / net) * 100;
  }
  return undefined;
}

function lineQuotedNet(item: ApprovalResourceItem): number {
  const price = item.itemPrice;
  const qty = item.quantity || 1;
  if (typeof price.newUnitPrice === 'number') {
    return price.newUnitPrice * qty;
  }
  if (typeof price.netValue === 'number') {
    return price.netValue;
  }
  return price.amount || 0;
}

function lineBaseNet(item: ApprovalResourceItem): number {
  const price = item.itemPrice;
  const qty = item.quantity || 1;
  if (typeof price.unitPrice === 'number') {
    return price.unitPrice * qty;
  }
  return lineQuotedNet(item);
}

function lineBaseTax(item: ApprovalResourceItem): number {
  const price = item.itemPrice;
  const qty = item.quantity || 1;
  const rate = resolveApprovalItemTaxRate(price);
  if (typeof price.unitPrice === 'number' && typeof rate === 'number') {
    return price.unitPrice * qty * (rate / 100);
  }
  if (typeof price.taxValue === 'number') {
    return price.taxValue;
  }
  return 0;
}

function quotedNetFromResource(approval: Approval, items: ApprovalResourceItem[]): number {
  // Goods-only net: prefer subtotalAggregate (matches Emporix taxable subtotal object).
  // subTotalPrice.netValue can include shipping / differ from goods subtotal.
  const aggregateNet = approval.resource.subtotalAggregate?.netValue;
  if (typeof aggregateNet === 'number') {
    return aggregateNet;
  }
  const subTotalNet = approval.resource.subTotalPrice?.netValue;
  if (typeof subTotalNet === 'number') {
    return subTotalNet;
  }
  return items.reduce((sum, item) => sum + lineQuotedNet(item), 0);
}

function quotedTaxFromResource(approval: Approval, items: ApprovalResourceItem[]): number {
  const aggregateTax = approval.resource.subtotalAggregate?.taxValue;
  if (typeof aggregateTax === 'number') {
    return aggregateTax;
  }
  const subTotalTax = approval.resource.subTotalPrice?.taxValue;
  if (typeof subTotalTax === 'number') {
    return subTotalTax;
  }
  return items.reduce((sum, item) => sum + (item.itemPrice.taxValue || 0), 0);
}

function roundedTaxRate(tax: number, net: number): number | undefined {
  if (net <= 0 || tax <= 0) {
    return undefined;
  }
  return Math.round((tax / net) * 100);
}

/**
 * Base Price card: pre-discount totals from item `unitPrice` (same approach as Quote details).
 */
export function resolveApprovalBasePriceBreakdown(approval: Approval): ApprovalPriceCardBreakdown {
  const items = approval.resource.items || [];
  const shippingFee = shippingFeeOf(approval);
  const quotedNet = quotedNetFromResource(approval, items);
  const hasUnitPrices = items.some((item) => typeof item.itemPrice.unitPrice === 'number');

  if (!hasUnitPrices) {
    const tax = quotedTaxFromResource(approval, items);
    return {
      netValueOfGoods: quotedNet,
      tax,
      shippingFee,
      total: quotedNet + tax + shippingFee,
      discountAmount: 0,
      taxRate: roundedTaxRate(tax, quotedNet),
    };
  }

  let netValueOfGoods = 0;
  let tax = 0;
  const rates = new Set<number>();

  for (const item of items) {
    netValueOfGoods += lineBaseNet(item);
    tax += lineBaseTax(item);
    const rate = resolveApprovalItemTaxRate(item.itemPrice);
    if (typeof rate === 'number') {
      rates.add(Math.round(rate));
    }
  }

  return {
    netValueOfGoods,
    tax,
    shippingFee,
    total: netValueOfGoods + tax + shippingFee,
    discountAmount: Math.max(0, netValueOfGoods - quotedNet),
    taxRate: rates.size === 1 ? [...rates][0] : roundedTaxRate(tax, netValueOfGoods),
  };
}

/**
 * Quoted Price card: discounted goods from aggregates / `newUnitPrice`.
 */
export function resolveApprovalQuotedPriceBreakdown(approval: Approval): ApprovalPriceCardBreakdown {
  const items = approval.resource.items || [];
  const netValueOfGoods = quotedNetFromResource(approval, items);
  const tax = quotedTaxFromResource(approval, items);
  const shippingFee = shippingFeeOf(approval);

  return {
    netValueOfGoods,
    tax,
    shippingFee,
    total: netValueOfGoods + tax + shippingFee,
    discountAmount: 0,
    taxRate: roundedTaxRate(tax, netValueOfGoods),
  };
}
