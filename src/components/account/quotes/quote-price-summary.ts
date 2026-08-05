import { resolveItemDiscountPercent } from '@/components/account/shared/item-discount';
import type { Quote, QuoteItemPrice } from '@/platform/services/model/quote';

export { resolveItemDiscountPercent } from '@/components/account/shared/item-discount';

/**
 * Header “Total net amount”: net value of goods + net shipping (excludes shipping tax).
 * Prefer goods-only `subtotalNet` when present — `totalNet` may already include shipping.
 */
export function resolveQuoteTotalNetAmount(quote: Quote): number {
  const goodsNet = typeof quote.subtotalNet === 'number' ? quote.subtotalNet : quote.totalNet || 0;
  return goodsNet + (quote.shippingCost || 0);
}

export interface QuotePriceCardBreakdown {
  netValueOfGoods: number;
  tax: number;
  shippingFee: number;
  /**
   * Shipping tax = shipping.grossValue − shipping.value.
   * Hidden when shipping fee is 0 (Base and Quoted).
   */
  shippingTax: number;
  /** Whether to render the shipping-tax row (false when shipping fee is 0). */
  showShippingTax: boolean;
  /** Card footer total: sum of the lines above (Quoted also matches `totalPrice.grossValue`). */
  total: number;
  /** Net savings vs quoted goods (base net − quoted net), when base uses unitPrice. */
  discountAmount: number;
  /** Prefer a single shared rate for the tax-row suffix; omit when mixed/unknown. */
  taxRate?: number;
}

/** Sum of price-card lines (goods net + tax + shipping fee + shipping tax). */
export function sumQuotePriceCardLines(
  breakdown: Pick<QuotePriceCardBreakdown, 'netValueOfGoods' | 'tax' | 'shippingFee' | 'shippingTax'>,
): number {
  return breakdown.netValueOfGoods + breakdown.tax + breakdown.shippingFee + breakdown.shippingTax;
}

function resolveShippingTax(quote: Quote): { shippingTax: number; showShippingTax: boolean } {
  const shippingFee = quote.shippingCost || 0;
  if (shippingFee === 0) {
    return { shippingTax: 0, showShippingTax: false };
  }
  if (typeof quote.shippingGross !== 'number') {
    return { shippingTax: 0, showShippingTax: false };
  }
  const shippingTax = Math.max(0, quote.shippingGross - shippingFee);
  return { shippingTax, showShippingTax: shippingTax > 0 };
}

function lineBaseNet(price: QuoteItemPrice, quantity: number): number {
  if (typeof price.unitPrice === 'number') {
    return price.unitPrice * quantity;
  }
  return price.netValue ?? price.baseAmount ?? 0;
}

function lineBaseTax(price: QuoteItemPrice, quantity: number, fallbackRate?: number): number {
  if (typeof price.unitPrice === 'number') {
    const rate = price.taxRate ?? fallbackRate ?? 0;
    return price.unitPrice * quantity * (rate / 100);
  }
  if (typeof price.tax === 'number') {
    return price.tax;
  }
  if (typeof price.grossValue === 'number') {
    const net = price.netValue ?? price.baseAmount ?? 0;
    return Math.max(0, price.grossValue - net);
  }
  return 0;
}

/**
 * Base Price card (from items):
 * - net = Σ (unitPrice × quantity)
 * - tax = Σ (unitPrice × quantity × taxRate/100)
 * - shipping fee = shipping.value
 * - shipping tax = shipping.grossValue − shipping.value (hidden when shipping.value is 0)
 * - base total = sum of the lines above
 */
