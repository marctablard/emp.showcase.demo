/** Discount % for list columns: prefer API `discount`, else derive from unit prices. */
export function resolveItemDiscountPercent(price: {
  discount?: number;
  unitPrice?: number;
  newUnitPrice?: number;
}): number | undefined {
  if (typeof price.discount === 'number' && price.discount > 0) {
    return price.discount;
  }
  const { unitPrice, newUnitPrice } = price;
  if (typeof unitPrice === 'number' && typeof newUnitPrice === 'number' && unitPrice > 0 && newUnitPrice < unitPrice) {
    return Math.round(((unitPrice - newUnitPrice) / unitPrice) * 100);
  }
  return undefined;
}
