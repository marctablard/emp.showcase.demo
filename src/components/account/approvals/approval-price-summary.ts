import { resolveSharedPositiveTaxRate } from '@/lib/common/tax-aggregate';
import type { Approval, ApprovalPrice, ApprovalResourceItem } from '@/platform/services/model/approval';

export interface ApprovalPriceCardBreakdown {
  netValueOfGoods: number;
  tax: number;
  shippingFee: number;
  /**
   * Shipping tax from Quote `shipping.grossValue − shipping.value`.
   * Hidden when shipping fee is 0 or gross is absent (Approval GET has net amount only).
   */
  shippingTax: number;
  showShippingTax: boolean;
  /** Net goods + tax + net shipping + shipping tax (matches Quote Base/Quoted card footers). */
  total: number;
  /** Net savings vs quoted goods when Base uses `unitPrice`. */
  discountAmount: number;
  taxRate?: number;
  shippingTaxRate?: number;
}

function shippingFeeOf(approval: Approval): number {
  return approval.details?.shipping?.amount ?? 0;
}

function resolveApprovalShippingTax(approval: Approval): { shippingTax: number; showShippingTax: boolean } {
  const shippingFee = shippingFeeOf(approval);
  if (shippingFee === 0) {
    return { shippingTax: 0, showShippingTax: false };
  }
  const gross = approval.details?.shipping?.grossAmount;
  if (typeof gross !== 'number') {
    return { shippingTax: 0, showShippingTax: false };
  }
  const shippingTax = Math.max(0, gross - shippingFee);
  return { shippingTax, showShippingTax: shippingTax > 0 };
}

function sumApprovalPriceCardLines(
  breakdown: Pick<ApprovalPriceCardBreakdown, 'netValueOfGoods' | 'tax' | 'shippingFee' | 'shippingTax'>,
): number {
  return breakdown.netValueOfGoods + breakdown.tax + breakdown.shippingFee + breakdown.shippingTax;
}

/** Effective tax rate % from mapped line price fields (approval API has no taxRate). */
export function resolveApprovalItemTaxRate(price: ApprovalPrice): number | undefined {
  if (typeof price.taxRate === 'number' && price.taxRate > 0) {
    return price.taxRate;
  }
  const net = price.netValue ?? price.newUnitPrice;
  if (typeof net === 'number' && net > 0 && typeof price.taxValue === 'number') {
    return (price.taxValue / net) * 100;
  }
  if (typeof net === 'number' && net > 0 && typeof price.grossValue === 'number') {
    return ((price.grossValue - net) / net) * 100;
  }
  return undefined;
}

export function resolveApprovalShippingTaxRate(approval: Approval): number | undefined {
  const rate = approval.details?.shipping?.taxRate;
  return typeof rate === 'number' && rate > 0 ? rate : undefined;
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

/** Goods VAT % from item rates — ignore taxAggregate (shipping uses its own rate). */
export function resolveApprovalDisplayTaxRate(approval: Approval): number | undefined {
  const itemRates = (approval.resource.items ?? []).map((item) => resolveApprovalItemTaxRate(item.itemPrice));
  return resolveSharedPositiveTaxRate(itemRates);
}

/**
 * Base Price card: pre-discount totals from item `unitPrice` (same approach as Quote details).
 */
export function resolveApprovalBasePriceBreakdown(approval: Approval): ApprovalPriceCardBreakdown {
  const items = approval.resource.items || [];
  const shippingFee = shippingFeeOf(approval);
  const { shippingTax, showShippingTax } = resolveApprovalShippingTax(approval);
  const quotedNet = quotedNetFromResource(approval, items);
  const hasUnitPrices = items.some((item) => typeof item.itemPrice.unitPrice === 'number');

  if (!hasUnitPrices) {
    const tax = quotedTaxFromResource(approval, items);
    return {
      netValueOfGoods: quotedNet,
      tax,
      shippingFee,
      shippingTax,
      showShippingTax,
      total: sumApprovalPriceCardLines({ netValueOfGoods: quotedNet, tax, shippingFee, shippingTax }),
      discountAmount: 0,
      taxRate: resolveApprovalDisplayTaxRate(approval),
      shippingTaxRate: resolveApprovalShippingTaxRate(approval),
    };
  }

  let netValueOfGoods = 0;
  let tax = 0;

  for (const item of items) {
    netValueOfGoods += lineBaseNet(item);
    tax += lineBaseTax(item);
  }

  return {
    netValueOfGoods,
    tax,
    shippingFee,
    shippingTax,
    showShippingTax,
    total: sumApprovalPriceCardLines({ netValueOfGoods, tax, shippingFee, shippingTax }),
    discountAmount: Math.max(0, netValueOfGoods - quotedNet),
    taxRate: resolveApprovalDisplayTaxRate(approval),
    shippingTaxRate: resolveApprovalShippingTaxRate(approval),
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
  const { shippingTax, showShippingTax } = resolveApprovalShippingTax(approval);

  return {
    netValueOfGoods,
    tax,
    shippingFee,
    shippingTax,
    showShippingTax,
    total: sumApprovalPriceCardLines({ netValueOfGoods, tax, shippingFee, shippingTax }),
    discountAmount: 0,
    taxRate: resolveApprovalDisplayTaxRate(approval),
    shippingTaxRate: resolveApprovalShippingTaxRate(approval),
  };
}