export function resolveQuoteBasePriceBreakdown(quote: Quote): QuotePriceCardBreakdown {
  const items = quote.items || [];
  const shippingFee = quote.shippingCost || 0;
  const { shippingTax, showShippingTax } = resolveShippingTax(quote);
  const hasUnitPrices = items.some((item) => typeof item.product.itemPrice.unitPrice === 'number');
  const quotedGoodsNet = typeof quote.subtotalNet === 'number' ? quote.subtotalNet : quote.totalNet || 0;

  if (!hasUnitPrices) {
    const netValueOfGoods = quote.totalNet || 0;
    const tax = quote.totalVat || 0;
    const total = sumQuotePriceCardLines({ netValueOfGoods, tax, shippingFee, shippingTax });
    return {
      netValueOfGoods,
      tax,
      shippingFee,
      shippingTax,
      showShippingTax,
      total,
      discountAmount: 0,
      taxRate: quote.vatRate,
    };
  }

  let netValueOfGoods = 0;
  let tax = 0;
  const rates = new Set<number>();

  for (const item of items) {
    const qty = item.quantity.quantity;
    const price = item.product.itemPrice;
    netValueOfGoods += lineBaseNet(price, qty);
    tax += lineBaseTax(price, qty, quote.vatRate);
    if (typeof price.taxRate === 'number') {
      rates.add(price.taxRate);
    } else if (typeof quote.vatRate === 'number') {
      rates.add(quote.vatRate);
    }
  }

  const taxRate = rates.size === 1 ? [...rates][0] : quote.vatRate;
  const total = sumQuotePriceCardLines({ netValueOfGoods, tax, shippingFee, shippingTax });

  return {
    netValueOfGoods,
    tax,
    shippingFee,
    shippingTax,
    showShippingTax,
    total,
    discountAmount: Math.max(0, netValueOfGoods - quotedGoodsNet),
    taxRate,
  };
}

/**
 * Quoted Price card:
 * - net = subtotalPrice.netValue
 * - tax = subtotalPrice.taxValue
 * - shipping fee = shipping.value
 * - shipping tax = shipping.grossValue − shipping.value (hidden when shipping.value is 0)
 * - quoted total = totalPrice.grossValue (must equal the sum of the lines above)
 */
export function resolveQuoteQuotedPriceBreakdown(quote: Quote): QuotePriceCardBreakdown {
  const netValueOfGoods = typeof quote.subtotalNet === 'number' ? quote.subtotalNet : quote.totalNet || 0;
  const tax = typeof quote.subtotalVat === 'number' ? quote.subtotalVat : quote.totalVat || 0;
  const shippingFee = quote.shippingCost || 0;
  const { shippingTax, showShippingTax } = resolveShippingTax(quote);
  const lineSum = netValueOfGoods + tax + shippingFee + shippingTax;
  // Prefer API gross total; fall back to line sum when totalGross is absent/zero inconsistently.
  const total = typeof quote.totalGross === 'number' && quote.totalGross > 0 ? quote.totalGross : lineSum;

  return {
    netValueOfGoods,
    tax,
    shippingFee,
    shippingTax,
    showShippingTax,
    total,
    discountAmount: 0,
    taxRate: quote.vatRate,
  };
}

/** Net unit price after quote discount (Unit Price column). */
export function resolveQuotedNetUnitPrice(price: QuoteItemPrice, quantity: number): number {
  if (typeof price.newUnitPrice === 'number') {
    return price.newUnitPrice;
  }
  if (typeof price.netValue === 'number' && quantity > 0) {
    return price.netValue / quantity;
  }
  return price.amount;
}

/** Gross unit price companion for quoted net unit. */
export function resolveQuotedGrossUnitPrice(price: QuoteItemPrice, quantity: number): number | undefined {
  if (typeof price.grossValue === 'number' && quantity > 0) {
    return price.grossValue / quantity;
  }
  if (typeof price.newUnitPrice === 'number' && typeof price.taxRate === 'number') {
    return price.newUnitPrice * (1 + price.taxRate / 100);
  }
  return undefined;
}

export function quoteHasItemDiscounts(quote: Quote): boolean {
  return (quote.items || []).some((item) => {
    const percent = resolveItemDiscountPercent(item.product.itemPrice);
    return typeof percent === 'number' && percent > 0;
  });
}
